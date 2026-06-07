/**
 * Testes do MockApiFootballClient e factory getApiFootballClient.
 * Casos C1–C4 conforme spec §10.3.
 *
 * Importa mock/factory diretamente (../mock, ../factory), não do barrel
 * ../index, pois o barrel inclui `import "server-only"` que lança fora de RSC.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MockApiFootballClient } from "../mock";
import { getApiFootballClient } from "../factory";

describe("MockApiFootballClient", () => {
  // C1: getTeamsByTournament retorna array não vazio de TeamResponse
  it("C1: getTeamsByTournament retorna array não vazio de TeamResponse", async () => {
    const client = new MockApiFootballClient();
    const result = await client.getTeamsByTournament(1, 2026);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    // Verifica estrutura de TeamResponse
    const primeiroTime = result[0];
    expect(primeiroTime).toBeDefined();
    expect(typeof primeiroTime!.team.id).toBe("number");
    expect(typeof primeiroTime!.team.name).toBe("string");
    expect(typeof primeiroTime!.team.code).toBe("string");
  });

  // C2: getFixtures retorna array não vazio de FixtureResponse
  it("C2: getFixtures retorna array não vazio de FixtureResponse", async () => {
    const client = new MockApiFootballClient();
    const result = await client.getFixtures(1, 2026);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    // Verifica estrutura de FixtureResponse
    const primeiraPartida = result[0];
    expect(primeiraPartida).toBeDefined();
    expect(typeof primeiraPartida!.fixture.id).toBe("number");
    expect(typeof primeiraPartida!.fixture.date).toBe("string");
    expect(typeof primeiraPartida!.league.round).toBe("string");
  });
});

describe("getApiFootballClient", () => {
  const originalEnv = process.env["API_FOOTBALL_KEY"];
  const originalMock = process.env["API_FOOTBALL_USE_MOCK"];

  beforeEach(() => {
    delete process.env["API_FOOTBALL_KEY"];
    delete process.env["API_FOOTBALL_USE_MOCK"];
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env["API_FOOTBALL_KEY"] = originalEnv;
    } else {
      delete process.env["API_FOOTBALL_KEY"];
    }
    if (originalMock !== undefined) {
      process.env["API_FOOTBALL_USE_MOCK"] = originalMock;
    } else {
      delete process.env["API_FOOTBALL_USE_MOCK"];
    }
  });

  // C3: sem API_FOOTBALL_KEY retorna cliente que se comporta como mock
  it("C3: sem API_FOOTBALL_KEY retorna cliente mock funcional", async () => {
    const client = getApiFootballClient();
    // Deve funcionar sem lançar erro (comportamento de mock)
    const times = await client.getTeamsByTournament(1, 2026);
    expect(Array.isArray(times)).toBe(true);
    expect(times.length).toBeGreaterThan(0);
  });

  // C4: dados do mock satisfazem os tipos TeamResponse/FixtureResponse (compile-time)
  it("C4: dados do mock têm estrutura compatível com TeamResponse e FixtureResponse", async () => {
    const client = new MockApiFootballClient();

    const times = await client.getTeamsByTournament(1, 2026);
    const partidas = await client.getFixtures(1, 2026);

    // Verifica campos obrigatórios de TeamResponse
    for (const time of times) {
      expect(typeof time.team.id).toBe("number");
      expect(typeof time.team.name).toBe("string");
      expect(typeof time.team.code).toBe("string");
      expect(typeof time.team.logo).toBe("string");
    }

    // Verifica campos obrigatórios de FixtureResponse
    for (const partida of partidas) {
      expect(typeof partida.fixture.id).toBe("number");
      expect(typeof partida.fixture.date).toBe("string");
      expect(typeof partida.fixture.status.short).toBe("string");
      expect(typeof partida.teams.home.id).toBe("number");
      expect(typeof partida.teams.away.id).toBe("number");
      expect(typeof partida.league.round).toBe("string");
    }
  });
});
