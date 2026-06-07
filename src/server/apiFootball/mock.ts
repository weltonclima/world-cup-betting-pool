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
  // Grupo A
  {
    team: { id: 6, name: "Brasil", code: "BRA", logo: "https://media.api-sports.io/football/teams/6.png" },
    group: "A",
  },
  {
    team: { id: 9, name: "Espanha", code: "ESP", logo: "https://media.api-sports.io/football/teams/9.png" },
    group: "A",
  },
  // Grupo C
  {
    team: { id: 10, name: "França", code: "FRA", logo: "https://media.api-sports.io/football/teams/10.png" },
    group: "C",
  },
  {
    team: { id: 2, name: "Argentina", code: "ARG", logo: "https://media.api-sports.io/football/teams/2.png" },
    group: "C",
  },
];

/**
 * Mapa API id → grupo, derivado de MOCK_TEAMS. Espelha o `teamGroupMap` que o
 * Route Handler (TASK-04) montará a partir de /standings (A1). Exportado para
 * que mocks/testes/handlers derivem groupId de forma consistente.
 */
export const MOCK_TEAM_GROUP_MAP: Record<number, string | undefined> =
  Object.fromEntries(MOCK_TEAMS.map((t) => [t.team.id, t.group]));

// ─── Sedes fictícias (venues) ──────────────────────────────────────────────────

const VENUE_METLIFE = { id: 100, name: "MetLife Stadium", city: "East Rutherford" };
const VENUE_SOFI = { id: 101, name: "SoFi Stadium", city: "Inglewood" };
const VENUE_ATT = { id: 102, name: "AT&T Stadium", city: "Arlington" };

// ─── Dados fictícios de partidas ───────────────────────────────────────────────

export const MOCK_FIXTURES: FixtureResponse[] = [
  // Fase de grupos — agendada, com venue
  {
    fixture: { id: 1001, date: "2026-06-11T15:00:00+00:00", status: { short: "NS" }, venue: VENUE_METLIFE },
    teams: { home: { id: 6, name: "Brasil" }, away: { id: 9, name: "Espanha" } },
    goals: { home: null, away: null },
    league: { round: "Group Stage - 1" },
  },
  // Fase de grupos — finalizada, rodada 2, com placar e venue
  {
    fixture: { id: 1002, date: "2026-06-12T18:00:00+00:00", status: { short: "FT" }, venue: VENUE_SOFI },
    teams: { home: { id: 10, name: "França" }, away: { id: 2, name: "Argentina" } },
    goals: { home: 2, away: 1 },
    league: { round: "Group Stage - 2" },
  },
  // Fase de grupos — venue ainda indefinido (TBD → venue null)
  {
    fixture: {
      id: 1003,
      date: "2026-06-18T21:00:00+00:00",
      status: { short: "NS" },
      venue: { id: null, name: null, city: null },
    },
    teams: { home: { id: 9, name: "Espanha" }, away: { id: 6, name: "Brasil" } },
    goals: { home: null, away: null },
    league: { round: "Group Stage - 3" },
  },
  // Oitavas (mata-mata — sem grupo, sem round numérico)
  {
    fixture: { id: 1004, date: "2026-06-20T21:00:00+00:00", status: { short: "NS" }, venue: VENUE_ATT },
    teams: { home: { id: 6, name: "Brasil" }, away: { id: 2, name: "Argentina" } },
    goals: { home: null, away: null },
    league: { round: "Round of 16" },
  },
  // Quartas
  {
    fixture: { id: 1005, date: "2026-06-25T21:00:00+00:00", status: { short: "NS" }, venue: VENUE_SOFI },
    teams: { home: { id: 9, name: "Espanha" }, away: { id: 10, name: "França" } },
    goals: { home: null, away: null },
    league: { round: "Quarter-finals" },
  },
  // Semifinal
  {
    fixture: { id: 1006, date: "2026-07-01T21:00:00+00:00", status: { short: "NS" }, venue: VENUE_ATT },
    teams: { home: { id: 6, name: "Brasil" }, away: { id: 10, name: "França" } },
    goals: { home: null, away: null },
    league: { round: "Semi-finals" },
  },
  // Disputa de 3º lugar (terceiro)
  {
    fixture: { id: 1007, date: "2026-07-04T21:00:00+00:00", status: { short: "NS" }, venue: VENUE_SOFI },
    teams: { home: { id: 9, name: "Espanha" }, away: { id: 2, name: "Argentina" } },
    goals: { home: null, away: null },
    league: { round: "3rd Place Final" },
  },
  // Final
  {
    fixture: { id: 1008, date: "2026-07-05T21:00:00+00:00", status: { short: "NS" }, venue: VENUE_METLIFE },
    teams: { home: { id: 6, name: "Brasil" }, away: { id: 10, name: "França" } },
    goals: { home: null, away: null },
    league: { round: "Final" },
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
