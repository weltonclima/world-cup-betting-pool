/**
 * MockApiFootballClient — implementação mock sem I/O real.
 *
 * Usado quando API_FOOTBALL_KEY não está configurada (desenvolvimento, CI)
 * ou quando API_FOOTBALL_USE_MOCK=true.
 * Contém dados fictícios suficientes para exercitar o mapeamento completo.
 */

import type { ApiFootballClient, TeamResponse, FixtureResponse } from "./client";

// ─── Dados fictícios de seleções ───────────────────────────────────────────────

export const MOCK_TEAMS: TeamResponse[] = [
  {
    team: { id: 6, name: "Brasil", code: "BRA", logo: "https://media.api-sports.io/football/teams/6.png" },
    group: "A",
  },
  {
    team: { id: 9, name: "Espanha", code: "ESP", logo: "https://media.api-sports.io/football/teams/9.png" },
    group: "B",
  },
  {
    team: { id: 10, name: "França", code: "FRA", logo: "https://media.api-sports.io/football/teams/10.png" },
    group: "C",
  },
  {
    team: { id: 2, name: "Argentina", code: "ARG", logo: "https://media.api-sports.io/football/teams/2.png" },
    group: "D",
  },
];

// ─── Dados fictícios de partidas ───────────────────────────────────────────────

export const MOCK_FIXTURES: FixtureResponse[] = [
  {
    fixture: { id: 1001, date: "2026-06-11T15:00:00+00:00", status: { short: "NS" } },
    teams: { home: { id: 6, name: "Brasil" }, away: { id: 9, name: "Espanha" } },
    goals: { home: null, away: null },
    league: { round: "Group Stage - 1" },
  },
  {
    fixture: { id: 1002, date: "2026-06-12T18:00:00+00:00", status: { short: "FT" } },
    teams: { home: { id: 10, name: "França" }, away: { id: 2, name: "Argentina" } },
    goals: { home: 2, away: 1 },
    league: { round: "Group Stage - 2" },
  },
  {
    fixture: { id: 1003, date: "2026-06-20T21:00:00+00:00", status: { short: "NS" } },
    teams: { home: { id: 6, name: "Brasil" }, away: { id: 2, name: "Argentina" } },
    goals: { home: null, away: null },
    league: { round: "Round of 16" },
  },
  {
    fixture: { id: 1004, date: "2026-06-25T21:00:00+00:00", status: { short: "NS" } },
    teams: { home: { id: 9, name: "Espanha" }, away: { id: 10, name: "França" } },
    goals: { home: null, away: null },
    league: { round: "Quarter-finals" },
  },
];

// ─── Implementação mock ────────────────────────────────────────────────────────

export class MockApiFootballClient implements ApiFootballClient {
  async getTeamsByTournament(
    _tournamentId: number,
    _season: number,
  ): Promise<TeamResponse[]> {
    return MOCK_TEAMS;
  }

  async getFixtures(
    _tournamentId: number,
    _season: number,
  ): Promise<FixtureResponse[]> {
    return MOCK_FIXTURES;
  }
}
