/**
 * Helper de id de partida por campeonato (TASK-04).
 *
 * Decide o **id-base** de uma partida conforme o campeonato e aplica o
 * namespacing da TASK-03:
 *
 * - **Legado (`fifa.world`, `legacyMatchId: true`)**: base = derivação canônica
 *   da Copa (`buildEspnMatchId` — slug data-times/`m{num}`), garantindo paridade
 *   byte-a-byte com os ids já gravados. `namespacedMatchId` é identidade no
 *   legado → id final inalterado.
 * - **Novo (clubes/ligas)**: base = `event.id` da ESPN (string estável, única por
 *   partida). Somos 100% ESPN ao vivo (decisão do produto) → não há registry de
 *   clube nem tabela de fuso; o id da própria ESPN é a chave natural. `id` final
 *   = `{championshipId}:{event.id}`.
 *
 * Módulo puro, sem I/O, sem `server-only`.
 */

import type { Championship } from "@/types/championships";

import { buildEspnMatchId } from "./espnMatchId";
import type { EspnEvent } from "./espnTypes";
import { namespacedMatchId } from "./namespacedMatchId";

/**
 * Gera o `matchId` final de um evento ESPN para um campeonato.
 *
 * @param event       evento ESPN validado.
 * @param championship campeonato-alvo (define legado vs novo + prefixo).
 * @param knockoutNum número de mata-mata — só usado no path legado da Copa
 *                    (repassado a `buildEspnMatchId`); ignorado no path novo.
 * @throws Error se, no path novo, `event.id` for vazio (id vazio é sempre bug).
 * @throws Error propaga as validações de `buildEspnMatchId` no path legado.
 */
export function matchBaseId(
  event: EspnEvent,
  championship: Pick<Championship, "id" | "legacyMatchId">,
  knockoutNum?: number,
): string {
  if (championship.legacyMatchId === true) {
    return namespacedMatchId(championship, buildEspnMatchId(event, knockoutNum));
  }
  if (event.id === "") {
    throw new Error(
      `matchBaseId: event.id vazio para campeonato novo ` +
        `(championshipId="${championship.id}"). Base = event.id da ESPN é obrigatória.`,
    );
  }
  return namespacedMatchId(championship, event.id);
}
