/**
 * Helpers puros de escopo de ranking por campeonato (multi-championship TASK-11).
 *
 * Espelham a invariante de `namespacedMatchId`: o campeonato LEGADO (`fifa.world`,
 * `legacyMatchId: true`) usa a dimensão BARE — os doc-ids/valores da Copa 2026
 * permanecem byte-idênticos (`geral`, `grupos`, `grupo-A`, …); campeonatos novos
 * ganham prefixo do id (`{championshipId}-{dimension}`). Sem I/O nem `server-only`
 * (testável via vitest); reusa `parseMatchId` para derivar o campeonato do matchId.
 */

import { DEFAULT_CHAMPIONSHIP_ID, getChampionship } from "@/server/copaData/championshipCatalog";
import { parseMatchId } from "@/server/copaData/namespacedMatchId";
import type { Championship } from "@/types/championships";

/**
 * Campeonato dono de um matchId — fonte da elegibilidade de pontuação por
 * campeonato. Id namespaced (`{championshipId}:{base}`) → o prefixo; id legado
 * (sem `:`) → `fifa.world` (default/compat Copa).
 */
export function deriveChampionshipId(matchId: string): string {
  return parseMatchId(matchId).championshipId ?? DEFAULT_CHAMPIONSHIP_ID;
}

/**
 * Doc-scope de ranking de uma dimensão para um campeonato.
 *
 * Legado (`legacyMatchId: true`) → `dimension` bare (identidade — não regride a
 * Copa). Novo → `` `${championship.id}-${dimension}` `` (ex.: `bra.1-2026-geral`).
 */
export function championshipScope(
  championship: Pick<Championship, "id" | "legacyMatchId">,
  dimension: string,
): string {
  return championship.legacyMatchId === true ? dimension : `${championship.id}-${dimension}`;
}

/** Resultado da resolução do param `?championship` para um doc-scope de leitura. */
export type ChampionshipDocScope =
  | { ok: true; docScope: string; isChampionshipScoped: boolean }
  | { ok: false; error: string };

/**
 * Resolve o param `?championship` das rotas de leitura de ranking (TASK-21) para o
 * doc-scope correto, reusando `championshipScope`. Regras (spec §6.2):
 *
 * - ausente / vazio → identidade BARE (`scope`), NÃO-escopado → compat Copa legada
 *   byte-idêntica. Zero regressão.
 * - `fifa.world` (legado, `legacyMatchId`) → tratado igual a ausente (identidade).
 * - id fora do catálogo → erro (400 na rota).
 * - `type: "league"` → SÓ `geral` (liga tem dimensão única); outra fase → erro.
 *   doc-scope = `{id}-geral`.
 * - `type: "cup"` não-legado → compõe o doc-scope genérico; como cups não são
 *   pontuados (ids bare colidem com a Copa — ver `cup-matchid-not-namespaced`), o doc
 *   não existe e a rota devolve `null`. Não é erro; é ausência.
 *
 * `isChampionshipScoped` diz à rota qual schema usar (`championshipRankingSchema` vs
 * `rankingSchema`). Puro (sem I/O) — testável via vitest.
 */
export function resolveChampionshipDocScope(
  rawChampionship: string | null | undefined,
  scope: string,
): ChampionshipDocScope {
  if (rawChampionship === null || rawChampionship === undefined || rawChampionship === "") {
    return { ok: true, docScope: scope, isChampionshipScoped: false };
  }
  const championship = getChampionship(rawChampionship);
  if (championship === undefined) {
    return { ok: false, error: "Campeonato desconhecido." };
  }
  if (championship.legacyMatchId === true) {
    // Copa legada: doc-scope BARE, idêntico ao param ausente.
    return { ok: true, docScope: scope, isChampionshipScoped: false };
  }
  if (championship.type === "league" && scope !== "geral") {
    return { ok: false, error: "Este campeonato só tem ranking geral." };
  }
  return {
    ok: true,
    docScope: championshipScope(championship, scope),
    isChampionshipScoped: true,
  };
}
