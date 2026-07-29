import { isSupabaseConfigured, supabaseConfig } from "../config/supabase.js";
import { getSession } from "./auth.service.js";
import { getSupabaseClient } from "./supabase-client.js";

const adsCacheTtl = 1000 * 60 * 3;
let activeAdsCache = null;
let activeAdsCacheAt = 0;

export async function getActiveAds({ force = false } = {}) {
  if (!isSupabaseConfigured()) return [];
  if (!force && activeAdsCache && Date.now() - activeAdsCacheAt < adsCacheTtl) {
    return activeAdsCache;
  }

  const query = "/ads?select=id,title,description,image_url,cta_label,destination_url,whatsapp,phone,address,latitude,longitude,google_maps_url,apple_maps_url,display_order,starts_at,ends_at&status=eq.active&order=display_order.asc";
  const ads = await requestSupabase(query, { publicRead: true }).catch(() => []);
  activeAdsCache = ads.filter(isActiveByPeriod).map(normalizeAd);
  activeAdsCacheAt = Date.now();
  return activeAdsCache;
}

export async function getAdminAds() {
  const ads = await requestSupabase("/ads?select=*&order=display_order.asc,created_at.desc");
  return ads.map(normalizeAd);
}

export async function saveAd(ad) {
  const payload = sanitizeAdPayload(ad);
  const path = ad.id ? `/ads?id=eq.${encodeURIComponent(ad.id)}` : "/ads";
  const method = ad.id ? "PATCH" : "POST";
  return requestSupabase(path, {
    method,
    headers: {
      Prefer: "return=representation"
    },
    body: JSON.stringify(ad.id ? payload : { ...payload, created_by: await getCurrentUserId() })
  });
}

export async function updateAdStatus(id, status) {
  return requestSupabase(`/ads?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=representation"
    },
    body: JSON.stringify({ status })
  });
}

export async function deleteAd(id) {
  return requestSupabase(`/ads?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal"
    }
  });
}

export async function uploadAdImage(file) {
  if (!file) return "";
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Use PNG, JPG, JPEG ou WebP.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("A imagem deve ter no maximo 5 MB.");
  }

  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error("Supabase nao configurado.");

  const extension = file.name.split(".").pop()?.toLowerCase() || "webp";
  const path = `${Date.now()}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(16).slice(2)}.${extension}`;
  const { error } = await supabase.storage.from("dozesticker-ads").upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (error) throw error;

  const { data } = supabase.storage.from("dozesticker-ads").getPublicUrl(path);
  return data.publicUrl;
}

export function buildMapLinks(ad) {
  const latitude = ad.latitude;
  const longitude = ad.longitude;
  const address = ad.address;
  const hasCoordinates = latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined;

  return {
    googleMapsUrl: sanitizeUrl(ad.google_maps_url) || (hasCoordinates
      ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
      : address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
        : ""),
    appleMapsUrl: sanitizeUrl(ad.apple_maps_url) || (hasCoordinates
      ? `https://maps.apple.com/?daddr=${latitude},${longitude}`
      : address
        ? `https://maps.apple.com/?daddr=${encodeURIComponent(address)}`
        : "")
  };
}

export function sanitizeUrl(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    return ["https:", "http:", "mailto:", "tel:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function isActiveByPeriod(ad) {
  const now = Date.now();
  const startsAt = ad.starts_at ? new Date(ad.starts_at).getTime() : 0;
  const endsAt = ad.ends_at ? new Date(ad.ends_at).getTime() : Infinity;
  return startsAt <= now && endsAt >= now;
}

function normalizeAd(ad) {
  return {
    ...ad,
    image_url: sanitizeUrl(ad.image_url),
    destination_url: sanitizeUrl(ad.destination_url),
    google_maps_url: sanitizeUrl(ad.google_maps_url),
    apple_maps_url: sanitizeUrl(ad.apple_maps_url),
    whatsapp: sanitizePhoneLink(ad.whatsapp),
    phone: sanitizePhoneLink(ad.phone)
  };
}

function sanitizeAdPayload(ad) {
  return {
    title: String(ad.title || "").trim(),
    description: String(ad.description || "").trim() || null,
    image_url: sanitizeUrl(ad.image_url) || null,
    cta_label: String(ad.cta_label || "").trim() || null,
    destination_url: sanitizeUrl(ad.destination_url) || null,
    whatsapp: String(ad.whatsapp || "").trim() || null,
    phone: String(ad.phone || "").trim() || null,
    address: String(ad.address || "").trim() || null,
    latitude: toNullableNumber(ad.latitude),
    longitude: toNullableNumber(ad.longitude),
    google_maps_url: sanitizeUrl(ad.google_maps_url) || null,
    apple_maps_url: sanitizeUrl(ad.apple_maps_url) || null,
    status: ["draft", "active", "inactive", "expired"].includes(ad.status) ? ad.status : "draft",
    display_order: Number(ad.display_order || 0),
    starts_at: ad.starts_at || null,
    ends_at: ad.ends_at || null
  };
}

async function requestSupabase(path, options = {}) {
  const session = await getSession().catch(() => null);
  if (!options.publicRead && !session?.access_token) {
    throw new Error("Sessao expirada. Entre novamente para continuar.");
  }

  const response = await fetch(`${supabaseConfig.url}/rest/v1${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: supabaseConfig.anonKey,
      Authorization: `Bearer ${session?.access_token || supabaseConfig.anonKey}`,
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

async function getCurrentUserId() {
  const session = await getSession();
  return session?.user?.id || null;
}

function sanitizePhoneLink(value = "") {
  return String(value || "").replace(/[^\d+]/g, "");
}

function toNullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
