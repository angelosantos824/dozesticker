const expected = {
  total: 992,
  teamCount: 48,
  teamStickerCount: 960,
  teamStickerPerTeam: 20,
  fwcCount: 19,
  introCount: 1,
  cocaColaCount: 12
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  const {
    OPERATIONAL_CATALOG_TOTAL,
    WORLD_CUP_2026_TEAMS,
    createFallbackWorldCupCatalog,
    isOperationalSticker
  } = await import("../assets/js/data/world-cup-2026.catalog.js");

  const catalog = createFallbackWorldCupCatalog();
  const stickers = catalog.stickers;
  const codes = stickers.map((sticker) => sticker.code);
  const duplicateCodes = findDuplicates(codes);
  const teamCodes = new Set(WORLD_CUP_2026_TEAMS.map((team) => team.teamCode));
  const teamStickers = stickers.filter((sticker) => teamCodes.has(sticker.team_code || sticker.teamCode));
  const missingTeamNumbers = findMissingTeamNumbers(WORLD_CUP_2026_TEAMS, teamStickers);
  const epicCount = stickers.filter((sticker) => hasMarker(sticker, "epic") || hasMarker(sticker, "silver")).length;
  const legendaryCount = stickers.filter((sticker) => hasMarker(sticker, "legendary") || hasMarker(sticker, "gold")).length;

  const result = {
    total: stickers.length,
    declaredTotal: OPERATIONAL_CATALOG_TOTAL,
    teamCount: WORLD_CUP_2026_TEAMS.length,
    teamStickerCount: teamStickers.length,
    everyTeamHas20: missingTeamNumbers.length === 0,
    fwcCount: stickers.filter((sticker) => /^FWC([1-9]|1[0-9])$/.test(sticker.code)).length,
    introCount: stickers.filter((sticker) => sticker.code === "INTRO00" && sticker.section_id === "intro").length,
    cocaColaCount: stickers.filter((sticker) => /^CC([1-9]|1[0-2])$/.test(sticker.code)).length,
    epicCount,
    legendaryCount,
    duplicateCodes,
    missingTeamNumbers,
    nonOperationalCount: stickers.filter((sticker) => !isOperationalSticker(sticker)).length
  };

  const failures = [
    result.total === expected.total ? "" : `Total esperado ${expected.total}, encontrado ${result.total}.`,
    result.declaredTotal === expected.total ? "" : `Constante esperada ${expected.total}, encontrada ${result.declaredTotal}.`,
    result.teamCount === expected.teamCount ? "" : `Selecoes esperadas ${expected.teamCount}, encontradas ${result.teamCount}.`,
    result.teamStickerCount === expected.teamStickerCount ? "" : `Figurinhas de selecoes esperadas ${expected.teamStickerCount}, encontradas ${result.teamStickerCount}.`,
    result.everyTeamHas20 ? "" : `Sequencias incompletas: ${result.missingTeamNumbers.length}.`,
    result.fwcCount === expected.fwcCount ? "" : `FWC esperadas ${expected.fwcCount}, encontradas ${result.fwcCount}.`,
    result.introCount === expected.introCount ? "" : `INTRO esperada ${expected.introCount}, encontrada ${result.introCount}.`,
    result.cocaColaCount === expected.cocaColaCount ? "" : `Coca-Cola esperadas ${expected.cocaColaCount}, encontradas ${result.cocaColaCount}.`,
    result.epicCount === 0 ? "" : `Epic Silver encontradas ${result.epicCount}.`,
    result.legendaryCount === 0 ? "" : `Legendary Gold encontradas ${result.legendaryCount}.`,
    result.duplicateCodes.length === 0 ? "" : `Codigos duplicados: ${result.duplicateCodes.join(", ")}.`,
    result.nonOperationalCount === 0 ? "" : `Itens nao operacionais encontrados ${result.nonOperationalCount}.`
  ].filter(Boolean);

  printReport(result);

  if (failures.length) {
    console.error("");
    console.error("Falhas:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }
}

function printReport(result) {
  console.log("DOZESTICKER - Catalogo validado");
  console.log("");
  console.log(`Total geral: ${result.total}`);
  console.log(`Selecoes: ${result.teamCount}`);
  console.log(`Figurinhas das selecoes: ${result.teamStickerCount}`);
  console.log("Figurinhas por selecao: 20");
  console.log(`FWC: ${result.fwcCount}`);
  console.log(`INTRO: ${result.introCount}`);
  console.log(`Coca-Cola: ${result.cocaColaCount}`);
  console.log(`Epic Silver: ${result.epicCount}`);
  console.log(`Legendary Gold: ${result.legendaryCount}`);
  console.log(`Codigos duplicados: ${result.duplicateCodes.length}`);
  console.log(`Sequencias incompletas: ${result.missingTeamNumbers.length}`);
  console.log("");
  console.log("Resultado: OK");
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();

  values.forEach((value) => {
    if (seen.has(value)) {
      duplicates.add(value);
      return;
    }

    seen.add(value);
  });

  return [...duplicates];
}

function findMissingTeamNumbers(teams, stickers) {
  const missing = [];

  teams.forEach((team) => {
    const numbers = new Set(
      stickers
        .filter((sticker) => sticker.team_code === team.teamCode || sticker.teamCode === team.teamCode)
        .map((sticker) => Number(sticker.player_number || sticker.playerNumber || sticker.number))
    );

    for (let number = 1; number <= expected.teamStickerPerTeam; number += 1) {
      const code = `${team.teamCode}${number}`;
      const hasNumber = numbers.has(number);
      const hasCode = stickers.some((sticker) => sticker.code === code);
      if (!hasNumber || !hasCode) {
        missing.push(`${team.teamCode}${number}`);
      }
    }
  });

  return missing;
}

function hasMarker(sticker, marker) {
  const normalizedMarker = normalize(marker);
  return [
    sticker?.rarity,
    sticker?.finish,
    sticker?.sectionCode,
    sticker?.section_code,
    sticker?.section_id,
    sticker?.type,
    sticker?.code,
    sticker?.title
  ].some((value) => normalize(value).includes(normalizedMarker));
}

function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
