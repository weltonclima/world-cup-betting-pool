import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getMatchById,
  getNextScheduledMatch,
  getRecentFinishedMatches,
  listMatches,
} from "@/services/matches";

/**
 * Testes da camada de serviço de partidas (integracao-api-football, TASK-05).
 *
 * Agora consome `/api/*` via `fetch` (não mais Firestore). Mockamos `global.fetch`
 * — sem rede. Cobrimos: sucesso, parse Zod inválido, erro HTTP, 404→null e a
 * derivação client-side de next/recent a partir de `listMatches`.
 */

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

/** Partida com `id` embutido (formato da resposta de /api/matches). */
function makeScheduledMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "1001",
    homeTeamId: "team-bra",
    awayTeamId: "team-arg",
    kickoffAt: "2026-06-15T20:00:00.000Z",
    stage: "grupos",
    round: 1,
    groupId: "Group A",
    venue: { name: "MetLife Stadium", city: "East Rutherford" },
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    ...overrides,
  };
}

function makeFinishedMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "2001",
    homeTeamId: "team-bra",
    awayTeamId: "team-arg",
    kickoffAt: "2026-06-10T18:00:00.000Z",
    stage: "grupos",
    round: 1,
    groupId: "Group A",
    venue: { name: "SoFi Stadium", city: "Inglewood" },
    status: "finished",
    homeScore: 2,
    awayScore: 1,
    ...overrides,
  };
}

/** Resposta `ok` 200 com corpo JSON. */
function okJson(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

/** Resposta de erro com status arbitrário e corpo `{ error }`. */
function errorJson(status: number, error?: string): Response {
  return {
    ok: false,
    status,
    json: async () => (error === undefined ? {} : { error }),
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("listMatches", () => {
  it("faz GET /api/matches e retorna MatchWithId[] validado", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson([makeScheduledMatch(), makeFinishedMatch()]),
    );

    const result = await listMatches();

    expect(fetchMock).toHaveBeenCalledWith("/api/matches");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "1001", status: "scheduled" });
    expect(result[1]).toMatchObject({ id: "2001", status: "finished" });
  });

  it("retorna array vazio quando a API responde []", async () => {
    fetchMock.mockResolvedValueOnce(okJson([]));

    await expect(listMatches()).resolves.toEqual([]);
  });

  it("lança Error com status e detalhe em falha HTTP", async () => {
    // persistente: as duas asserções de rejeição disparam dois fetches.
    fetchMock.mockResolvedValue(errorJson(503, "Cota esgotada."));

    await expect(listMatches()).rejects.toThrow(/HTTP 503/);
    await expect(listMatches()).rejects.toThrow(/Cota esgotada\./);
  });

  it("lança Error mesmo sem corpo JSON no erro HTTP", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);

    await expect(listMatches()).rejects.toThrow(/HTTP 500/);
  });

  it("item fora do contrato faz rejeitar (ZodError)", async () => {
    // status inválido viola matchSchema
    fetchMock.mockResolvedValueOnce(
      okJson([makeScheduledMatch({ status: "invalido" })]),
    );

    await expect(listMatches()).rejects.toThrow();
  });

  it("item sem id faz rejeitar (ZodError)", async () => {
    const { id: _omit, ...semId } = makeScheduledMatch();
    void _omit;
    fetchMock.mockResolvedValueOnce(okJson([semId]));

    await expect(listMatches()).rejects.toThrow();
  });
});

describe("getMatchById", () => {
  it("faz GET /api/matches/:id (id encodado) e retorna MatchWithId", async () => {
    fetchMock.mockResolvedValueOnce(okJson(makeFinishedMatch({ id: "2001" })));

    const result = await getMatchById("2001");

    expect(fetchMock).toHaveBeenCalledWith("/api/matches/2001");
    expect(result).toMatchObject({ id: "2001", status: "finished" });
  });

  it("retorna null em 404", async () => {
    fetchMock.mockResolvedValueOnce(errorJson(404, "Partida não encontrada."));

    await expect(getMatchById("999")).resolves.toBeNull();
  });

  it("lança Error em outras falhas HTTP", async () => {
    fetchMock.mockResolvedValueOnce(errorJson(500));

    await expect(getMatchById("1")).rejects.toThrow(/HTTP 500/);
  });

  it("resposta fora do contrato faz rejeitar (ZodError)", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson(makeFinishedMatch({ homeScore: null, awayScore: null })),
    );

    await expect(getMatchById("2001")).rejects.toThrow();
  });
});

describe("getNextScheduledMatch (derivado de listMatches)", () => {
  // Fixa apenas o relógio (Date) — o filtro de "próximo" depende de Date.now().
  // Mantém timers reais para não interferir nas promises do fetch mock.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-12T00:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("filtra scheduled FUTUROS, ordena kickoffAt asc e devolve o primeiro", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson([
        makeFinishedMatch({ id: "f1" }),
        makeScheduledMatch({ id: "s-late", kickoffAt: "2026-07-01T20:00:00.000Z" }),
        makeScheduledMatch({ id: "s-early", kickoffAt: "2026-06-12T20:00:00.000Z" }),
      ]),
    );

    const result = await getNextScheduledMatch();

    expect(fetchMock).toHaveBeenCalledWith("/api/matches");
    expect(result).toMatchObject({ id: "s-early", status: "scheduled" });
  });

  // Regressão (RC1): a fonte openfootball não popula `score.ft` em tempo real,
  // então um jogo já iniciado/encerrado permanece "scheduled". Sem o filtro de
  // futuro, `getNextScheduledMatch` devolvia esse jogo passado como "próximo".
  it("exclui scheduled já no passado e devolve o próximo futuro", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson([
        makeScheduledMatch({ id: "s-past", kickoffAt: "2026-06-11T13:00:00.000Z" }),
        makeScheduledMatch({ id: "s-future", kickoffAt: "2026-06-13T20:00:00.000Z" }),
      ]),
    );

    const result = await getNextScheduledMatch();

    expect(result).toMatchObject({ id: "s-future", status: "scheduled" });
  });

  it("retorna null quando todos os scheduled já passaram", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson([
        makeScheduledMatch({ id: "s-past1", kickoffAt: "2026-06-11T13:00:00.000Z" }),
        makeScheduledMatch({ id: "s-past2", kickoffAt: "2026-06-10T20:00:00.000Z" }),
      ]),
    );

    await expect(getNextScheduledMatch()).resolves.toBeNull();
  });

  it("retorna null quando não há partidas agendadas", async () => {
    fetchMock.mockResolvedValueOnce(okJson([makeFinishedMatch()]));

    await expect(getNextScheduledMatch()).resolves.toBeNull();
  });

  it("propaga erro HTTP de listMatches", async () => {
    fetchMock.mockResolvedValueOnce(errorJson(502, "Falha na integração."));

    await expect(getNextScheduledMatch()).rejects.toThrow(/HTTP 502/);
  });
});

describe("getRecentFinishedMatches (derivado de listMatches)", () => {
  it("filtra status=finished, ordena kickoffAt desc e limita a 5", async () => {
    const finished = Array.from({ length: 7 }, (_v, i) =>
      makeFinishedMatch({
        id: `fin-${i}`,
        kickoffAt: `2026-06-0${i + 1}T18:00:00.000Z`,
      }),
    );
    fetchMock.mockResolvedValueOnce(
      okJson([...finished, makeScheduledMatch({ id: "sched" })]),
    );

    const result = await getRecentFinishedMatches();

    expect(result).toHaveLength(5);
    // mais recente primeiro: fin-6 (dia 07) … fin-2 (dia 03)
    expect(result[0]).toMatchObject({ id: "fin-6" });
    expect(result[4]).toMatchObject({ id: "fin-2" });
    expect(result.every((m) => m.status === "finished")).toBe(true);
  });

  it("retorna array vazio quando não há partidas finalizadas", async () => {
    fetchMock.mockResolvedValueOnce(okJson([makeScheduledMatch()]));

    await expect(getRecentFinishedMatches()).resolves.toEqual([]);
  });

  it("propaga erro HTTP de listMatches", async () => {
    fetchMock.mockResolvedValueOnce(errorJson(504, "Timeout."));

    await expect(getRecentFinishedMatches()).rejects.toThrow(/HTTP 504/);
  });
});
