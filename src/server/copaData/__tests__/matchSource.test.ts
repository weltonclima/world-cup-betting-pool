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

const { fetchAllMatchesMock, getFirestoreMock } = vi.hoisted(() => ({
  fetchAllMatchesMock: vi.fn(),
  getFirestoreMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/copaData", () => ({ fetchAllMatches: fetchAllMatchesMock }));
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
