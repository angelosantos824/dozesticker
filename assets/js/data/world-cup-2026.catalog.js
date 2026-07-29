export const WORLD_CUP_2026_TEAMS = [
  { groupCode: "A", name: "Mexico", teamCode: "MEX", displayOrder: 1 },
  { groupCode: "A", name: "Africa do Sul", teamCode: "RSA", displayOrder: 2 },
  { groupCode: "A", name: "Coreia do Sul", teamCode: "KOR", displayOrder: 3 },
  { groupCode: "A", name: "Republica Tcheca", teamCode: "CZE", displayOrder: 4 },
  { groupCode: "B", name: "Canada", teamCode: "CAN", displayOrder: 5 },
  { groupCode: "B", name: "Bosnia", teamCode: "BIH", displayOrder: 6 },
  { groupCode: "B", name: "Catar", teamCode: "QAT", displayOrder: 7 },
  { groupCode: "B", name: "Suica", teamCode: "SUI", displayOrder: 8 },
  { groupCode: "C", name: "Brasil", teamCode: "BRA", displayOrder: 9 },
  { groupCode: "C", name: "Marrocos", teamCode: "MAR", displayOrder: 10 },
  { groupCode: "C", name: "Haiti", teamCode: "HAI", displayOrder: 11 },
  { groupCode: "C", name: "Escocia", teamCode: "SCO", displayOrder: 12 },
  { groupCode: "D", name: "Estados Unidos", teamCode: "USA", displayOrder: 13 },
  { groupCode: "D", name: "Paraguai", teamCode: "PAR", displayOrder: 14 },
  { groupCode: "D", name: "Australia", teamCode: "AUS", displayOrder: 15 },
  { groupCode: "D", name: "Turquia", teamCode: "TUR", displayOrder: 16 },
  { groupCode: "E", name: "Alemanha", teamCode: "GER", displayOrder: 17 },
  { groupCode: "E", name: "Curacao", teamCode: "CUW", displayOrder: 18 },
  { groupCode: "E", name: "Costa do Marfim", teamCode: "CIV", displayOrder: 19 },
  { groupCode: "E", name: "Equador", teamCode: "ECU", displayOrder: 20 },
  { groupCode: "F", name: "Holanda", teamCode: "NED", displayOrder: 21 },
  { groupCode: "F", name: "Japao", teamCode: "JPN", displayOrder: 22 },
  { groupCode: "F", name: "Suecia", teamCode: "SWE", displayOrder: 23 },
  { groupCode: "F", name: "Tunisia", teamCode: "TUN", displayOrder: 24 },
  { groupCode: "G", name: "Belgica", teamCode: "BEL", displayOrder: 25 },
  { groupCode: "G", name: "Egito", teamCode: "EGY", displayOrder: 26 },
  { groupCode: "G", name: "Ira", teamCode: "IRN", displayOrder: 27 },
  { groupCode: "G", name: "Nova Zelandia", teamCode: "NZL", displayOrder: 28 },
  { groupCode: "H", name: "Espanha", teamCode: "ESP", displayOrder: 29 },
  { groupCode: "H", name: "Cabo Verde", teamCode: "CPV", displayOrder: 30 },
  { groupCode: "H", name: "Arabia Saudita", teamCode: "KSA", displayOrder: 31 },
  { groupCode: "H", name: "Uruguai", teamCode: "URU", displayOrder: 32 },
  { groupCode: "I", name: "Franca", teamCode: "FRA", displayOrder: 33 },
  { groupCode: "I", name: "Senegal", teamCode: "SEN", displayOrder: 34 },
  { groupCode: "I", name: "Iraque", teamCode: "IRQ", displayOrder: 35 },
  { groupCode: "I", name: "Noruega", teamCode: "NOR", displayOrder: 36 },
  { groupCode: "J", name: "Argentina", teamCode: "ARG", displayOrder: 37 },
  { groupCode: "J", name: "Argelia", teamCode: "ALG", displayOrder: 38 },
  { groupCode: "J", name: "Austria", teamCode: "AUT", displayOrder: 39 },
  { groupCode: "J", name: "Jordania", teamCode: "JOR", displayOrder: 40 },
  { groupCode: "K", name: "Portugal", teamCode: "POR", displayOrder: 41 },
  { groupCode: "K", name: "Congo", teamCode: "COD", displayOrder: 42 },
  { groupCode: "K", name: "Uzbequistao", teamCode: "UZB", displayOrder: 43 },
  { groupCode: "K", name: "Colombia", teamCode: "COL", displayOrder: 44 },
  { groupCode: "L", name: "Inglaterra", teamCode: "ENG", displayOrder: 45 },
  { groupCode: "L", name: "Croacia", teamCode: "CRO", displayOrder: 46 },
  { groupCode: "L", name: "Gana", teamCode: "GHA", displayOrder: 47 },
  { groupCode: "L", name: "Panama", teamCode: "PAN", displayOrder: 48 }
];

export const SECTION_ORDER = [
  "INTRO",
  "FWC",
  "MEX",
  "RSA",
  "KOR",
  "CZE",
  "CAN",
  "BIH",
  "QAT",
  "SUI",
  "BRA",
  "MAR",
  "HAI",
  "SCO",
  "USA",
  "PAR",
  "AUS",
  "TUR",
  "GER",
  "CUW",
  "CIV",
  "ECU",
  "NED",
  "JPN",
  "SWE",
  "TUN",
  "BEL",
  "EGY",
  "IRN",
  "NZL",
  "ESP",
  "CPV",
  "KSA",
  "URU",
  "FRA",
  "SEN",
  "IRQ",
  "NOR",
  "ARG",
  "ALG",
  "AUT",
  "JOR",
  "POR",
  "COD",
  "UZB",
  "COL",
  "ENG",
  "CRO",
  "GHA",
  "PAN",
  "CC"
];

export const SECTION_ORDER_MAP = new Map(
  SECTION_ORDER.map((code, index) => [code, index + 1])
);

export const OPERATIONAL_CATALOG_TOTAL = 992;
export const TEAM_STICKERS_PER_TEAM = 20;
export const FWC_STICKER_COUNT = 19;
export const INTRO_STICKER_COUNT = 1;
export const COCA_COLA_STICKER_COUNT = 12;

export function isOperationalSticker(sticker) {
  const markers = [
    sticker?.rarity,
    sticker?.finish,
    sticker?.sectionCode,
    sticker?.section_code,
    sticker?.section_id,
    sticker?.type,
    sticker?.code,
    sticker?.title
  ].map(normalizeCatalogMarker);

  return !markers.some((marker) => {
    return marker === "epic"
      || marker === "legendary"
      || marker === "silver"
      || marker === "gold"
      || marker === "epicsilver"
      || marker === "legendarygold";
  });
}

export function createTeamStickers(team) {
  return Array.from({ length: 20 }, (_, index) => {
    const number = index + 1;
    const code = `${team.teamCode}${number}`;

    return {
      id: `team-${team.teamCode.toLowerCase()}-${number}`,
      album_id: "world-cup-2026",
      section_id: `team-${team.teamCode.toLowerCase()}`,
      section_name: team.name,
      code,
      number,
      title: `${team.name} - Figurinha ${number}`,
      subtitle: "",
      type: teamStickerType(number),
      country_code: "",
      team_code: team.teamCode,
      teamCode: team.teamCode,
      teamName: team.name,
      group_code: team.groupCode,
      groupCode: team.groupCode,
      player_name: "",
      playerName: "",
      player_number: number,
      playerNumber: number,
      display_order: number,
      displayOrder: number,
      is_special: false,
      isSpecial: false,
      is_rare: number === 1 || number === 13,
      isRare: number === 1 || number === 13,
      foil: false,
      hasSticker: false,
      page: null,
      position: number,
      rarity: ""
    };
  });
}

function teamStickerType(number) {
  if (number === 1) return "badge";
  if (number === 2) return "goalkeeper";
  if (number === 13) return "team_photo";
  return "player";
}

export function createFallbackWorldCupCatalog() {
  const specialSections = [
    { id: "intro", album_id: "world-cup-2026", slug: "intro", code: "INTRO", name: "INTRO", group_code: "INTRO", kind: "special", display_order: 1 },
    { id: "fwc", album_id: "world-cup-2026", slug: "fwc", code: "FWC", name: "FWC", group_code: "FWC", kind: "special", display_order: 2 }
  ];
  const groupSections = "ABCDEFGHIJKL".split("").flatMap((groupCode, index) => {
    const groupOrder = 10 + index * 10;
    const teams = WORLD_CUP_2026_TEAMS
      .filter((team) => team.groupCode === groupCode)
      .map((team, teamIndex) => ({
        id: `team-${team.teamCode.toLowerCase()}`,
        album_id: "world-cup-2026",
        slug: team.teamCode.toLowerCase(),
        code: team.teamCode,
        name: team.name,
        country_code: "",
        team_code: team.teamCode,
        group_code: groupCode,
        kind: "team",
        display_order: SECTION_ORDER_MAP.get(team.teamCode) || groupOrder + teamIndex + 1
      }));

    return [
      { id: `group-${groupCode.toLowerCase()}`, album_id: "world-cup-2026", slug: `grupo-${groupCode.toLowerCase()}`, code: groupCode, name: `Grupo ${groupCode}`, group_code: groupCode, kind: "group", display_order: groupOrder },
      ...teams
    ];
  });
  const finalSections = [
    { id: "cc", album_id: "world-cup-2026", slug: "cc", code: "CC", name: "CC", group_code: "CC", kind: "special", display_order: SECTION_ORDER_MAP.get("CC") || 200 }
  ];
  const specialStickers = [
    createSpecialSticker("intro-00", "INTRO00", 0, "INTRO - Figurinha 00", "intro", "poster", 0, false, true),
    ...createFwcStickers(),
    ...createCcStickers()
  ];
  const teamStickers = WORLD_CUP_2026_TEAMS.flatMap(createTeamStickers);
  const stickers = [...specialStickers, ...teamStickers].filter(isOperationalSticker);

  return {
    collections: [
      { id: "world-cup", slug: "copa-do-mundo", name: "Copa do Mundo", year: 2026, status: "active" }
    ],
    albums: [
      {
        id: "world-cup-2026",
        collection_id: "world-cup",
        slug: "copa-do-mundo-2026",
        name: "Copa do Mundo 2026",
        total_stickers: OPERATIONAL_CATALOG_TOTAL,
        status: "active"
      }
    ],
    sections: [...specialSections, ...groupSections, ...finalSections],
    stickers
  };
}

function createCcStickers() {
  return Array.from({ length: 12 }, (_, index) => {
    const number = index + 1;
    return createSpecialSticker(
      `cc-${String(number).padStart(2, "0")}`,
      `CC${number}`,
      number,
      `CC - Figurinha ${number}`,
      "cc",
      "promo",
      980 + number
    );
  });
}

function createFwcStickers() {
  return Array.from({ length: 19 }, (_, index) => {
    const number = index + 1;
    return createSpecialSticker(
      `fwc-${String(number).padStart(2, "0")}`,
      `FWC${number}`,
      number,
      `FWC - Figurinha ${number}`,
      "fwc",
      number === 1 ? "trophy" : "special",
      number,
      false,
      true
    );
  });
}

function createSpecialSticker(id, code, number, title, sectionId, type, displayOrder, foil = false, rare = false) {
  const sectionName = {
    intro: "INTRO",
    fwc: "FWC",
    cc: "CC"
  }[sectionId];

  return {
    id,
    album_id: "world-cup-2026",
    section_id: sectionId,
    section_name: sectionName,
    code,
    number,
    title,
    subtitle: "",
    type,
    country_code: "",
    team_code: "",
    teamCode: "",
    teamName: "",
    group_code: sectionName,
    groupCode: sectionName,
    player_name: "",
    playerName: "",
    player_number: null,
    playerNumber: null,
    display_order: displayOrder,
    displayOrder,
    is_special: true,
    isSpecial: true,
    is_rare: rare,
    isRare: rare,
    foil,
    hasSticker: false,
    page: null,
    position: number,
    rarity: type
  };
}

function normalizeCatalogMarker(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
