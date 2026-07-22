import { championshipSchema } from "@/schemas/championships";
import type { Championship } from "@/types/championships";

// Catálogo curado de campeonatos (TASK-02). Registry estático validado no spike
// TASK-01 (23/23 slugs ESPN aprovados). Fonte da verdade para quais campeonatos
// o app conhece; a habilitação por pool é da TASK-07.
//
// Convenções:
// - `fifa.world` é LEGADO: id BARE (compat com o default legado da TASK-05),
//   `legacyMatchId: true`, `status: archived` (Copa encerrada).
// - Campeonatos novos: id `{espnSlug}-{season}`; sem `legacyMatchId`.
// - `type` vem SEMPRE daqui (nunca inferido da API — achado do spike).
// - `needsPagination: true` para toda liga (pontos corridos > 100 jogos/temporada)
//   e para copas de temporada longa (mata-mata doméstico/continental). Torneios
//   curtos de seleção (Copa, Euro, etc.) cabem em uma chamada → false.
//
// NÃO importa `server-only`: usado em testes vitest (fora de RSC), como
// `espnClient.ts`. A restrição server-only fica no caller.

const RAW_CATALOG: readonly Championship[] = [
  // — Seleções / copas de seleção (torneios curtos: sem paginação) —
  {
    id: "fifa.world",
    espnSlug: "fifa.world",
    name: "Copa do Mundo FIFA",
    season: "2026",
    type: "cup",
    status: "archived",
    needsPagination: false,
    legacyMatchId: true,
  },
  {
    id: "conmebol.america-2026",
    espnSlug: "conmebol.america",
    name: "Copa América",
    season: "2026",
    type: "cup",
    status: "upcoming",
    needsPagination: false,
  },
  {
    id: "uefa.euro-2026",
    espnSlug: "uefa.euro",
    name: "Eurocopa",
    season: "2026",
    type: "cup",
    status: "upcoming",
    needsPagination: false,
  },
  {
    id: "uefa.nations-2026",
    espnSlug: "uefa.nations",
    name: "Liga das Nações da UEFA",
    season: "2026",
    type: "cup",
    status: "upcoming",
    // Fase de liga com todas as 55 associações UEFA (round-robin, set–nov) +
    // playoffs + Finals → temporada longa, provável estouro do cap 100. O spike
    // só fez smoke-test deste slug; safe-by-default até deep-test na TASK-04.
    needsPagination: true,
  },
  {
    id: "fifa.cwc-2026",
    espnSlug: "fifa.cwc",
    name: "Mundial de Clubes FIFA",
    season: "2026",
    type: "cup",
    status: "upcoming",
    needsPagination: false,
  },

  // — Ligas nacionais (pontos corridos: sempre paginação) —
  {
    id: "bra.1-2026",
    espnSlug: "bra.1",
    name: "Brasileirão Série A",
    season: "2026",
    type: "league",
    status: "upcoming",
    needsPagination: true,
  },
  {
    id: "eng.1-2026",
    espnSlug: "eng.1",
    name: "Premier League",
    season: "2026",
    type: "league",
    status: "upcoming",
    needsPagination: true,
  },
  {
    id: "esp.1-2026",
    espnSlug: "esp.1",
    name: "LaLiga",
    season: "2026",
    type: "league",
    status: "upcoming",
    needsPagination: true,
  },
  {
    id: "ita.1-2026",
    espnSlug: "ita.1",
    name: "Serie A (Itália)",
    season: "2026",
    type: "league",
    status: "upcoming",
    needsPagination: true,
  },
  {
    id: "ger.1-2026",
    espnSlug: "ger.1",
    name: "Bundesliga",
    season: "2026",
    type: "league",
    status: "upcoming",
    needsPagination: true,
  },
  {
    id: "fra.1-2026",
    espnSlug: "fra.1",
    name: "Ligue 1",
    season: "2026",
    type: "league",
    status: "upcoming",
    needsPagination: true,
  },
  {
    id: "por.1-2026",
    espnSlug: "por.1",
    name: "Primeira Liga (Portugal)",
    season: "2026",
    type: "league",
    status: "upcoming",
    needsPagination: true,
  },
  {
    id: "ned.1-2026",
    espnSlug: "ned.1",
    name: "Eredivisie",
    season: "2026",
    type: "league",
    status: "upcoming",
    needsPagination: true,
  },
  {
    id: "mex.1-2026",
    espnSlug: "mex.1",
    name: "Liga MX",
    season: "2026",
    type: "league",
    status: "upcoming",
    needsPagination: true,
  },
  {
    id: "usa.1-2026",
    espnSlug: "usa.1",
    name: "Major League Soccer",
    season: "2026",
    type: "league",
    status: "upcoming",
    needsPagination: true,
  },
  {
    id: "ksa.1-2026",
    espnSlug: "ksa.1",
    name: "Liga Saudita",
    season: "2026",
    type: "league",
    status: "upcoming",
    needsPagination: true,
  },
  {
    id: "arg.1-2026",
    espnSlug: "arg.1",
    name: "Liga Profissional Argentina",
    season: "2026",
    type: "league",
    status: "upcoming",
    needsPagination: true,
  },

  // — Copas mata-mata (temporada longa: paginação) —
  {
    id: "uefa.champions-2026",
    espnSlug: "uefa.champions",
    name: "Liga dos Campeões da UEFA",
    season: "2026",
    type: "cup",
    status: "upcoming",
    needsPagination: true,
  },
  {
    id: "uefa.europa-2026",
    espnSlug: "uefa.europa",
    name: "Liga Europa da UEFA",
    season: "2026",
    type: "cup",
    status: "upcoming",
    needsPagination: true,
  },
  {
    id: "conmebol.libertadores-2026",
    espnSlug: "conmebol.libertadores",
    name: "Copa Libertadores",
    season: "2026",
    type: "cup",
    status: "upcoming",
    needsPagination: true,
  },
  {
    id: "conmebol.sudamericana-2026",
    espnSlug: "conmebol.sudamericana",
    name: "Copa Sul-Americana",
    season: "2026",
    type: "cup",
    status: "upcoming",
    needsPagination: true,
  },
  {
    id: "bra.copa_do_brazil-2026",
    espnSlug: "bra.copa_do_brazil",
    name: "Copa do Brasil",
    season: "2026",
    type: "cup",
    status: "upcoming",
    needsPagination: true,
  },
  {
    id: "eng.fa-2026",
    espnSlug: "eng.fa",
    name: "Copa da Inglaterra (FA Cup)",
    season: "2026",
    type: "cup",
    status: "upcoming",
    needsPagination: true,
  },
];

// Valida cada entrada contra o schema no load (fail-fast em dev/test se o catálogo
// divergir do contrato).
// `Object.freeze` por entrada: o catálogo é singleton de módulo (persiste entre
// requests no mesmo processo). Congelar evita mutação in-place acidental (ex.:
// `getChampionship(id).status = ...`) corromper o catálogo global — transições
// reais de status são da TASK-13.
export const CHAMPIONSHIP_CATALOG: readonly Championship[] = Object.freeze(
  RAW_CATALOG.map((entry) => Object.freeze(championshipSchema.parse(entry))),
);

/**
 * Campeonato default (compat): Copa 2026 legado. Fonte ÚNICA da constante — o
 * `matchSource` (default de `getEffectiveMatches`) e o `championshipParam`
 * (default de `?championship=`) importam DAQUI. A garantia de compat byte-a-byte
 * depende desses defaults serem o MESMO valor; centralizar aqui torna drift um
 * erro único, não uma divergência silenciosa entre camadas.
 */
export const DEFAULT_CHAMPIONSHIP_ID = "fifa.world";

const BY_ID = new Map<string, Championship>(
  CHAMPIONSHIP_CATALOG.map((c) => [c.id, c]),
);

export function getChampionship(id: string): Championship | undefined {
  return BY_ID.get(id);
}

export function isCupType(championship: Championship): boolean {
  return championship.type === "cup";
}

export function listChampionships(): readonly Championship[] {
  return CHAMPIONSHIP_CATALOG;
}
