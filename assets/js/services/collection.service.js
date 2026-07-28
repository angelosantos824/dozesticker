import { isSupabaseConfigured, supabaseConfig } from "../config/supabase.js";
import { OPERATIONAL_CATALOG_TOTAL, createFallbackWorldCupCatalog, isOperationalSticker } from "../data/world-cup-2026.catalog.js";
import { getCurrentUser, getSession } from "./auth.service.js";
import { readStorage, writeStorage } from "../utils/storage.js";

const fallbackCatalog = createFallbackWorldCupCatalog();
const syncQueueKey = "sync-queue";
const recentSearchesKey = "recent-searches";
const anonymousUserId = "anonymous";

let catalogCache;
let sectionsCache = fallbackCatalog.sections;
let albumsCache = fallbackCatalog.albums;
let collectionsCache = fallbackCatalog.collections;
let activeUserId = anonymousUserId;

window.addEventListener("online", () => {
  syncPendingChanges();
});

window.addEventListener("dozesticker:auth-signed-out", () => {
  clearCollectionCache();
});

export async function getCollections() {
  await ensureCatalog();
  return collectionsCache;
}

export async function getAlbums(collectionId) {
  await ensureCatalog();
  return collectionId ? albumsCache.filter((album) => album.collection_id === collectionId) : albumsCache;
}

export async function getAlbum(albumIdOrSlug = "world-cup-2026") {
  await ensureCatalog();
  return albumsCache.find((album) => album.id === albumIdOrSlug || album.slug === albumIdOrSlug) || albumsCache[0];
}

export async function getSections(albumId = "world-cup-2026") {
  await ensureCatalog();
  return sectionsCache
    .filter((section) => section.album_id === albumId)
    .sort((a, b) => a.display_order - b.display_order);
}

export async function getStickers(filters = {}) {
  const items = await ensureCatalog();
  return applyFilters(items, filters);
}

export async function searchStickers(query, filters = {}) {
  return getStickers({ ...filters, query });
}

export async function getProgress(filters = {}) {
  const items = await getStickers(filters);
  return calculateProgress(items, filters);
}

export async function getSectionProgress(sectionId) {
  return getProgress({ sectionId });
}

export async function toggleSticker(stickerId, nextValue) {
  const userId = await requireCollectionUserId();
  const owned = getLocalOwnership(userId);
  const hasSticker = typeof nextValue === "boolean" ? nextValue : !Boolean(owned[stickerId]);

  owned[stickerId] = hasSticker;
  writeStorage(getOwnershipKey(userId), owned);
  await persistChange(userId, stickerId, hasSticker);

  catalogCache = mergeOwnership(catalogCache || fallbackCatalog.stickers, owned);
  window.dispatchEvent(new CustomEvent("dozesticker:collection-change", { detail: { userId, stickerId, hasSticker } }));
  return hasSticker;
}

export async function getMissing(filters = {}) {
  return getStickers({ ...filters, status: "faltam" });
}

export async function getOwned(filters = {}) {
  return getStickers({ ...filters, status: "tenho" });
}

export async function listCollection(filters = {}) {
  return getStickers(filters);
}

export async function markSticker(stickerId) {
  return toggleSticker(stickerId, true);
}

export async function removeSticker(stickerId) {
  return toggleSticker(stickerId, false);
}

export async function search(query, filters = {}) {
  return searchStickers(query, filters);
}

export async function getStats() {
  return getProgress();
}

export function getConnectionState() {
  const online = navigator.onLine;
  const pending = getSyncQueue().filter((item) => item.userId === activeUserId).length;
  return {
    online,
    pending,
    label: online ? "Online" : "Offline"
  };
}

export function getServiceMode() {
  return isSupabaseConfigured() ? "supabase" : "local";
}

export function getRecentSearches() {
  return readStorage(getRecentSearchesKey(activeUserId), []).slice(0, 10);
}

export function addRecentSearch(query) {
  const value = String(query || "").trim();
  if (!value) return getRecentSearches();

  const normalizedValue = normalize(value);
  const next = [
    value,
    ...getRecentSearches().filter((item) => normalize(item) !== normalizedValue)
  ].slice(0, 10);
  writeStorage(getRecentSearchesKey(activeUserId), next);
  return next;
}

export async function syncPendingChanges() {
  if (!isSupabaseConfigured() || !navigator.onLine) {
    return getConnectionState();
  }

  const userId = await getCollectionUserId();
  if (!userId || userId === anonymousUserId) return getConnectionState();

  const validStickerIds = getValidStickerIds(catalogCache || fallbackCatalog.stickers);
  sanitizeStoredCollection(validStickerIds, userId);
  sanitizeSyncQueue(validStickerIds, userId);

  const queue = getSyncQueue();
  const remaining = [];

  for (const change of queue) {
    if (change.userId !== userId) {
      remaining.push(change);
      continue;
    }

    try {
      await upsertRemoteOwnership(change.userId, change.stickerId, change.hasSticker);
    } catch {
      remaining.push({ ...change, attempts: Number(change.attempts || 0) + 1 });
    }
  }

  writeStorage(syncQueueKey, remaining);
  return getConnectionState();
}

export function clearCollectionCache() {
  catalogCache = undefined;
  activeUserId = anonymousUserId;
}

async function ensureCatalog() {
  const userId = await getCollectionUserId();
  if (catalogCache && userId === activeUserId) return catalogCache;

  activeUserId = userId;

  if (isSupabaseConfigured()) {
    try {
      const remoteCatalog = await loadRemoteCatalog(userId);
      catalogCache = remoteCatalog?.length === OPERATIONAL_CATALOG_TOTAL
        ? remoteCatalog
        : createLocalCatalog(userId);
      return catalogCache;
    } catch {
      catalogCache = createLocalCatalog(userId);
      return catalogCache;
    }
  }

  catalogCache = createLocalCatalog(userId);
  return catalogCache;
}

function createLocalCatalog(userId) {
  collectionsCache = fallbackCatalog.collections;
  albumsCache = fallbackCatalog.albums;
  sectionsCache = fallbackCatalog.sections;
  const stickers = fallbackCatalog.stickers.filter(isOperationalSticker);
  const validStickerIds = getValidStickerIds(stickers);
  sanitizeStoredCollection(validStickerIds, userId);
  sanitizeSyncQueue(validStickerIds, userId);
  return mergeOwnership(stickers, getLocalOwnership(userId));
}

function mergeOwnership(items, owned) {
  return items.filter(isOperationalSticker).map((item) => ({
    ...item,
    hasSticker: Boolean(owned[item.id])
  }));
}

function getLocalOwnership(userId) {
  const key = getOwnershipKey(userId);
  const stored = readStorage(key);
  if (stored) return stored;

  const initial = Object.fromEntries(fallbackCatalog.stickers.map((item) => [item.id, false]));
  writeStorage(key, initial);
  return initial;
}

export function sanitizeStoredCollection(validStickerIds, userId = activeUserId) {
  const key = getOwnershipKey(userId);
  const stored = readStorage(key, {});
  const sanitized = {};
  let changed = false;

  for (const [stickerId, hasSticker] of Object.entries(stored || {})) {
    if (validStickerIds.has(stickerId)) {
      sanitized[stickerId] = Boolean(hasSticker);
    } else {
      changed = true;
    }
  }

  if (changed) writeStorage(key, sanitized);
  return sanitized;
}

function sanitizeSyncQueue(validStickerIds, userId = activeUserId) {
  const queue = getSyncQueue();
  const sanitized = queue.filter((item) => item.userId !== userId || validStickerIds.has(item.stickerId));

  if (sanitized.length !== queue.length) {
    writeStorage(syncQueueKey, sanitized);
  }

  return sanitized;
}

function getValidStickerIds(stickers) {
  return new Set(stickers.filter(isOperationalSticker).map((item) => item.id));
}

function getOwnershipKey(userId) {
  return `user-stickers:${userId || anonymousUserId}`;
}

function getRecentSearchesKey(userId) {
  return `${recentSearchesKey}:${userId || anonymousUserId}`;
}

async function getCollectionUserId() {
  const user = await getCurrentUser();
  activeUserId = user?.id || anonymousUserId;
  return activeUserId;
}

async function requireCollectionUserId() {
  const user = await getCurrentUser();
  if (!user?.id) {
    throw new Error("Entre na sua conta para alterar a colecao.");
  }
  activeUserId = user.id;
  return user.id;
}

function applyFilters(items, filters) {
  const query = normalize(filters.query || "");
  const compactQuery = compact(filters.query || "");
  const status = filters.status || "todas";
  const type = filters.type || "todos";
  const selectedSection = sectionsCache.find((section) => section.id === filters.sectionId);

  return items.filter((item) => {
    const haystack = [
      item.number,
      item.code,
      item.code?.replace(/([A-Z]+)(\d+)/, "$1 $2"),
      item.title,
      item.section_name,
      item.teamName,
      item.team_code,
      item.teamCode,
      item.group_code,
      /^[A-L]$/.test(item.group_code || "") ? `Grupo ${item.group_code}` : "",
      item.player_name,
      item.player_number,
      item.type,
      item.is_rare ? "rara raro estrela" : ""
    ].join(" ");
    const matchesQuery = !query || normalize(haystack).includes(query) || compact(haystack).includes(compactQuery);
    const matchesSection = matchesSectionFilter(item, selectedSection, filters);
    const matchesStatus =
      status === "todas"
      || (status === "tenho" && item.hasSticker)
      || (status === "faltam" && !item.hasSticker)
      || (status === "especiais" && (item.is_special || item.is_rare))
      || (status === "metalizadas" && item.foil)
      || (status === "time" && item.type === "team_photo");
    const matchesType = type === "todos" || item.type === type;
    return matchesQuery && matchesSection && matchesStatus && matchesType;
  }).sort((a, b) => a.display_order - b.display_order || a.number - b.number);
}

function matchesSectionFilter(item, selectedSection, filters) {
  if (filters.teamCode) return item.team_code === filters.teamCode || item.teamCode === filters.teamCode;
  if (filters.groupCode) return item.group_code === filters.groupCode || item.groupCode === filters.groupCode;
  if (!selectedSection) return true;
  if (selectedSection.kind === "group") return item.group_code === selectedSection.group_code || item.groupCode === selectedSection.group_code;
  if (selectedSection.kind === "team") return item.team_code === selectedSection.team_code || item.teamCode === selectedSection.team_code;
  return item.section_id === selectedSection.id;
}

function calculateProgress(items, filters = {}) {
  const isGlobalProgress = !filters.sectionId && !filters.teamCode && !filters.groupCode && !filters.query && (!filters.status || filters.status === "todas") && (!filters.type || filters.type === "todos");
  const albumTotal = catalogCache?.length || albumsCache[0]?.total_stickers || items.length;
  const total = isGlobalProgress ? albumTotal : items.length;
  const have = items.filter((item) => item.hasSticker).length;
  const missing = total - have;
  const progress = total ? Math.round((have / total) * 100) : 0;
  const bySection = sectionsCache.map((section) => {
    const sectionItems = items.filter((item) => matchesSectionFilter(item, section, {}));
    const sectionHave = sectionItems.filter((item) => item.hasSticker).length;
    return {
      ...section,
      total: sectionItems.length,
      have: sectionHave,
      missing: sectionItems.length - sectionHave,
      progress: sectionItems.length ? Math.round((sectionHave / sectionItems.length) * 100) : 0
    };
  });

  return {
    total,
    have,
    missing,
    progress,
    duplicates: 0,
    bySection
  };
}

function normalize(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function compact(value) {
  return normalize(value).replace(/\s+/g, "");
}

async function persistChange(userId, stickerId, hasSticker) {
  const change = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    userId,
    stickerId,
    hasSticker,
    createdAt: new Date().toISOString(),
    attempts: 0
  };

  if (!isSupabaseConfigured() || !navigator.onLine) {
    enqueueChange(change);
    return;
  }

  try {
    await upsertRemoteOwnership(userId, stickerId, hasSticker);
  } catch {
    enqueueChange(change);
  }
}

function enqueueChange(change) {
  const queue = getSyncQueue().filter((item) => !(item.userId === change.userId && item.stickerId === change.stickerId));
  queue.push(change);
  writeStorage(syncQueueKey, queue);
}

function getSyncQueue() {
  return readStorage(syncQueueKey, []);
}

async function loadRemoteCatalog(userId) {
  const [remoteStickers, userStickers] = await Promise.all([
    requestSupabase("/stickers?select=id,album_id,section_id,code,number,title,subtitle,page,position,rarity,type,country_code,team_code,group_code,player_name,player_number,display_order,is_special,foil,sections(name)&status=eq.active"),
    requestSupabase(`/user_stickers?select=sticker_id,has_sticker&user_id=eq.${encodeURIComponent(userId)}`)
  ]);
  const ownership = new Map(userStickers.map((item) => [item.sticker_id, item.has_sticker]));

  const mappedStickers = remoteStickers.map((item) => ({
    ...item,
    section_name: item.sections?.name || "Sem secao",
    type: item.type || item.rarity || "player",
    teamCode: item.team_code || "",
    teamName: item.sections?.name || "Sem secao",
    groupCode: item.group_code || "",
    playerName: item.player_name || item.title || "",
    playerNumber: item.player_number || null,
    displayOrder: item.display_order || item.number || 0,
    isSpecial: Boolean(item.is_special),
    is_rare: Boolean(item.rarity === "rare"),
    isRare: Boolean(item.rarity === "rare"),
    foil: Boolean(item.foil),
    hasSticker: Boolean(ownership.get(item.id))
  })).filter(isOperationalSticker);

  const validStickerIds = getValidStickerIds(mappedStickers);
  sanitizeStoredCollection(validStickerIds, userId);
  sanitizeSyncQueue(validStickerIds, userId);

  collectionsCache = fallbackCatalog.collections;
  albumsCache = fallbackCatalog.albums.map((album) => ({
    ...album,
    total_stickers: OPERATIONAL_CATALOG_TOTAL
  }));
  sectionsCache = fallbackCatalog.sections;

  return mappedStickers;
}

async function upsertRemoteOwnership(userId, stickerId, hasSticker) {
  await requestSupabase("/user_stickers?on_conflict=user_id,sticker_id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify({
      user_id: userId,
      sticker_id: stickerId,
      has_sticker: hasSticker
    })
  });
}

async function requestSupabase(path, options = {}) {
  const session = await getSession();
  if (!session?.access_token) {
    throw new Error("Sessao expirada. Entre novamente para continuar.");
  }

  const response = await fetch(`${supabaseConfig.url}/rest/v1${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: supabaseConfig.anonKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      "Accept-Profile": "dozesticker",
      "Content-Profile": "dozesticker",
      ...(options.headers || {})
    },
    body: options.body
  });

  if (!response.ok) {
    throw new Error("Falha ao comunicar com Supabase.");
  }

  if (response.status === 204) return null;
  return response.json();
}
