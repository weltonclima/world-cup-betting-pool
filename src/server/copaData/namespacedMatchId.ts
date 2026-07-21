/**
 * Namespacing de matchId por campeonato (TASK-03) — núcleo de risco do épico
 * multi-championship.
 *
 * Torna os matchIds únicos ENTRE campeonatos sem quebrar nada da Copa 2026. O
 * `base` continua vindo da fórmula canônica (`buildMatchId`/`buildEspnMatchId`,
 * intactas); estas primitivas apenas aplicam/removem o prefixo do campeonato.
 *
 * Invariante crítica: para o campeonato LEGADO (`legacyMatchId: true`, só
 * `fifa.world`), `namespacedMatchId` é a IDENTIDADE — nenhum byte muda. É o que
 * mantém `predictions/{matchId}`, `matches/{id}` e rankings da Copa válidos.
 * Blindado por snapshot de paridade nos testes.
 *
 * Formato dos ids novos: `{championshipId}:{base}`. O separador `:` é seguro
 * porque nem `championshipId` (`{espnSlug}-{season}`, ex. `bra.1-2026`) nem o
 * `base` (`m73` | `2026-06-14-brazil-croatia`) contêm `:`.
 *
 * Módulo puro: sem I/O, sem estado, sem `server-only` (testável via vitest).
 * Importa apenas o TYPE `Championship` (import type) — sem importar o catálogo,
 * evitando ciclo e mantendo a primitiva pura.
 */

import type { Championship } from "@/types/championships";

const SEPARATOR = ":";

/**
 * Aplica o namespace do campeonato ao id-base.
 *
 * Legado (`legacyMatchId: true`) → retorna `base` inalterado (identidade).
 * Novo → `` `${championship.id}:${base}` ``.
 *
 * @throws Error se `base` for vazio (id vazio é sempre bug — falha ruidosa,
 *         coerente com o resto do copaData; ID silenciosamente errado é pior).
 */
export function namespacedMatchId(
  championship: Pick<Championship, "id" | "legacyMatchId">,
  base: string,
): string {
  if (base === "") {
    throw new Error(
      `namespacedMatchId: base vazio (championshipId="${championship.id}"). ` +
        `O id-base é obrigatório.`,
    );
  }
  if (championship.id === "") {
    throw new Error("namespacedMatchId: championship.id vazio.");
  }
  // Guardas de colisão: a segurança do separador `:` depende de nem o `base` nem
  // o `id` conterem `:`. Isso é convenção do formato atual — aqui é ENFORÇADO em
  // runtime (defense-in-depth), consistente com "falha ruidosa preferível a id
  // silenciosamente errado". Sem isto, ids de campeonatos distintos poderiam
  // colidir e sobrescrever `predictions/{matchId}`.
  if (base.includes(SEPARATOR)) {
    throw new Error(
      `namespacedMatchId: base contém '${SEPARATOR}' ("${base}") — viola o ` +
        `formato esperado (championshipId="${championship.id}").`,
    );
  }
  if (championship.id.includes(SEPARATOR)) {
    throw new Error(
      `namespacedMatchId: championship.id contém '${SEPARATOR}' ` +
        `("${championship.id}") — viola a convenção de id sem separador.`,
    );
  }
  if (championship.legacyMatchId === true) {
    return base;
  }
  return `${championship.id}${SEPARATOR}${base}`;
}

/**
 * Inverso de `namespacedMatchId`. Decompõe um matchId em campeonato + base.
 *
 * Com `:` → split no PRIMEIRO separador; um `:` residual (não esperado no formato
 * atual) permanece no `base`. Sem `:` → id legado da Copa →
 * `{ championshipId: null, base: matchId }` (`null` sinaliza legado).
 */
export function parseMatchId(matchId: string): {
  championshipId: string | null;
  base: string;
} {
  const idx = matchId.indexOf(SEPARATOR);
  if (idx === -1) {
    return { championshipId: null, base: matchId };
  }
  return {
    championshipId: matchId.slice(0, idx),
    base: matchId.slice(idx + 1),
  };
}
