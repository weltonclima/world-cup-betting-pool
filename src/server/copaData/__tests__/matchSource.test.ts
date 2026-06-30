/**
 * Testes da pipeline de partidas efetivas — ESPN como ÚNICA fonte (PRD-13 TASK-05,
 * revisado: openfootball removido por decisão do produto "sempre usar ESPN").
 *
 * `getEffectiveMatches` = ESPN (base) → overrides manuais. Precedência: `manual > ESPN`.
 *
 * Garantias críticas:
 *  1. ESPN ok → base = mapEspnEventsToMatches(fetchSchedule());
 *  2. override `isManualOverride === true` SEMPRE vence a base;
 *  3. doc SEM override NÃO sobrescreve a base;
 *  4. Firestore-down → base ESPN sem overrides, não lança;
 *  5. override de partida ausente da base é preservado (append defensivo);
 *  6. doc malformado é ignorado;
 *  7. ESPN falha (fetch OU mapping) → erro PROPAGA (sem fallback openfootball).
 *
 * Mocks: barrel `@/server/copaData` (EspnScoreClient + mapEspnEventsToMatches) num
 * único namespace — evita o conflito vitest de mockar barrel + submódulo.
 * `getAdminFirestore`, `server-only`. `matchSchema` é REAL.
 * EspnScoreClient é `class {}` (não `vi.fn(() => obj)`) — ver memória.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { getFirestoreMock, fetchScheduleMock, mapEspnEventsToMatchesMock } =
  vi.hoisted(() => ({
    getFirestoreMock: vi.fn(),
    fetchScheduleMock: vi.fn(),
    mapEspnEventsToMatchesMock: vi.fn(),
  }));

vi.mock("server-only", () => ({}));
vi.mock("@/server/copaData", () => ({
  EspnScoreClient: class {
    fetchSchedule = fetchScheduleMock;
  },
  mapEspnEventsToMatches: mapEspnEventsToMatchesMock,
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

function mockFirestoreDown(): void {
  getFirestoreMock.mockReturnValue({
    collection: () => ({
      get: async () => {
        throw new Error("firestore down");
      },
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: ESPN ok com 1 evento mapeado.
  fetchScheduleMock.mockResolvedValue([{ id: "e1" }]);
  mapEspnEventsToMatchesMock.mockReturnValue([baseMatch("m1")]);
});

describe("getEffectiveMatches — ESPN como fonte única (TASK-05)", () => {
  it("T1: ESPN ok, sem overrides → base ESPN", async () => {
    mapEspnEventsToMatchesMock.mockReturnValue([baseMatch("e1"), baseMatch("e2")]);
    mockPersisted([]);

    const result = await getEffectiveMatches();

    expect(result.map((m) => m.id)).toEqual(["e1", "e2"]);
    expect(fetchScheduleMock).toHaveBeenCalledTimes(1);
  });

  it("T2: ESPN ok, override isManualOverride=true vence a base", async () => {
    mapEspnEventsToMatchesMock.mockReturnValue([baseMatch("m1"), baseMatch("m2")]);
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
    expect(result.find((m) => m.id === "m2")!.status).toBe("scheduled");
  });

  it("T3: ESPN ok, doc sem override (isManualOverride=false) → base ESPN preservada", async () => {
    mapEspnEventsToMatchesMock.mockReturnValue([
      baseMatch("m1", { status: "live", homeScore: 0, awayScore: 0 }),
    ]);
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

    expect(result[0]!.status).toBe("live");
    expect(result[0]!.homeScore).toBe(0);
  });

  it("T4: ESPN falha (fetchSchedule rejeita) → erro propaga (sem fallback)", async () => {
    fetchScheduleMock.mockRejectedValue(new Error("espn down"));
    mockPersisted([]);

    await expect(getEffectiveMatches()).rejects.toThrow("espn down");
  });

  it("T5: ESPN falha (mapEspnEventsToMatches lança) → erro propaga (sem fallback)", async () => {
    fetchScheduleMock.mockResolvedValue([{ id: "e1" }]);
    mapEspnEventsToMatchesMock.mockImplementation(() => {
      throw new Error("stage desconhecido");
    });

    await expect(getEffectiveMatches()).rejects.toThrow("stage desconhecido");
  });

  it("T6: ESPN ok + Firestore down → base ESPN, console.error 1×", async () => {
    mapEspnEventsToMatchesMock.mockReturnValue([
      baseMatch("m1", { status: "live", homeScore: 1, awayScore: 1 }),
    ]);
    mockFirestoreDown();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await getEffectiveMatches();

    expect(result[0]!.status).toBe("live");
    expect(result[0]!.homeScore).toBe(1);
    expect(errSpy).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });

  it("T7: override de partida ausente da base é preservado (append defensivo)", async () => {
    mapEspnEventsToMatchesMock.mockReturnValue([baseMatch("m1")]);
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

  it("T8: doc malformado no Firestore é ignorado, base ESPN mantida", async () => {
    mapEspnEventsToMatchesMock.mockReturnValue([baseMatch("m1")]);
    mockPersisted([
      persistedDoc("m1", { status: "finished" /* faltam campos obrigatórios */ }),
    ]);

    const result = await getEffectiveMatches();

    expect(result[0]!.status).toBe("scheduled");
  });
});
