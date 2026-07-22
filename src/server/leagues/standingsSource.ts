/**
 * Fonte de dados da classificação de liga (TASK-20, multi-championship-launch).
 *
 * Busca o schedule ESPN da liga UMA vez e devolve, dos MESMOS eventos:
 *  - `matches` (via `mapEspnEventsToLeagueMatches`) — insumo do cálculo;
 *  - `teams` (via `extractLeagueTeamDisplay`) — display id → {name, crestUrl?}.
 *
 * Fonte única de eventos (um fetch → matches + teams) para não perder o display
 * dos clubes nem duplicar chamada à ESPN (spec §7). Overrides manuais de liga
 * NÃO são aplicados aqui (raros; display sempre vem da base ESPN — divergência
 * aceitável até a TASK-14). Sem `server-only`: mantém testabilidade em vitest,
 * como os demais módulos de `copaData` (só o barrel carrega `server-only`).
 */

import { EspnScoreClient, deriveRanges } from "@/server/copaData/espnClient";
import {
  extractLeagueTeamDisplay,
  mapEspnEventsToLeagueMatches,
} from "@/server/copaData/espnMapper";
import type { LeagueTeamDisplay } from "@/server/leagues/standings";
import type { Championship } from "@/types/championships";
import type { MatchWithId } from "@/types/matches";

/**
 * Busca matches + display de clubes de uma liga a partir do schedule ESPN.
 *
 * @throws propaga falhas de fetch/parse/mapping (a resiliência stale fica no route).
 */
export async function getLeagueStandingsData(
  championship: Championship,
): Promise<{ matches: MatchWithId[]; teams: LeagueTeamDisplay }> {
  const client = new EspnScoreClient(championship.espnSlug);
  const events = await client.fetchSchedule(deriveRanges(championship));
  return {
    matches: mapEspnEventsToLeagueMatches(events, championship),
    teams: extractLeagueTeamDisplay(events),
  };
}
