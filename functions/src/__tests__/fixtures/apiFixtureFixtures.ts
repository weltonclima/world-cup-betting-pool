/**
 * Fixtures de teste para FixtureResponse da API-Football.
 * Usados nos testes de matchMapper.test.ts.
 */

import type { FixtureResponse } from "../../apiFootball/client";

/** IDs de times para usar no teamIdMap dos testes */
export const TEST_TEAM_ID_MAP: Record<number, string> = {
  6: "brasil-doc-id",
  9: "espanha-doc-id",
  10: "franca-doc-id",
  2: "argentina-doc-id",
};

/** Partida agendada (NS) — placares null */
export const fixtureAgendada: FixtureResponse = {
  fixture: {
    id: 1001,
    date: "2026-06-11T15:00:00.000Z",
    status: { short: "NS" },
  },
  teams: {
    home: { id: 6, name: "Brasil" },
    away: { id: 9, name: "Espanha" },
  },
  goals: { home: null, away: null },
  league: { round: "Group Stage - 1" },
};

/** Partida finalizada (FT) — com placares */
export const fixtureFinalizadaComPlacar: FixtureResponse = {
  fixture: {
    id: 1002,
    date: "2026-06-12T18:00:00.000Z",
    status: { short: "FT" },
  },
  teams: {
    home: { id: 10, name: "França" },
    away: { id: 2, name: "Argentina" },
  },
  goals: { home: 2, away: 1 },
  league: { round: "Group Stage - 2" },
};

/** Partida ao vivo (1H) */
export const fixtureAoVivo: FixtureResponse = {
  fixture: {
    id: 1003,
    date: "2026-06-13T20:00:00.000Z",
    status: { short: "1H" },
  },
  teams: {
    home: { id: 6, name: "Brasil" },
    away: { id: 2, name: "Argentina" },
  },
  goals: { home: null, away: null },
  league: { round: "Group Stage - 3" },
};

/** Partida nas oitavas de final */
export const fixtureOitavas: FixtureResponse = {
  fixture: {
    id: 1004,
    date: "2026-06-20T21:00:00.000Z",
    status: { short: "NS" },
  },
  teams: {
    home: { id: 6, name: "Brasil" },
    away: { id: 9, name: "Espanha" },
  },
  goals: { home: null, away: null },
  league: { round: "Round of 16" },
};

/** Partida com round desconhecido (deve lançar erro no mapRoundToStage) */
export const fixtureRoundDesconhecido: FixtureResponse = {
  fixture: {
    id: 9999,
    date: "2026-07-01T21:00:00.000Z",
    status: { short: "NS" },
  },
  teams: {
    home: { id: 6, name: "Brasil" },
    away: { id: 9, name: "Espanha" },
  },
  goals: { home: null, away: null },
  league: { round: "???" },
};

/** Partida com time ausente no teamIdMap (deve lançar erro) */
export const fixtureTimeAusente: FixtureResponse = {
  fixture: {
    id: 8888,
    date: "2026-07-05T21:00:00.000Z",
    status: { short: "NS" },
  },
  teams: {
    home: { id: 999, name: "Time Inexistente" },
    away: { id: 9, name: "Espanha" },
  },
  goals: { home: null, away: null },
  league: { round: "Semi-finals" },
};
