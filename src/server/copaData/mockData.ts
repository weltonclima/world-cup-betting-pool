/**
 * Payload de dados mock da Copa 2026 para uso em dev/CI sem rede.
 *
 * Exportado como arquivo de produção (não-test) para que o MockCopaDataClient
 * possa importá-lo sem arrastar fixtures de __tests__ para o bundle.
 */

import type { OpenFootballData } from "./types";

export const MOCK_COPA_DATA: OpenFootballData = {
  name: "World Cup 2026",
  matches: [
    // ─── Grupo ───────────────────────────────────────────────────────────────
    {
      round: "Matchday 1",
      date: "2026-06-11",
      time: "13:00 UTC-6",
      team1: "Mexico",
      team2: "South Africa",
      group: "Group A",
      ground: "Mexico City",
    },
    {
      round: "Matchday 2",
      date: "2026-06-15",
      time: "16:00 UTC-6",
      team1: "Brazil",
      team2: "Mexico",
      group: "Group E",
      ground: "Los Angeles (Inglewood)",
      score: { ft: [2, 1], ht: [1, 0] },
    },
    {
      round: "Matchday 3",
      date: "2026-06-20",
      team1: "Brazil",
      team2: "Egypt",
      group: "Group E",
      ground: "Dallas (Arlington)",
    },
    // ─── Mata-mata ────────────────────────────────────────────────────────────
    {
      round: "Round of 32",
      num: 73,
      date: "2026-06-28",
      time: "12:00 UTC-7",
      team1: "2A",
      team2: "2B",
      ground: "Los Angeles (Inglewood)",
    },
    {
      round: "Round of 16",
      num: 89,
      date: "2026-07-04",
      time: "15:00 UTC-5",
      team1: "W73",
      team2: "W74",
      ground: "Dallas (Arlington)",
    },
    {
      round: "Quarter-final",
      num: 97,
      date: "2026-07-10",
      time: "18:00 UTC-5",
      team1: "W89",
      team2: "W90",
      ground: "New York (East Rutherford)",
    },
    {
      round: "Semi-final",
      num: 101,
      date: "2026-07-14",
      time: "18:00 UTC-5",
      team1: "W97",
      team2: "W98",
      ground: "Dallas (Arlington)",
    },
    {
      round: "Match for third place",
      num: 103,
      date: "2026-07-18",
      time: "16:00 UTC-5",
      team1: "L101",
      team2: "L102",
      ground: "Miami (Miami Gardens)",
    },
    {
      round: "Final",
      num: 104,
      date: "2026-07-19",
      time: "16:00 UTC-4",
      team1: "W101",
      team2: "W102",
      ground: "New York (East Rutherford)",
    },
    {
      round: "Round of 32",
      num: 75,
      date: "2026-06-29",
      time: "12:00 UTC-6",
      team1: "1E",
      team2: "3ABC",
      ground: "Mexico City",
    },
  ],
};
