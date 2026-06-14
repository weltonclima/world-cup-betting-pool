/**
 * Testes da estratégia OVERLAY de partidas efetivas (PRD-11 TASK-01).
 *
 * `getEffectiveMatches` = openfootball (base) + overrides manuais persistidos.
 * Garantias críticas (sem regressão):
 *  1. coleção vazia → base inalterada (comportamento idêntico ao de hoje);
 *  2. override `isManualOverride === true` SEMPRE vence a base;
 *  3. doc persistido SEM override (sync puro) NÃO sobrescreve a base;
 *  4. falha lendo o Firestore → cai para a base ao vivo (resiliente);
 *  5. override de partida ausente da base é preservado (append defensivo);
 *  6. doc malformado é ignorado (não derruba o merge).
 *
 * Mocks: `fetchAllMatches` (base), `getAdminFirestore` (coleção persistida),
 * `server-only`. O `matchSchema` é REAL — exercita o parse de verdade.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAllMatchesMock, getFirestoreMock, fetchScoreboardMock, buildEspnPatchMapMock } =
  vi.hoisted(() => ({
    fetchAllMatchesMock: vi.fn(),
    getFirestoreMock: vi.fn(),
    fetchScoreboardMock: vi.fn(),
    buildEspnPatchMapMock: vi.fn(),
  }));

vi.mock("server-only", () => ({}));
// Barrel copaData: fetchAllMatches + pipeline ESPN (cliente HTTP e matcher)
// mockados juntos — sem rede, sem teamRegistry real. Um único mock para o
// namespace evita o conflito vitest de mockar barrel + submódulo simultaneamente.
vi.mock("@/server/copaData", () => ({
  fetchAllMatches: fetchAllMatchesMock,
  // Classe real (não `vi.fn(() => obj)`): com `new`, a fábrica vi.fn não
  // propaga o objeto retornado, deixando a instância sem `fetchScoreboard`.
  EspnScoreClient: class {
    fetchScoreboard = fetchScoreboardMock;
  },
  buildEspnPatchMap: buildEspnPatchMapMock,
}));
vi.mock("@/server/firebaseAdmin", () => ({ getAdminFirestore: getFirestoreMock }));

import { getEffectiveMatches } from "@/server/copaData/matchSource";
import type { MatchWithId } from "@/types/matches";

function baseMatch(id: string, over: Partial<MatchWithId> = {}): MatchWithId {
  return {
    id,
    homeTeamId: "BRA",
    awayTeamId: "ARG",
    kickoffAt: "2026-06-11T12:00:00Z",
    stage: "grupos",
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    ...over,
  };
}

/** Doc persistido = dados SEM o campo `id` (o id vem do doc do Firestore). */
function persistedDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

function mockPersisted(docs: ReturnType<typeof persistedDoc>[]): void {
  getFirestoreMock.mockReturnValue({
    collection: () => ({ get: async () => ({ docs }) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Defaults ESPN: sem eventos / patch vazio → base inalterada (não interfere
  // nos testes de overlay manual existentes).
  fetchScoreboardMock.mockResolvedValue({ events: [] });
  buildEspnPatchMapMock.mockReturnValue(new Map());
});

describe("getEffectiveMatches (overlay)", () => {
  it("coleção vazia → retorna a base inalterada", async () => {
    fetchAllMatchesMock.mockResolvedValue([baseMatch("m1"), baseMatch("m2")]);
    mockPersisted([]);

    const result = await getEffectiveMatches();

    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(result[0]!.status).toBe("scheduled");
  });

  it("override isManualOverride=true vence a base", async () => {
    fetchAllMatchesMock.mockResolvedValue([baseMatch("m1"), baseMatch("m2")]);
    mockPersisted([
      persistedDoc("m1", {
        homeTeamId: "BRA",
        awayTeamId: "ARG",
        kickoffAt: "2026-06-11T12:00:00Z",
        stage: "grupos",
        status: "finished",
        homeScore: 3,
        awayScore: 1,
        isManualOverride: true,
      }),
    ]);

    const result = await getEffectiveMatches();

    const m1 = result.find((m) => m.id === "m1")!;
    expect(m1.status).toBe("finished");
    expect(m1.homeScore).toBe(3);
    expect(m1.awayScore).toBe(1);
    // m2 segue da base.
    expect(result.find((m) => m.id === "m2")!.status).toBe("scheduled");
  });

  it("doc persistido SEM override (sync puro) NÃO sobrescreve a base", async () => {
    fetchAllMatchesMock.mockResolvedValue([baseMatch("m1", { status: "live", homeScore: 0, awayScore: 0 })]);
    mockPersisted([
      persistedDoc("m1", {
        homeTeamId: "BRA",
        awayTeamId: "ARG",
        kickoffAt: "2026-06-11T12:00:00Z",
        stage: "grupos",
        status: "finished",
        homeScore: 9,
        awayScore: 9,
        isManualOverride: false,
      }),
    ]);

    const result = await getEffectiveMatches();

    // Base ao vivo (live 0x0) preservada — o doc sem override é ignorado.
    expect(result[0]!.status).toBe("live");
    expect(result[0]!.homeScore).toBe(0);
  });

  it("falha lendo o Firestore → cai para a base ao vivo", async () => {
    fetchAllMatchesMock.mockResolvedValue([baseMatch("m1")]);
    getFirestoreMock.mockReturnValue({
      collection: () => ({
        get: async () => {
          throw new Error("firestore down");
        },
      }),
    });

    const result = await getEffectiveMatches();

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("m1");
  });

  it("override de partida ausente da base é preservado (append defensivo)", async () => {
    fetchAllMatchesMock.mockResolvedValue([baseMatch("m1")]);
    mockPersisted([
      persistedDoc("ghost", {
        homeTeamId: "FRA",
        awayTeamId: "ESP",
        kickoffAt: "2026-06-12T12:00:00Z",
        stage: "oitavas",
        status: "finished",
        homeScore: 2,
        awayScore: 0,
        isManualOverride: true,
      }),
    ]);

    const result = await getEffectiveMatches();

    expect(result.map((m) => m.id).sort()).toEqual(["ghost", "m1"]);
  });

  it("doc malformado é ignorado, não derruba o merge", async () => {
    fetchAllMatchesMock.mockResolvedValue([baseMatch("m1")]);
    mockPersisted([
      persistedDoc("m1", { status: "finished" /* faltam campos obrigatórios */ }),
    ]);

    const result = await getEffectiveMatches();

    // Override inválido descartado → base mantida.
    expect(result[0]!.status).toBe("scheduled");
  });
});

describe("getEffectiveMatches (merge ESPN — TASK-06)", () => {
  it("ESPN OK, match sem override → aplica patch e preserva os demais campos", async () => {
    fetchAllMatchesMock.mockResolvedValue([baseMatch("m1")]);
    mockPersisted([]);
    buildEspnPatchMapMock.mockReturnValue(
      new Map([["m1", { status: "live", homeScore: 1, awayScore: 0 }]]),
    );

    const result = await getEffectiveMatches();

    const m1 = result.find((m) => m.id === "m1")!;
    // Patch aplicado.
    expect(m1.status).toBe("live");
    expect(m1.homeScore).toBe(1);
    expect(m1.awayScore).toBe(0);
    // Demais campos da base intactos — ESPN só toca status/placar.
    expect(m1.kickoffAt).toBe("2026-06-11T12:00:00Z");
    expect(m1.stage).toBe("grupos");
    expect(m1.homeTeamId).toBe("BRA");
    expect(m1.awayTeamId).toBe("ARG");
  });

  it("override manual vence o patch ESPN", async () => {
    fetchAllMatchesMock.mockResolvedValue([baseMatch("m1")]);
    mockPersisted([
      persistedDoc("m1", {
        homeTeamId: "BRA",
        awayTeamId: "ARG",
        kickoffAt: "2026-06-11T12:00:00Z",
        stage: "grupos",
        status: "finished",
        homeScore: 3,
        awayScore: 1,
        isManualOverride: true,
      }),
    ]);
    // ESPN tenta sobrescrever — deve ser ignorado.
    buildEspnPatchMapMock.mockReturnValue(
      new Map([["m1", { status: "live", homeScore: 5, awayScore: 5 }]]),
    );

    const result = await getEffectiveMatches();

    const m1 = result.find((m) => m.id === "m1")!;
    expect(m1.status).toBe("finished");
    expect(m1.homeScore).toBe(3);
    expect(m1.awayScore).toBe(1);
  });

  it("matchId ausente do patchMap → base inalterada", async () => {
    fetchAllMatchesMock.mockResolvedValue([baseMatch("m1")]);
    mockPersisted([]);
    buildEspnPatchMapMock.mockReturnValue(
      new Map([["outro", { status: "live", homeScore: 2, awayScore: 2 }]]),
    );

    const result = await getEffectiveMatches();

    expect(result[0]!.status).toBe("scheduled");
    expect(result[0]!.homeScore).toBeNull();
  });

  it("ESPN falha (fetch rejeita) → base preservada, console.error chamado, não lança", async () => {
    fetchAllMatchesMock.mockResolvedValue([baseMatch("m1")]);
    mockPersisted([]);
    fetchScoreboardMock.mockRejectedValue(new Error("espn down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await getEffectiveMatches();

    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe("scheduled");
    expect(errSpy).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });

  it("REGRESSÃO: ESPN down + override manual → saída idêntica ao comportamento atual", async () => {
    fetchAllMatchesMock.mockResolvedValue([baseMatch("m1"), baseMatch("m2")]);
    mockPersisted([
      persistedDoc("m1", {
        homeTeamId: "BRA",
        awayTeamId: "ARG",
        kickoffAt: "2026-06-11T12:00:00Z",
        stage: "grupos",
        status: "finished",
        homeScore: 2,
        awayScore: 0,
        isManualOverride: true,
      }),
    ]);
    fetchScoreboardMock.mockRejectedValue(new Error("espn down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await getEffectiveMatches();

    // Override manual aplicado, m2 da base — exatamente como sem ESPN.
    const m1 = result.find((m) => m.id === "m1")!;
    expect(m1.status).toBe("finished");
    expect(m1.homeScore).toBe(2);
    expect(result.find((m) => m.id === "m2")!.status).toBe("scheduled");
    errSpy.mockRestore();
  });

  it("ESPN up + Firestore down → base com patch ESPN aplicado (degradação resiliente)", async () => {
    fetchAllMatchesMock.mockResolvedValue([baseMatch("m1")]);
    getFirestoreMock.mockReturnValue({
      collection: () => ({
        get: async () => {
          throw new Error("firestore down");
        },
      }),
    });
    buildEspnPatchMapMock.mockReturnValue(
      new Map([["m1", { status: "live", homeScore: 1, awayScore: 1 }]]),
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await getEffectiveMatches();

    // Firestore caiu, mas o live score da ESPN segue aplicado sobre a base.
    expect(result[0]!.status).toBe("live");
    expect(result[0]!.homeScore).toBe(1);
    errSpy.mockRestore();
  });

  it("ESPN up porém sem evento casável (patchMap vazio) → base inalterada", async () => {
    // Distinto de 'ESPN falha': o cliente respondeu OK, mas nenhum evento casou.
    fetchAllMatchesMock.mockResolvedValue([
      baseMatch("m1", { status: "live", homeScore: 0, awayScore: 0 }),
    ]);
    mockPersisted([]);
    buildEspnPatchMapMock.mockReturnValue(new Map());
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await getEffectiveMatches();

    // Branch size===0 de applyEspnPatches: base devolvida intacta, sem erro.
    expect(result[0]!.status).toBe("live");
    expect(result[0]!.homeScore).toBe(0);
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("patch ESPN é seletivo: só os matchIds presentes no mapa mudam", async () => {
    fetchAllMatchesMock.mockResolvedValue([
      baseMatch("m1"),
      baseMatch("m2"),
      baseMatch("m3"),
    ]);
    mockPersisted([]);
    buildEspnPatchMapMock.mockReturnValue(
      new Map([
        ["m1", { status: "live", homeScore: 2, awayScore: 1 }],
        ["m3", { status: "finished", homeScore: 0, awayScore: 0 }],
      ]),
    );

    const result = await getEffectiveMatches();

    const byId = Object.fromEntries(result.map((m) => [m.id, m]));
    expect(byId.m1!.status).toBe("live");
    expect(byId.m1!.homeScore).toBe(2);
    expect(byId.m3!.status).toBe("finished");
    // m2 ausente do mapa → permanece da base.
    expect(byId.m2!.status).toBe("scheduled");
    expect(byId.m2!.homeScore).toBeNull();
  });

  it("scoreboard buscado com a data UTC de hoje no formato YYYYMMDD (acceptance #6)", async () => {
    fetchAllMatchesMock.mockResolvedValue([baseMatch("m1")]);
    mockPersisted([]);

    await getEffectiveMatches();

    expect(fetchScoreboardMock).toHaveBeenCalledTimes(1);
    const arg = fetchScoreboardMock.mock.calls[0]![0] as string;
    expect(arg).toMatch(/^\d{8}$/);
    // Coerente com a data UTC atual (sem acoplar a um dia fixo).
    const expected = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    expect(arg).toBe(expected);
  });
});
