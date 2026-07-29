import { OPERATIONAL_CATALOG_TOTAL, createFallbackWorldCupCatalog } from "../assets/js/data/world-cup-2026.catalog.js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const schema = "dozesticker";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de executar.");
  process.exit(1);
}

const catalog = createFallbackWorldCupCatalog();

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  validateLocalCatalog();
  await verifyRequiredColumns();

  const collection = await upsertOne("collections", "slug", {
    slug: catalog.collections[0].slug,
    name: catalog.collections[0].name,
    year: catalog.collections[0].year,
    status: "active"
  });

  const album = await upsertOne("albums", "slug", {
    collection_id: collection.id,
    slug: catalog.albums[0].slug,
    name: catalog.albums[0].name,
    total_stickers: OPERATIONAL_CATALOG_TOTAL,
    status: "active"
  });

  const sectionRows = catalog.sections.map((section) => ({
    album_id: album.id,
    slug: section.slug,
    name: section.name,
    display_order: section.display_order,
    status: "active"
  }));
  const sections = await upsertMany("sections", "album_id,slug", sectionRows);
  const sectionBySlug = new Map(sections.map((section) => [section.slug, section]));
  const sectionByLocalId = new Map(
    catalog.sections.map((localSection) => [localSection.id, sectionBySlug.get(localSection.slug)])
  );

  const stickerRows = catalog.stickers.map((sticker) => {
    const section = sectionByLocalId.get(sticker.section_id);
    if (!section) throw new Error(`Secao nao encontrada para ${sticker.code}: ${sticker.section_id}`);

    return {
      album_id: album.id,
      section_id: section.id,
      code: sticker.code,
      number: sticker.number,
      title: sticker.title,
      subtitle: sticker.subtitle || null,
      page: sticker.page,
      position: sticker.position,
      rarity: sticker.rarity || null,
      status: "active"
    };
  });
  const stickers = await upsertMany("stickers", "album_id,code", stickerRows);

  const counts = await getCounts();
  console.log("DOZESTICKER - seed concluido");
  console.log(`collections: ${counts.collections}`);
  console.log(`albums: ${counts.albums}`);
  console.log(`sections: ${counts.sections}`);
  console.log(`stickers: ${counts.stickers}`);
  console.log(`stickers ativos: ${counts.activeStickers}`);

  if (stickers.length !== OPERATIONAL_CATALOG_TOTAL || counts.stickers < OPERATIONAL_CATALOG_TOTAL) {
    throw new Error(`Seed incompleto: esperadas ${OPERATIONAL_CATALOG_TOTAL} figurinhas.`);
  }
}

function validateLocalCatalog() {
  if (catalog.collections.length !== 1) throw new Error("Catalogo local deve possuir 1 collection.");
  if (catalog.albums.length !== 1) throw new Error("Catalogo local deve possuir 1 album.");
  if (catalog.stickers.length !== OPERATIONAL_CATALOG_TOTAL) {
    throw new Error(`Catalogo local invalido: ${catalog.stickers.length}/${OPERATIONAL_CATALOG_TOTAL}.`);
  }
}

async function verifyRequiredColumns() {
  await requestTable("collections", "?select=id,slug,name,year,status&limit=0");
  await requestTable("albums", "?select=id,collection_id,slug,name,total_stickers,status&limit=0");
  await requestTable("sections", "?select=id,album_id,slug,name,display_order,status&limit=0");
  await requestTable("stickers", "?select=id,album_id,section_id,code,number,title,subtitle,page,position,rarity,status&limit=0");
}

async function upsertOne(table, onConflict, row) {
  const rows = await upsertMany(table, onConflict, [row]);
  if (!rows[0]) throw new Error(`Falha ao gravar ${table}.`);
  return rows[0];
}

async function upsertMany(table, onConflict, rows) {
  if (!rows.length) return [];

  const batchSize = 200;
  const saved = [];

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const result = await requestTable(table, `?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify(batch)
    });
    saved.push(...result);
  }

  return saved;
}

async function getCounts() {
  const [collections, albums, sections, stickers, activeStickers] = await Promise.all([
    getCount("collections"),
    getCount("albums"),
    getCount("sections"),
    getCount("stickers"),
    getCount("stickers", "status=eq.active")
  ]);

  return {
    collections,
    albums,
    sections,
    stickers,
    activeStickers
  };
}

async function getCount(table, filter = "") {
  const suffix = filter ? `?${filter}` : "";
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${suffix}`, {
    method: "HEAD",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Accept-Profile": schema,
      Prefer: "count=exact"
    }
  });

  if (!response.ok) {
    throw new Error(`Falha ao contar ${table}: HTTP ${response.status}`);
  }

  const range = response.headers.get("content-range") || "0-0/0";
  return Number(range.split("/")[1] || 0);
}

async function requestTable(table, query = "", options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${query}`, {
    method: options.method || "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      "Accept-Profile": schema,
      "Content-Profile": schema,
      ...(options.headers || {})
    },
    body: options.body
  });

  const responseText = await response.text();
  const parsed = parseResponse(responseText);

  if (!response.ok) {
    console.error("Erro Supabase seed", {
      table,
      status: response.status,
      response: parsed ?? responseText
    });
    throw new Error(`Falha em ${table}: HTTP ${response.status}`);
  }

  return parsed ?? [];
}

function parseResponse(responseText) {
  if (!responseText) return null;

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}
