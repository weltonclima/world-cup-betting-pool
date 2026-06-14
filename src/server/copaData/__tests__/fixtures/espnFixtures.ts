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
  id?: string;
}) {
  return {
    // `event.id` é obrigatório no schema (TASK-01). Default determinístico
    // derivado de data+abreviações — único o bastante para os fixtures.
    id: opts.id ?? `${opts.date}-${opts.home.abbr}-${opts.away.abbr}`,
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
 * Evento ESPN de FASE DE GRUPOS completo (TASK-03) — estende `espnEvent` com os
 * campos exigidos pelo mapper completo: `season` (slug/type), `venue` e
 * `altGameNote` (fonte do groupId).
 *
 * Defaults realistas do spike: season `group-stage`/13802, venue "Estadio
 * Banorte"/"Mexico City" (presente em `VENUE_UTC_OFFSET` p/ derivar a data local).
 * `group` vira `altGameNote = "FIFA World Cup, Group {X}"`; `group: null` emite
 * "FIFA World Cup" (sem grupo). `venue: null` omite a venue da competition.
 */
export function espnGroupEvent(opts: {
  date: string;
  state: "pre" | "in" | "post";
  detail: string;
  home: { abbr: string; score: string; winner?: boolean };
  away: { abbr: string; score: string; winner?: boolean };
  group?: string | null;
  venue?: { fullName?: string; city?: string } | null;
  id?: string;
}) {
  const venue = opts.venue === undefined
    ? { fullName: "Estadio Banorte", city: "Mexico City" }
    : opts.venue;
  const group = opts.group === undefined ? "A" : opts.group;
  return {
    id: opts.id ?? `${opts.date}-${opts.home.abbr}-${opts.away.abbr}`,
    date: opts.date,
    season: { year: 2026, type: 13802, slug: "group-stage" },
    competitions: [
      {
        status: { type: { state: opts.state, detail: opts.detail } },
        ...(venue === null
          ? {}
          : {
              venue: {
                ...(venue.fullName !== undefined ? { fullName: venue.fullName } : {}),
                ...(venue.city !== undefined ? { address: { city: venue.city } } : {}),
              },
            }),
        altGameNote: group === null ? "FIFA World Cup" : `FIFA World Cup, Group ${group}`,
        competitors: [
          espnCompetitor("home", opts.home.abbr, opts.home.score, opts.home.winner),
          espnCompetitor("away", opts.away.abbr, opts.away.score, opts.away.winner),
        ],
      },
    ],
  };
}

/** `season.type` real por slug de mata-mata (spike TASK-00). */
const KO_SEASON_TYPE: Readonly<Record<string, number>> = {
  "round-of-32": 13801,
  "round-of-16": 13800,
  "quarterfinals": 13799,
  "semifinals": 13798,
  "3rd-place-match": 13797,
  "final": 13803,
};

/**
 * Evento ESPN de MATA-MATA completo (TASK-03). `slug` parametriza o stage; o
 * `type` é derivado de `KO_SEASON_TYPE`. `altGameNote = "FIFA World Cup"` (sem
 * grupo → groupId null). Times default são placeholders não-resolúveis ("2A",
 * "2B"), como na ESPN real antes da definição dos confrontos. `venue` default
 * `null` (mata-mata não precisa de venue p/ id, que usa knockoutNum).
 */
export function espnKnockoutEvent(opts: {
  date: string;
  state: "pre" | "in" | "post";
  detail: string;
  slug: string;
  home?: { abbr: string; score: string; winner?: boolean };
  away?: { abbr: string; score: string; winner?: boolean };
  venue?: { fullName?: string; city?: string } | null;
  id?: string;
}) {
  const home = opts.home ?? { abbr: "2A", score: "0" };
  const away = opts.away ?? { abbr: "2B", score: "0" };
  const venue = opts.venue ?? null;
  const type = KO_SEASON_TYPE[opts.slug];
  return {
    id: opts.id ?? `${opts.date}-${home.abbr}-${away.abbr}`,
    date: opts.date,
    season: {
      year: 2026,
      slug: opts.slug,
      ...(type !== undefined ? { type } : {}),
    },
    competitions: [
      {
        status: { type: { state: opts.state, detail: opts.detail } },
        ...(venue === null
          ? {}
          : {
              venue: {
                ...(venue.fullName !== undefined ? { fullName: venue.fullName } : {}),
                ...(venue.city !== undefined ? { address: { city: venue.city } } : {}),
              },
            }),
        altGameNote: "FIFA World Cup",
        competitors: [
          espnCompetitor("home", home.abbr, home.score, home.winner),
          espnCompetitor("away", away.abbr, away.score, away.winner),
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
