/**
 * Mapper ESPN event → patch de status/placar (TASK-04).
 *
 * Converte uma `EspnCompetition` JÁ VALIDADA (pós-parse do schema TASK-02) num
 * patch parcial `{ status, homeScore, awayScore }` consumível pelo merge (TASK-06),
 * via o matcher (TASK-05).
 *
 * Regras (validadas empiricamente no spike TASK-00):
 * - Mapeia EXCLUSIVAMENTE por `status.type.state` (`pre`/`in`/`post`). NUNCA
 *   parseia `detail` — é texto livre/localizado, display-only (`"FT"`, `"31'"`,
 *   `"Sun, June 14th at 1:00 PM EDT"`).
 * - Nulidade dos placares espelha o refine do `matchSchema`:
 *   `scheduled` → ambos null; `live`/`finished` → ambos numéricos.
 * - Extrai home/away por `homeAway` (independe da ordem no array).
 *
 * Módulo puro: sem I/O, sem estado, sem `server-only` (testável via vitest).
 */

import type { EspnCompetition } from "./espnTypes";

/** Patch parcial derivado de um competition ESPN. Status narrow (sem postponed/canceled). */
export interface EspnMatchPatch {
  status: "scheduled" | "live" | "finished";
  homeScore: number | null;
  awayScore: number | null;
}

/** Mapeia o `state` ESPN no status do domínio. Único critério de status. */
export function mapEspnState(
  state: "pre" | "in" | "post",
): "scheduled" | "live" | "finished" {
  switch (state) {
    case "pre":
      return "scheduled";
    case "in":
      return "live";
    case "post":
      return "finished";
  }
}

/** Converte uma competition ESPN validada num patch de status/placar. */
export function mapEspnCompetition(
  competition: EspnCompetition,
): EspnMatchPatch {
  const status = mapEspnState(competition.status.type.state);

  // Pré-jogo: placares ESPN ("0") são ruído; o domínio exige ambos null.
  if (status === "scheduled") {
    return { status, homeScore: null, awayScore: null };
  }

  // live/finished: extrai por homeAway (ordem do array não é confiável).
  const home = competition.competitors.find((c) => c.homeAway === "home");
  const away = competition.competitors.find((c) => c.homeAway === "away");

  return {
    status,
    homeScore: home ? home.score : null,
    awayScore: away ? away.score : null,
  };
}
