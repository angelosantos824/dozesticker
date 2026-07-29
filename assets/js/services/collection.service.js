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
let activeCatalogUserId = "";
let activeCatalogSource = "fallback";
let syncPromise = null;
const recoveredUsers = new Set();

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
    .sort(compareSections);
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
  const catalog = await ensureCatalog();
  const validStickerIds = getValidStickerIds(catalog);

  if (!validStickerIds.has(stickerId)) {
    throw new Error("Figurinha fora do catalogo operacional.");
  }

  const owned = getLocalOwnership(userId);
  const hasSticker = typeof nextValue === "boolean" ? nextValue : !Boolean(owned[stickerId]);

  owned[stickerId] = hasSticker;
  writeStorage(getOwnershipKey(userId), owned);

  catalogCache = mergeOwnership(catalogCache || catalog, owned);
  window.dispatchEvent(new CustomEvent("dozesticker:collection-change", { detail: { userId, stickerId, hasSticker } }));

  await persistChange(userId, stickerId, hasSticker);
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
  return isSupabaseConfigured() ? activeCatalogSource : "local";
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
  if (syncPromise) return syncPromise;

  syncPromise = runSyncPendingChanges()
    .finally(() => {
      syncPromise = null;
    });

  return syncPromise;
}

export function clearCollectionCache() {
  catalogCache = undefined;
  activeCatalogUserId = "";
  activeCatalogSource = "fallback";
  activeUserId = anonymousUserId;
}

export function sanitizeStoredCollection(validStickerIds, userId = activeUserId) {
  return sanitizeOwnershipObject(readStorage(getOwnershipKey(userId), {}), validStickerIds);
}

async function ensureCatalog() {
  const userId = await getCollectionUserId();
  if (catalogCache && activeCatalogUserId === userId) return catalogCache;

  activeCatalogUserId = userId;

  const remoteData = await tryLoadRemoteData(userId);
  const base = remoteData?.stickers?.length === OPERATIONAL_CATALOG_TOTAL
    ? createRemoteCatalog(remoteData)
    : createFallbackCatalog();

  const validStickerIds = getValidStickerIds(base.stickers);
  const aliasMap = createStickerAliasMap(base.stickers);
  const localOwnership = migrateStoredOwnership(userId, validStickerIds, aliasMap);
  sanitizeSyncQueue(validStickerIds, userId, aliasMap);

  const pendingOwnership = getPendingOwnership(userId, validStickerIds);
  const remoteOwnership = remoteData?.ownership || new Map();
  const mergedOwnership = mergeOwnershipPriority(validStickerIds, pendingOwnership, localOwnership, remoteOwnership);

  writeMergedLocalOwnership(userId, mergedOwnership, validStickerIds);
  catalogCache = mergeOwnership(base.stickers, mergedOwnership);

  if (userId !== anonymousUserId && remoteData && !recoveredUsers.has(userId)) {
    enqueueLocalRecoveryChanges(userId, validStickerIds, localOwnership, remoteOwnership);
    recoveredUsers.add(userId);
    await syncPendingChanges();
    const refreshedOwnership = await tryReloadRemoteOwnership(userId);
    if (refreshedOwnership) {
      const afterSyncOwnership = mergeOwnershipPriority(
        validStickerIds,
        getPendingOwnership(userId, validStickerIds),
        getLocalOwnership(userId),
        refreshedOwnership
      );
      writeMergedLocalOwnership(userId, afterSyncOwnership, validStickerIds);
      catalogCache = mergeOwnership(base.stickers, afterSyncOwnership);
    }
  }

  return catalogCache;
}

function createFallbackCatalog() {
  activeCatalogSource = isSupabaseConfigured() ? "fallback" : "local";
  collectionsCache = fallbackCatalog.collections;
  albumsCache = normalizeAlbums(fallbackCatalog.albums);
  sectionsCache = fallbackCatalog.sections.slice().sort(compareSections);

  return {
    stickers: fallbackCatalog.stickers.filter(isOperationalSticker)
  };
}

function createRemoteCatalog(remoteData) {
  activeCatalogSource = "supabase";
  collectionsCache = fallbackCatalog.collections;
  albumsCache = normalizeAlbums(fallbackCatalog.albums);
  sectionsCache = remoteData.sections.slice().sort(compareSections);

  return {
    stickers: remoteData.stickers
  };
}

async function tryLoadRemoteData(userId) {
  if (!canUseRemote(userId)) return null;

  try {
    return await loadRemoteData(userId);
  } catch (error) {
    console.error("Erro ao carregar catalogo remoto", error);
    return null;
  }
}

async function loadRemoteData(userId) {
  const [remoteStickers, userStickers, remoteSections] = await Promise.all([
    requestSupabase("/stickers?select=id,album_id,section_id,code,number,title,subtitle,page,position,rarity,display_order,sections(name)&status=eq.active"),
    requestSupabase(`/user_stickers?select=sticker_id,has_sticker&user_id=eq.${encodeURIComponent(userId)}`),
    requestSupabase("/sections?select=id,album_id,slug,name,display_order,status&status=eq.active")
  ]);

  const sections = remoteSections.map(enrichRemoteSection).sort(compareSections);
  const sectionsById = new Map(sections.map((section) => [section.id, section]));
  const ownership = new Map(userStickers.map((item) => [item.sticker_id, Boolean(item.has_sticker)]));
  const stickers = remoteStickers
    .map((item) => normalizeRemoteSticker(item, sectionsById))
    .filter(isOperationalSticker)
    .sort(compareStickers);

  return {
    stickers,
    sections,
    ownership
  };
}

async function tryReloadRemoteOwnership(userId) {
  if (!canUseRemote(userId)) return null;

  try {
    const userStickers = await requestSupabase(`/user_stickers?select=sticker_id,has_sticker&user_id=eq.${encodeURIComponent(userId)}`);
    return new Map(userStickers.map((item) => [item.sticker_id, Boolean(item.has_sticker)]));
  } catch (error) {
    console.error("Erro ao recarregar marcacoes remotas", error);
    return null;
  }
}

function normalizeRemoteSticker(item, sectionsById) {
  const section = sectionsById.get(item.section_id);
  const isSpecial = item.rarity === "rare";
  const isRare = item.rarity === "rare";

  return {
    ...item,
    section_name: item.sections?.name || section?.name || "Sem seção",
    type: deriveStickerType(item),
    team_code: section?.team_code || "",
    teamCode: section?.team_code || "",
    teamName: section?.name || item.sections?.name || "Sem seção",
    group_code: section?.group_code || "",
    groupCode: section?.group_code || "",
    player_name: item.title || "",
    playerName: item.title || "",
    player_number: null,
    playerNumber: null,
    displayOrder: item.display_order || item.number || 0,
    isSpecial,
    is_special: isSpecial,
    is_rare: isRare,
    isRare,
    foil: false,
    hasSticker: false
  };
}

function deriveStickerType(item) {
  if (item.rarity === "rare") return "special";
  return "player";
}

function enrichRemoteSection(section) {
  const fallbackSection = fallbackCatalog.sections.find((item) => (
    normalize(item.slug) === normalize(section.slug)
    || normalize(item.name) === normalize(section.name)
  ));

  return {
    ...section,
    code: fallbackSection?.code || section.slug?.toUpperCase() || "",
    country_code: fallbackSection?.country_code || "",
    team_code: fallbackSection?.team_code || "",
    group_code: fallbackSection?.group_code || "",
    kind: fallbackSection?.kind || "special"
  };
}

function mergeOwnership(items, ownership) {
  return items.filter(isOperationalSticker).map((item) => ({
    ...item,
    hasSticker: Boolean(ownership[item.id])
  }));
}

function mergeOwnershipPriority(validStickerIds, pendingOwnership, localOwnership, remoteOwnership) {
  const merged = {};

  validStickerIds.forEach((stickerId) => {
    if (pendingOwnership.has(stickerId)) {
      merged[stickerId] = pendingOwnership.get(stickerId);
      return;
    }

    if (Object.prototype.hasOwnProperty.call(localOwnership, stickerId)) {
      merged[stickerId] = Boolean(localOwnership[stickerId]);
      return;
    }

    if (remoteOwnership.has(stickerId)) {
      merged[stickerId] = Boolean(remoteOwnership.get(stickerId));
      return;
    }

    merged[stickerId] = false;
  });

  return merged;
}

function enqueueLocalRecoveryChanges(userId, validStickerIds, localOwnership, remoteOwnership) {
  Object.entries(localOwnership || {}).forEach(([stickerId, hasSticker]) => {
    if (!validStickerIds.has(stickerId)) return;

    const localValue = Boolean(hasSticker);
    const remoteHasValue = remoteOwnership.has(stickerId);
    const remoteValue = Boolean(remoteOwnership.get(stickerId));

    if (localValue || (remoteHasValue && localValue !== remoteValue)) {
      enqueueChange(createQueueChange(userId, stickerId, localValue));
    }
  });
}

async function runSyncPendingChanges() {
  if (!navigator.onLine || !isSupabaseConfigured()) {
    return getConnectionState();
  }

  const userId = await getCollectionUserId();
  if (!userId || userId === anonymousUserId) return getConnectionState();

  const validStickerIds = catalogCache ? getValidStickerIds(catalogCache) : new Set();
  const aliasMap = catalogCache ? createStickerAliasMap(catalogCache) : new Map();
  const queue = getSyncQueue();
  const remaining = [];

  for (const change of queue) {
    if (change.userId !== userId) {
      remaining.push(change);
      continue;
    }

    const remoteStickerId = resolveStickerId(change.stickerId, validStickerIds, aliasMap);
    if (!remoteStickerId || !isUuid(remoteStickerId)) {
      remaining.push({ ...change, attempts: Number(change.attempts || 0) + 1 });
      continue;
    }

    try {
      await upsertRemoteOwnership(change.userId, remoteStickerId, change.hasSticker);
    } catch (error) {
      console.error("Erro ao sincronizar figurinha", error);
      remaining.push({ ...change, stickerId: remoteStickerId, attempts: Number(change.attempts || 0) + 1 });
    }
  }

  writeStorage(syncQueueKey, remaining);
  return getConnectionState();
}

async function persistChange(userId, stickerId, hasSticker) {
  if (!navigator.onLine || !isSupabaseConfigured() || !isUuid(stickerId)) {
    enqueueChange(createQueueChange(userId, stickerId, hasSticker));
    return;
  }

  try {
    await upsertRemoteOwnership(userId, stickerId, hasSticker);
    removeQueuedChange(userId, stickerId);
  } catch (error) {
    console.error("Erro ao gravar figurinha", error);
    enqueueChange(createQueueChange(userId, stickerId, hasSticker));
  }
}

async function upsertRemoteOwnership(userId, stickerId, hasSticker) {
  if (!isUuid(stickerId)) {
    throw new Error(`sticker_id precisa ser UUID. Valor recebido: ${stickerId}`);
  }

  await requestSupabase("/user_stickers?on_conflict=user_id,sticker_id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify({
      user_id: userId,
      sticker_id: stickerId,
      has_sticker: Boolean(hasSticker)
    })
  });
}

function createQueueChange(userId, stickerId, hasSticker) {
  return {
    id: createChangeId(),
    userId,
    stickerId,
    hasSticker: Boolean(hasSticker),
    createdAt: new Date().toISOString(),
    attempts: 0
  };
}

function enqueueChange(change) {
  const queue = getSyncQueue().filter((item) => !(item.userId === change.userId && item.stickerId === change.stickerId));
  queue.push(change);
  writeStorage(syncQueueKey, queue);
}

function removeQueuedChange(userId, stickerId) {
  const queue = getSyncQueue();
  const next = queue.filter((item) => !(item.userId === userId && item.stickerId === stickerId));
  if (next.length !== queue.length) writeStorage(syncQueueKey, next);
}

function sanitizeSyncQueue(validStickerIds, userId = activeUserId, aliasMap = new Map()) {
  if (activeCatalogSource !== "supabase") {
    return getSyncQueue();
  }

  const queue = getSyncQueue();
  const sanitized = [];
  let changed = false;

  queue.forEach((item) => {
    if (item.userId !== userId) {
      sanitized.push(item);
      return;
    }

    const resolvedStickerId = resolveStickerId(item.stickerId, validStickerIds, aliasMap);
    if (!resolvedStickerId) {
      changed = true;
      return;
    }

    if (resolvedStickerId !== item.stickerId) changed = true;
    sanitized.push({ ...item, stickerId: resolvedStickerId });
  });

  if (changed || sanitized.length !== queue.length) {
    writeStorage(syncQueueKey, sanitized);
  }

  return sanitized;
}

function getPendingOwnership(userId, validStickerIds) {
  const pending = new Map();
  const aliasMap = catalogCache ? createStickerAliasMap(catalogCache) : new Map();

  getSyncQueue().forEach((item) => {
    const resolvedStickerId = resolveStickerId(item.stickerId, validStickerIds, aliasMap);
    if (item.userId === userId && resolvedStickerId) {
      pending.set(resolvedStickerId, Boolean(item.hasSticker));
    }
  });

  return pending;
}

function getSyncQueue() {
  return readStorage(syncQueueKey, []).filter(isValidQueueItem);
}

function isValidQueueItem(item) {
  return Boolean(item?.id && item?.userId && item?.stickerId && typeof item.hasSticker === "boolean" && item.createdAt);
}

function getLocalOwnership(userId) {
  return readStorage(getOwnershipKey(userId), {});
}

function sanitizeOwnershipObject(ownership, validStickerIds) {
  const sanitized = {};

  Object.entries(ownership || {}).forEach(([stickerId, hasSticker]) => {
    if (validStickerIds.has(stickerId)) {
      sanitized[stickerId] = Boolean(hasSticker);
    }
  });

  return sanitized;
}

function migrateStoredOwnership(userId, validStickerIds, aliasMap) {
  const stored = readStorage(getOwnershipKey(userId), {});
  const migrated = {};
  const preservedUnknown = {};
  let changed = false;

  Object.entries(stored || {}).forEach(([stickerId, hasSticker]) => {
    const resolvedStickerId = resolveStickerId(stickerId, validStickerIds, aliasMap);

    if (resolvedStickerId) {
      migrated[resolvedStickerId] = Boolean(hasSticker);
      if (resolvedStickerId !== stickerId) changed = true;
      return;
    }

    preservedUnknown[stickerId] = Boolean(hasSticker);
  });

  if (changed) {
    writeStorage(getOwnershipKey(userId), {
      ...preservedUnknown,
      ...migrated
    });
  }

  return migrated;
}

function writeMergedLocalOwnership(userId, ownership, validStickerIds) {
  const stored = readStorage(getOwnershipKey(userId), {});
  const preservedUnknown = {};

  Object.entries(stored || {}).forEach(([stickerId, hasSticker]) => {
    if (!validStickerIds.has(stickerId)) {
      preservedUnknown[stickerId] = Boolean(hasSticker);
    }
  });

  writeStorage(getOwnershipKey(userId), {
    ...preservedUnknown,
    ...ownership
  });
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

function canUseRemote(userId) {
  return Boolean(isSupabaseConfigured() && navigator.onLine && userId && userId !== anonymousUserId);
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
  }).sort(compareStickers);
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
  const missing = Math.max(total - have, 0);
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

  const responseText = await response.text();
  const parsed = parseResponseText(responseText);

  if (!response.ok) {
    console.error("Erro Supabase", {
      status: response.status,
      path,
      response: parsed ?? responseText
    });
    throw new Error(`Falha Supabase ${response.status}`);
  }

  return parsed ?? [];
}

function parseResponseText(responseText) {
  if (!responseText) return null;

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

function normalizeAlbums(albums) {
  return albums.map((album) => ({
    ...album,
    total_stickers: OPERATIONAL_CATALOG_TOTAL
  }));
}

function getValidStickerIds(stickers) {
  return new Set(stickers.filter(isOperationalSticker).map((item) => item.id));
}

function createStickerAliasMap(stickers) {
  const aliases = new Map();

  stickers.forEach((sticker) => {
    getStickerAliases(sticker).forEach((alias) => {
      aliases.set(alias, sticker.id);
    });
  });

  return aliases;
}

function getStickerAliases(sticker) {
  const aliases = new Set([
    sticker.id,
    normalizeAlias(sticker.id),
    sticker.code,
    normalizeAlias(sticker.code)
  ]);

  const number = Number(sticker.number || sticker.player_number || sticker.playerNumber);
  const codePrefix = String(sticker.code || "").replace(/\d+$/, "");
  const teamCode = sticker.team_code || sticker.teamCode || codePrefix;

  if (codePrefix && number >= 0) {
    aliases.add(`${codePrefix}${number}`);
    aliases.add(normalizeAlias(`${codePrefix}${number}`));
    aliases.add(`${codePrefix}-${String(number).padStart(2, "0")}`);
    aliases.add(normalizeAlias(`${codePrefix}-${String(number).padStart(2, "0")}`));
  }

  if (teamCode && number > 0) {
    aliases.add(`team-${String(teamCode).toLowerCase()}-${number}`);
    aliases.add(normalizeAlias(`team-${String(teamCode).toLowerCase()}-${number}`));
  }

  if (codePrefix === "INTRO" && number === 0) {
    aliases.add("intro-00");
    aliases.add(normalizeAlias("intro-00"));
  }

  return [...aliases].filter(Boolean);
}

function resolveStickerId(stickerId, validStickerIds, aliasMap) {
  if (validStickerIds.has(stickerId)) return stickerId;
  return aliasMap.get(stickerId) || aliasMap.get(normalizeAlias(stickerId)) || "";
}

function normalizeAlias(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isUuid(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
}

function compareSections(a, b) {
  return Number(a.display_order ?? 0) - Number(b.display_order ?? 0)
    || String(a.name || "").localeCompare(String(b.name || ""));
}

function compareStickers(a, b) {
  return getSectionOrder(a) - getSectionOrder(b)
    || String(a.team_code || a.teamCode || "").localeCompare(String(b.team_code || b.teamCode || ""))
    || Number(a.display_order ?? a.displayOrder ?? a.number ?? 0) - Number(b.display_order ?? b.displayOrder ?? b.number ?? 0)
    || Number(a.number ?? 0) - Number(b.number ?? 0)
    || String(a.code || "").localeCompare(String(b.code || ""));
}

function getSectionOrder(sticker) {
  const section = sectionsCache.find((item) => item.id === sticker.section_id);
  return Number(section?.display_order ?? sticker.display_order ?? sticker.displayOrder ?? sticker.number ?? 0);
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

function createChangeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
