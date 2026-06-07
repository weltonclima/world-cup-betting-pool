/**
 * Fixtures de teste para FixtureResponse da API-Football (TASK-02).
 * Exercitam venue, round numérico, groupId derivado, terceiro lugar e todos os status.
 */

import type { FixtureResponse } from "../../../apiFootball/types";

/** API id → ID do documento Firestore (teams/{id}) */
export const TEST_TEAM_ID_MAP: Record<number, string> = {
  6: "brasil-doc-id",
  9: "espanha-doc-id",
  10: "franca-doc-id",
  2: "argentina-doc-id",
};

/** API id → grupo (origem: /standings, montado pelo Route Handler — A1) */
export const TEST_TEAM_GROUP_MAP: Record<number, string | undefined> = {
  6: "A",
  9: "A",
  10: "C",
  2: "C",
};

/** Partida agendada (NS) na fase de grupos, com venue completo */
export const fixtureAgendada: FixtureResponse = {
  fixture: {
    id: 1001,
    date: "2026-06-11T15:00:00.000Z",
    status: { short: "NS" },
    venue: { id: 100, name: "MetLife Stadium", city: "East Rutherford" },
  },
  teams: {
    home: { id: 6, name: "Brasil" },
    away: { id: 9, name: "Espanha" },
  },
  goals: { home: null, away: null },
  league: { round: "Group Stage - 1" },
};

/** Partida finalizada (FT) na fase de grupos, rodada 2, com placares e venue */
export const fixtureFinalizadaComPlacar: FixtureResponse = {
  fixture: {
    id: 1002,
    date: "2026-06-12T18:00:00.000Z",
    status: { short: "FT" },
    venue: { id: 101, name: "SoFi Stadium", city: "Inglewood" },
  },
  teams: {
    home: { id: 10, name: "França" },
    away: { id: 2, name: "Argentina" },
  },
  goals: { home: 2, away: 1 },
  league: { round: "Group Stage - 2" },
};

/** Partida ao vivo (1H) com gols ainda null (início do tempo) */
export const fixtureAoVivo: FixtureResponse = {
  fixture: {
    id: 1003,
    date: "2026-06-13T20:00:00.000Z",
    status: { short: "1H" },
    venue: { id: 100, name: "MetLife Stadium", city: "East Rutherford" },
  },
  teams: {
    home: { id: 6, name: "Brasil" },
    away: { id: 2, name: "Argentina" },
  },
  goals: { home: null, away: null },
  league: { round: "Group Stage - 3" },
};

/** Oitavas de final (mata-mata — sem round numérico, sem grupo) */
export const fixtureOitavas: FixtureResponse = {
  fixture: {
    id: 1004,
    date: "2026-06-20T21:00:00.000Z",
    status: { short: "NS" },
    venue: { id: 102, name: "AT&T Stadium", city: "Arlington" },
  },
  teams: {
    home: { id: 6, name: "Brasil" },
    away: { id: 9, name: "Espanha" },
  },
  goals: { home: null, away: null },
  league: { round: "Round of 16" },
};

/** Quartas de final */
export const fixtureQuartas: FixtureResponse = {
  fixture: {
    id: 1005,
    date: "2026-06-25T21:00:00.000Z",
    status: { short: "NS" },
    venue: { id: 101, name: "SoFi Stadium", city: "Inglewood" },
  },
  teams: {
    home: { id: 9, name: "Espanha" },
    away: { id: 10, name: "França" },
  },
  goals: { home: null, away: null },
  league: { round: "Quarter-finals" },
};

/** Semifinal */
export const fixtureSemifinal: FixtureResponse = {
  fixture: {
    id: 1006,
    date: "2026-07-01T21:00:00.000Z",
    status: { short: "NS" },
    venue: { id: 102, name: "AT&T Stadium", city: "Arlington" },
  },
  teams: {
    home: { id: 6, name: "Brasil" },
    away: { id: 10, name: "França" },
  },
  goals: { home: null, away: null },
  league: { round: "Semi-finals" },
};

/** Disputa de 3º lugar (terceiro) */
export const fixtureTerceiro: FixtureResponse = {
  fixture: {
    id: 1007,
    date: "2026-07-04T21:00:00.000Z",
    status: { short: "NS" },
    venue: { id: 101, name: "SoFi Stadium", city: "Inglewood" },
  },
  teams: {
    home: { id: 9, name: "Espanha" },
    away: { id: 2, name: "Argentina" },
  },
  goals: { home: null, away: null },
  league: { round: "3rd Place Final" },
};

/** Final */
export const fixtureFinal: FixtureResponse = {
  fixture: {
    id: 1008,
    date: "2026-07-05T21:00:00.000Z",
    status: { short: "NS" },
    venue: { id: 100, name: "MetLife Stadium", city: "East Rutherford" },
  },
  teams: {
    home: { id: 6, name: "Brasil" },
    away: { id: 10, name: "França" },
  },
  goals: { home: null, away: null },
  league: { round: "Final" },
};

/** Partida sem venue (TBD — venue deve virar null) */
export const fixtureSemVenue: FixtureResponse = {
  fixture: {
    id: 1009,
    date: "2026-06-18T15:00:00.000Z",
    status: { short: "NS" },
    venue: { id: null, name: null, city: null },
  },
  teams: {
    home: { id: 6, name: "Brasil" },
    away: { id: 9, name: "Espanha" },
  },
  goals: { home: null, away: null },
  league: { round: "Group Stage - 1" },
};

/** Partida com round desconhecido (deve lançar erro no mapRoundToStage) */
export const fixtureRoundDesconhecido: FixtureResponse = {
  fixture: {
    id: 9999,
    date: "2026-07-01T21:00:00.000Z",
    status: { short: "NS" },
    venue: { id: 100, name: "MetLife Stadium", city: "East Rutherford" },
  },
  teams: {
    home: { id: 6, name: "Brasil" },
    away: { id: 9, name: "Espanha" },
  },
  goals: { home: null, away: null },
  league: { round: "Playoff Round" },
};

/** Partida com data em offset +00:00 (deve normalizar para sufixo Z) */
export const fixtureOffsetUtc: FixtureResponse = {
  fixture: {
    id: 7001,
    date: "2026-06-11T15:00:00+00:00",
    status: { short: "NS" },
    venue: { id: 100, name: "MetLife Stadium", city: "East Rutherford" },
  },
  teams: {
    home: { id: 6, name: "Brasil" },
    away: { id: 9, name: "Espanha" },
  },
  goals: { home: null, away: null },
  league: { round: "Group Stage - 1" },
};

/** Partida com data em offset -03:00 (deve normalizar para o instante em Z) */
export const fixtureOffsetBrasilia: FixtureResponse = {
  fixture: {
    id: 7002,
    date: "2026-06-11T12:00:00-03:00",
    status: { short: "NS" },
    venue: { id: 100, name: "MetLife Stadium", city: "East Rutherford" },
  },
  teams: {
    home: { id: 6, name: "Brasil" },
    away: { id: 9, name: "Espanha" },
  },
  goals: { home: null, away: null },
  league: { round: "Group Stage - 1" },
};

/** Partida com data inválida (deve lançar erro no mapper) */
export const fixtureDataInvalida: FixtureResponse = {
  fixture: {
    id: 7003,
    date: "não-é-data",
    status: { short: "NS" },
    venue: { id: 100, name: "MetLife Stadium", city: "East Rutherford" },
  },
  teams: {
    home: { id: 6, name: "Brasil" },
    away: { id: 9, name: "Espanha" },
  },
  goals: { home: null, away: null },
  league: { round: "Group Stage - 1" },
};

/** 16 avos de final (Round of 32 — Copa 2026, formato 48 seleções) */
export const fixtureDezesseisAvos: FixtureResponse = {
  fixture: {
    id: 2001,
    date: "2026-06-29T21:00:00.000Z",
    status: { short: "NS" },
    venue: { id: 100, name: "MetLife Stadium", city: "East Rutherford" },
  },
  teams: {
    home: { id: 6, name: "Brasil" },
    away: { id: 9, name: "Espanha" },
  },
  goals: { home: null, away: null },
  league: { round: "Round of 32" },
};

/** Partida com time ausente no teamIdMap (deve lançar erro) */
export const fixtureTimeAusente: FixtureResponse = {
  fixture: {
    id: 8888,
    date: "2026-07-05T21:00:00.000Z",
    status: { short: "NS" },
    venue: { id: 100, name: "MetLife Stadium", city: "East Rutherford" },
  },
  teams: {
    home: { id: 999, name: "Time Inexistente" },
    away: { id: 9, name: "Espanha" },
  },
  goals: { home: null, away: null },
  league: { round: "Semi-finals" },
};
