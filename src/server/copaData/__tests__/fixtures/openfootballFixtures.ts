import type { OpenFootballData, OpenFootballMatch } from "../../types";

// ─── Matches de grupo ────────────────────────────────────────────────────────

/** Jogo de grupo agendado com horário e estádio — dado mais comum */
export const groupMatchBasic: OpenFootballMatch = {
  round: "Matchday 1",
  date: "2026-06-11",
  time: "13:00 UTC-6",
  team1: "Mexico",
  team2: "South Africa",
  group: "Group A",
  ground: "Mexico City",
};

/** Jogo de grupo finalizado com score.ft e score.ht */
export const groupMatchFinished: OpenFootballMatch = {
  round: "Matchday 2",
  date: "2026-06-15",
  time: "16:00 UTC-6",
  team1: "Brazil",
  team2: "Mexico",
  group: "Group E",
  ground: "Los Angeles (Inglewood)",
  score: { ft: [2, 1], ht: [1, 0] },
};

/** Jogo de grupo sem horário (TBD) — time ausente, degrada para 00:00+00:00 */
export const groupMatchNoTime: OpenFootballMatch = {
  round: "Matchday 3",
  date: "2026-06-20",
  team1: "Brazil",
  team2: "Egypt",
  group: "Group E",
  ground: "Dallas (Arlington)",
};

// ─── Matches de mata-mata ────────────────────────────────────────────────────

/** Round of 32 (dezesseis-avos) com placeholders de runner-up de grupo */
export const knockoutMatchRound32: OpenFootballMatch = {
  round: "Round of 32",
  num: 73,
  date: "2026-06-28",
  time: "12:00 UTC-7",
  team1: "2A",
  team2: "2B",
  ground: "Los Angeles (Inglewood)",
};

/** Round of 16 (oitavas) com placeholders de vencedor de Round of 32 */
export const knockoutMatchRound16: OpenFootballMatch = {
  round: "Round of 16",
  num: 89,
  date: "2026-07-04",
  time: "15:00 UTC-5",
  team1: "W73",
  team2: "W74",
  ground: "Dallas (Arlington)",
};

/** Quarter-final (quartas) com placeholders de vencedor de Round of 16 */
export const knockoutMatchQuarterfinal: OpenFootballMatch = {
  round: "Quarter-final",
  num: 97,
  date: "2026-07-10",
  time: "18:00 UTC-5",
  team1: "W89",
  team2: "W90",
  ground: "New York (East Rutherford)",
};

/** Semi-final com placeholders de vencedor de quartas */
export const knockoutMatchSemifinal: OpenFootballMatch = {
  round: "Semi-final",
  num: 101,
  date: "2026-07-14",
  time: "18:00 UTC-5",
  team1: "W97",
  team2: "W98",
  ground: "Dallas (Arlington)",
};

/** Match for third place (terceiro) com placeholders de perdedor de semifinal */
export const knockoutMatchThirdPlace: OpenFootballMatch = {
  round: "Match for third place",
  num: 103,
  date: "2026-07-18",
  time: "16:00 UTC-5",
  team1: "L101",
  team2: "L102",
  ground: "Miami (Miami Gardens)",
};

/** Final com placeholders de vencedor de semifinal */
export const knockoutMatchFinal: OpenFootballMatch = {
  round: "Final",
  num: 104,
  date: "2026-07-19",
  time: "16:00 UTC-4",
  team1: "W101",
  team2: "W102",
  ground: "New York (East Rutherford)",
};

/** Placeholder "1E" (1º do Grupo E) e "3ABC" (melhor 3º dos grupos A/B/C) */
export const knockoutMatch1E: OpenFootballMatch = {
  round: "Round of 32",
  num: 75,
  date: "2026-06-29",
  time: "12:00 UTC-6",
  team1: "1E",
  team2: "3ABC",
  ground: "Mexico City",
};

// ─── Dataset completo mínimo para testes de integração ───────────────────────

export const MOCK_COPA_DATA: OpenFootballData = {
  name: "World Cup 2026",
  matches: [
    groupMatchBasic,
    groupMatchFinished,
    groupMatchNoTime,
    knockoutMatchRound32,
    knockoutMatchRound16,
    knockoutMatchQuarterfinal,
    knockoutMatchSemifinal,
    knockoutMatchThirdPlace,
    knockoutMatchFinal,
    knockoutMatch1E,
  ],
};
