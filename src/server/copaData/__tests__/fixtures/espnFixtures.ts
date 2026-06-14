/**
 * Fixtures do scoreboard ESPN — payloads reais coletados no spike TASK-00
 * (2026-06-14) contra `site.api.espn.com` (liga `fifa.world`, season 2026).
 *
 * Trimados para os campos consumidos pelo schema (TASK-02). Campos extras
 * preservados em alguns para exercitar `.passthrough()`.
 */

/** Competitor mínimo válido. */
export function espnCompetitor(
  homeAway: "home" | "away",
  abbreviation: string,
  score: string,
  winner?: boolean,
) {
  return {
    homeAway,
    score,
    ...(winner !== undefined ? { winner } : {}),
    team: { abbreviation },
  };
}

/** Evento ESPN mínimo válido (1 competition, 2 competitors). */
export function espnEvent(opts: {
  date: string;
  state: "pre" | "in" | "post";
  detail: string;
  home: { abbr: string; score: string; winner?: boolean };
  away: { abbr: string; score: string; winner?: boolean };
}) {
  return {
    date: opts.date,
    competitions: [
      {
        status: { type: { state: opts.state, detail: opts.detail } },
        competitors: [
          espnCompetitor("home", opts.home.abbr, opts.home.score, opts.home.winner),
          espnCompetitor("away", opts.away.abbr, opts.away.score, opts.away.winner),
        ],
      },
    ],
  };
}

/**
 * Scoreboard real do dia 2026-06-13/14 (3 jogos finalizados, TASK-00).
 * QAT 1×1 SUI · BRA 1×1 MAR · HAI 0×1 SCO
 */
export const ESPN_SCOREBOARD_REAL = {
  events: [
    espnEvent({
      date: "2026-06-13T19:00Z",
      state: "post",
      detail: "FT",
      home: { abbr: "QAT", score: "1" },
      away: { abbr: "SUI", score: "1" },
    }),
    espnEvent({
      date: "2026-06-13T22:00Z",
      state: "post",
      detail: "FT",
      home: { abbr: "BRA", score: "1" },
      away: { abbr: "MAR", score: "1" },
    }),
    espnEvent({
      date: "2026-06-14T01:00Z",
      state: "post",
      detail: "FT",
      home: { abbr: "HAI", score: "0" },
      away: { abbr: "SCO", score: "1", winner: true },
    }),
  ],
};
