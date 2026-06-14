/**
 * Registry estático de seleções participantes da Copa 2026.
 * Mapeia o nome exato como aparece no JSON openfootball → TeamEntry.
 *
 * Nomes verificados ao vivo via:
 * https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
 *
 * CDN de bandeiras: https://flagcdn.com/h40/{iso2}.png (gratuito, sem chave).
 * iso2 = código ISO 3166-1 alfa-2 (lowercase).
 *
 * Invariante: id === code (D-OF3).
 */

export interface TeamEntry {
  id: string;       // = code (ex.: "BRA") — usado como doc id e homeTeamId/awayTeamId
  code: string;     // código FIFA 3 letras (regex ^[A-Z]{3}$)
  name: string;     // nome canônico pt-BR (exibição)
  flagUrl: string;  // CDN de bandeiras por código ISO 3166-1 alfa-2
}

/** Constrói flagUrl a partir do código ISO 3166-1 alfa-2 (lowercase). */
function flag(iso2: string): string {
  return `https://flagcdn.com/h40/${iso2.toLowerCase()}.png`;
}

/**
 * Mapa nome openfootball → TeamEntry para as 48 seleções da Copa 2026.
 *
 * Grupos confirmados pelo JSON ao vivo (2026-06-07):
 * Grupo A: Mexico, South Africa, South Korea, Czech Republic
 * Grupo B: Canada, Bosnia & Herzegovina, Qatar, Switzerland
 * Grupo C: Brazil, Morocco, Haiti, Scotland
 * Grupo D: USA, Paraguay, Australia, Turkey
 * Grupo E: Germany, Curaçao, Ivory Coast, Ecuador
 * Grupo F: Netherlands, Japan, Sweden, Tunisia
 * Grupo G: Belgium, Egypt, Iran, New Zealand
 * Grupo H: Spain, Cape Verde, Saudi Arabia, Uruguay
 * Grupo I: France, Senegal, Iraq, Norway
 * Grupo J: Argentina, Algeria, Austria, Jordan
 * Grupo K: Portugal, DR Congo, Uzbekistan, Colombia
 * Grupo L: England, Croatia, Ghana, Panama
 */
export const TEAM_REGISTRY: Record<string, TeamEntry> = {
  // ── Grupo A ───────────────────────────────────────────────────────────────
  "Mexico": {
    id: "MEX", code: "MEX", name: "México", flagUrl: flag("mx"),
  },
  "South Africa": {
    id: "RSA", code: "RSA", name: "África do Sul", flagUrl: flag("za"),
  },
  "South Korea": {
    id: "KOR", code: "KOR", name: "Coreia do Sul", flagUrl: flag("kr"),
  },
  "Czech Republic": {
    id: "CZE", code: "CZE", name: "República Checa", flagUrl: flag("cz"),
  },

  // ── Grupo B ───────────────────────────────────────────────────────────────
  "Canada": {
    id: "CAN", code: "CAN", name: "Canadá", flagUrl: flag("ca"),
  },
  "Bosnia & Herzegovina": {
    id: "BIH", code: "BIH", name: "Bósnia e Herzegovina", flagUrl: flag("ba"),
  },
  "Qatar": {
    id: "QAT", code: "QAT", name: "Catar", flagUrl: flag("qa"),
  },
  "Switzerland": {
    id: "SUI", code: "SUI", name: "Suíça", flagUrl: flag("ch"),
  },

  // ── Grupo C ───────────────────────────────────────────────────────────────
  "Brazil": {
    id: "BRA", code: "BRA", name: "Brasil", flagUrl: flag("br"),
  },
  "Morocco": {
    id: "MAR", code: "MAR", name: "Marrocos", flagUrl: flag("ma"),
  },
  "Haiti": {
    id: "HAI", code: "HAI", name: "Haiti", flagUrl: flag("ht"),
  },
  "Scotland": {
    id: "SCO", code: "SCO", name: "Escócia", flagUrl: flag("gb-sct"),
  },

  // ── Grupo D ───────────────────────────────────────────────────────────────
  "USA": {
    id: "USA", code: "USA", name: "EUA", flagUrl: flag("us"),
  },
  "Paraguay": {
    id: "PAR", code: "PAR", name: "Paraguai", flagUrl: flag("py"),
  },
  "Australia": {
    id: "AUS", code: "AUS", name: "Austrália", flagUrl: flag("au"),
  },
  "Turkey": {
    id: "TUR", code: "TUR", name: "Turquia", flagUrl: flag("tr"),
  },

  // ── Grupo E ───────────────────────────────────────────────────────────────
  "Germany": {
    id: "GER", code: "GER", name: "Alemanha", flagUrl: flag("de"),
  },
  "Curaçao": {
    id: "CUW", code: "CUW", name: "Curaçao", flagUrl: flag("cw"),
  },
  "Ivory Coast": {
    id: "CIV", code: "CIV", name: "Costa do Marfim", flagUrl: flag("ci"),
  },
  "Ecuador": {
    id: "ECU", code: "ECU", name: "Equador", flagUrl: flag("ec"),
  },

  // ── Grupo F ───────────────────────────────────────────────────────────────
  "Netherlands": {
    id: "NED", code: "NED", name: "Países Baixos", flagUrl: flag("nl"),
  },
  "Japan": {
    id: "JPN", code: "JPN", name: "Japão", flagUrl: flag("jp"),
  },
  "Sweden": {
    id: "SWE", code: "SWE", name: "Suécia", flagUrl: flag("se"),
  },
  "Tunisia": {
    id: "TUN", code: "TUN", name: "Tunísia", flagUrl: flag("tn"),
  },

  // ── Grupo G ───────────────────────────────────────────────────────────────
  "Belgium": {
    id: "BEL", code: "BEL", name: "Bélgica", flagUrl: flag("be"),
  },
  "Egypt": {
    id: "EGY", code: "EGY", name: "Egito", flagUrl: flag("eg"),
  },
  "Iran": {
    id: "IRN", code: "IRN", name: "Irã", flagUrl: flag("ir"),
  },
  "New Zealand": {
    id: "NZL", code: "NZL", name: "Nova Zelândia", flagUrl: flag("nz"),
  },

  // ── Grupo H ───────────────────────────────────────────────────────────────
  "Spain": {
    id: "ESP", code: "ESP", name: "Espanha", flagUrl: flag("es"),
  },
  "Cape Verde": {
    id: "CPV", code: "CPV", name: "Cabo Verde", flagUrl: flag("cv"),
  },
  "Saudi Arabia": {
    id: "KSA", code: "KSA", name: "Arábia Saudita", flagUrl: flag("sa"),
  },
  "Uruguay": {
    id: "URU", code: "URU", name: "Uruguai", flagUrl: flag("uy"),
  },

  // ── Grupo I ───────────────────────────────────────────────────────────────
  "France": {
    id: "FRA", code: "FRA", name: "França", flagUrl: flag("fr"),
  },
  "Senegal": {
    id: "SEN", code: "SEN", name: "Senegal", flagUrl: flag("sn"),
  },
  "Iraq": {
    id: "IRQ", code: "IRQ", name: "Iraque", flagUrl: flag("iq"),
  },
  "Norway": {
    id: "NOR", code: "NOR", name: "Noruega", flagUrl: flag("no"),
  },

  // ── Grupo J ───────────────────────────────────────────────────────────────
  "Argentina": {
    id: "ARG", code: "ARG", name: "Argentina", flagUrl: flag("ar"),
  },
  "Algeria": {
    id: "ALG", code: "ALG", name: "Argélia", flagUrl: flag("dz"),
  },
  "Austria": {
    id: "AUT", code: "AUT", name: "Áustria", flagUrl: flag("at"),
  },
  "Jordan": {
    id: "JOR", code: "JOR", name: "Jordânia", flagUrl: flag("jo"),
  },

  // ── Grupo K ───────────────────────────────────────────────────────────────
  "Portugal": {
    id: "POR", code: "POR", name: "Portugal", flagUrl: flag("pt"),
  },
  "DR Congo": {
    id: "COD", code: "COD", name: "República Democrática do Congo", flagUrl: flag("cd"),
  },
  "Uzbekistan": {
    id: "UZB", code: "UZB", name: "Uzbequistão", flagUrl: flag("uz"),
  },
  "Colombia": {
    id: "COL", code: "COL", name: "Colômbia", flagUrl: flag("co"),
  },

  // ── Grupo L ───────────────────────────────────────────────────────────────
  "England": {
    id: "ENG", code: "ENG", name: "Inglaterra", flagUrl: flag("gb-eng"),
  },
  "Croatia": {
    id: "CRO", code: "CRO", name: "Croácia", flagUrl: flag("hr"),
  },
  "Ghana": {
    id: "GHA", code: "GHA", name: "Gana", flagUrl: flag("gh"),
  },
  "Panama": {
    id: "PAN", code: "PAN", name: "Panamá", flagUrl: flag("pa"),
  },
};

/**
 * Resolve o nome do openfootball para TeamEntry.
 * Retorna undefined se não encontrado (para placeholders de mata-mata ou nomes desconhecidos).
 */
export function resolveTeam(name: string): TeamEntry | undefined {
  return TEAM_REGISTRY[name];
}

/**
 * Aliases ESPN `team.abbreviation` → `code` do registry.
 *
 * Nasce VAZIO: o spike TASK-00 (2026-06-14) confirmou que os 48 `abbreviation`
 * da ESPN batem exatamente com o `code` do registry — zero divergências.
 * Mantido como ponto de extensão caso a ESPN mude alguma abreviação no futuro.
 * Mutável de propósito (testes injetam aliases temporários).
 */
export const ESPN_ALIASES: Record<string, string> = {};

/** Índice reverso `code` → TeamEntry, construído uma vez (lookup O(1)). */
const CODE_INDEX: ReadonlyMap<string, TeamEntry> = new Map(
  Object.values(TEAM_REGISTRY).map((entry) => [entry.code, entry]),
);

/**
 * Resolve a `abbreviation` da ESPN para TeamEntry.
 * Aplica ESPN_ALIASES antes do lookup direto por `code`.
 * Retorna undefined para abreviações não reconhecidas
 * (placeholders de mata-mata `1A`/`RD16 W1`, string vazia, etc.).
 */
export function resolveTeamByCode(abbr: string): TeamEntry | undefined {
  const code = ESPN_ALIASES[abbr] ?? abbr;
  return CODE_INDEX.get(code);
}
