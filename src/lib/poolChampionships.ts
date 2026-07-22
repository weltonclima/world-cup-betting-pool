/**
 * Helpers de config de campeonatos do pool (multi-championship TASK-07).
 *
 * Módulo pure (server + client): defaults-na-leitura e validação de domínio dos
 * campos aditivos `enabledChampionships`/`rankingMode` do `poolSchema`. Os defaults
 * ficam AQUI (não no schema com `.default()`) para que docs de pool legados — sem
 * os campos — continuem parseando e se comportem como "só Copa, modo geral".
 *
 * O catálogo (`championshipCatalog`) NÃO é `server-only` (usado em testes vitest),
 * então pode ser importado deste módulo compartilhado.
 */

import {
  DEFAULT_CHAMPIONSHIP_ID,
  getChampionship,
} from "@/server/copaData/championshipCatalog";
import {
  DEFAULT_RANKING_MODE,
  MAX_ENABLED_CHAMPIONSHIPS,
} from "@/schemas/pools";
import type { Pool, RankingMode } from "@/types/pools";
import type { ChampionshipStatus } from "@/types/championships";

/**
 * Campeonatos habilitados no pool, com default de leitura. A validação de catálogo
 * é enforçada na ESCRITA (PATCH de settings), mas a leitura NÃO confia cegamente no
 * doc persistido: filtra contra o catálogo atual antes de devolver (review WR-01).
 * Assim, um id que deixou de existir no catálogo (campeonato retirado numa release
 * futura, ou doc escrito out-of-band) nunca escapa para os consumidores (TASK-08+),
 * que usam o id como slug ESPN / doc-id. Resultado vazio (ausente/vazio/todos
 * inválidos) → `[DEFAULT_CHAMPIONSHIP_ID]` (só Copa — comportamento legado).
 * Sempre devolve um array NOVO (não aliasa `pool.enabledChampionships` — IN-01).
 */
export function getEnabledChampionships(pool: Pool): string[] {
  // Dedupe defensivo (review LOW): a validação de escrita rejeita duplicados, mas um
  // doc out-of-band com id repetido inflaria consumidores de contagem (ex.: gate ≥2 do
  // agregado — recalc §7.6). A leitura "não confia no persistido", então dedupa aqui.
  const valid = [
    ...new Set(
      (pool.enabledChampionships ?? []).filter(
        (id) => getChampionship(id) !== undefined,
      ),
    ),
  ];
  return valid.length === 0 ? [DEFAULT_CHAMPIONSHIP_ID] : valid;
}

/**
 * Segmentação da ÁREA ATIVA (TASK-15 §6.5): remove campeonatos `archived` do
 * conjunto habilitado — arquivados vivem SÓ no Histórico, não no seletor de
 * campeonato / jogos / palpites.
 *
 * BUGFIX (temporada encerrada): pode devolver VAZIO. Um pool 100%-arquivado
 * (ex.: legado só-Copa, com `fifa.world` arquivada no fim do torneio) tem a área
 * ativa zerada — a UI mostra "temporada encerrada → veja o Histórico" e o pool
 * reativa ao habilitar um campeonato novo. Antes havia uma proteção anti-vazio
 * que devolvia o conjunto ORIGINAL; ela mantinha a Copa encerrada aparecendo em
 * ranking/palpite (o bug). Sempre devolve um array NOVO.
 *
 * `statuses` vem de `loadChampionshipStatuses` (override de runtime aplicado):
 * durante o torneio, um override `live`/`upcoming` mantém o campeonato na área
 * ativa; só o `archived` efetivo é segmentado.
 */
export function filterActiveChampionships(
  enabled: string[],
  statuses: Map<string, ChampionshipStatus>,
): string[] {
  return enabled.filter((id) => statuses.get(id) !== "archived");
}

/** Modo de ranking do pool, com default de leitura (`"geral"`). */
export function getRankingMode(pool: Pool): RankingMode {
  return pool.rankingMode ?? DEFAULT_RANKING_MODE;
}

/** Resultado da validação de domínio de `enabledChampionships`. */
export type ValidateEnabledResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Valida uma lista de campeonatos habilitados contra as regras de domínio
 * (enforce server-side, antes de persistir):
 * - piso ≥ 1 (nunca deixar o pool sem nenhum campeonato);
 * - teto ≤ `MAX_ENABLED_CHAMPIONSHIPS`;
 * - sem ids duplicados;
 * - todos os ids ∈ catálogo curado (`getChampionship`).
 */
export function validateEnabledChampionships(
  ids: string[],
): ValidateEnabledResult {
  if (ids.length < 1) {
    return { ok: false, reason: "Habilite ao menos um campeonato." };
  }
  if (ids.length > MAX_ENABLED_CHAMPIONSHIPS) {
    return {
      ok: false,
      reason: `Máximo de ${MAX_ENABLED_CHAMPIONSHIPS} campeonatos por grupo.`,
    };
  }
  if (new Set(ids).size !== ids.length) {
    return { ok: false, reason: "Campeonatos duplicados." };
  }
  for (const id of ids) {
    if (getChampionship(id) === undefined) {
      return { ok: false, reason: `Campeonato desconhecido: ${id}.` };
    }
  }
  return { ok: true };
}
