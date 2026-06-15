/**
 * Testes da pipeline INVERTIDA de partidas efetivas (PRD-13 TASK-05).
 *
 * `getEffectiveMatches` = ESPN (base) → fallback openfootball → overrides manuais.
 * Precedência: `manual > ESPN > openfootball-fallback`.
 *
 * Garantias críticas:
 *  1. ESPN ok → base = mapEspnEventsToMatches(fetchSchedule()); openfootball NÃO é chamado;
 *  2. ESPN falha (fetch OU mapping) → fallback fetchAllMatches() (openfootball);
 *  3. override `isManualOverride === true` SEMPRE vence a base (qualquer fonte);
 *  4. doc SEM override NÃO sobrescreve a base;
 *  5. Firestore-down → base (ESPN ou openfootball) sem overrides, não lança;
 *  6. override de partida ausente da base é preservado (append defensivo);
 *  7. doc malformado é ignorado.
 *
 * Mocks: barrel `@/server/copaData` (fetchAllMatches + EspnScoreClient +
 * mapEspnEventsToMatches) num único namespace — evita o conflito vitest de mockar
 * barrel + submódulo. `getAdminFirestore`, `server-only`. `matchSchema` é REAL.
 * EspnScoreClient é `class {}` (não `vi.fn(() => obj)`) — ver memória.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchAllMatchesMock,
  getFirestoreMock,
  fetchScheduleMock,
  mapEspnEventsToMatchesMock,
} = vi.hoisted(() => ({
  fetchAllMatchesMock: vi.fn(),
  getFirestoreMock: vi.fn(),
  fetchScheduleMock: vi.fn(),
  mapEspnEventsToMatchesMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/copaData", () => ({
  fetchAllMatches: fetchAllMatchesMock,
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
  // Defaults: ESPN ok com 1 evento mapeado; openfootball não configurado de
  // propósito (só é usado no fallback — testes que o exercitam configuram).
  fetchScheduleMock.mockResolvedValue([{ id: "e1" }]);
  mapEspnEventsToMatchesMock.mockReturnValue([baseMatch("m1")]);
});

describe("getEffectiveMatches — ESPN como base (TASK-05)", () => {
  it("T1: ESPN ok, sem overrides → base ESPN, openfootball não chamado", async () => {
    mapEspnEventsToMatchesMock.mockReturnValue([baseMatch("e1"), baseMatch("e2")]);
    mockPersisted([]);

    const result = await getEffectiveMatches();

    expect(result.map((m) => m.id)).toEqual(["e1", "e2"]);
    expect(fetchScheduleMock).toHaveBeenCalledTimes(1);
    expect(fetchAllMatchesMock).not.toHaveBeenCalled();
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

  it("T4: ESPN falha (fetchSchedule rejeita) → fallback openfootball, console.error 1×", async () => {
    fetchScheduleMock.mockRejectedValue(new Error("espn down"));
    fetchAllMatchesMock.mockResolvedValue([baseMatch("of1")]);
    mockPersisted([]);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await getEffectiveMatches();

    expect(result.map((m) => m.id)).toEqual(["of1"]);
    expect(fetchScheduleMock).toHaveBeenCalledTimes(1);
    expect(fetchAllMatchesMock).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });

  it("T5: ESPN falha + override manual → fallback openfootball + override aplicado", async () => {
    fetchScheduleMock.mockRejectedValue(new Error("espn down"));
    fetchAllMatchesMock.mockResolvedValue([baseMatch("of1"), baseMatch("of2")]);
    mockPersisted([
      persistedDoc("of1", {
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
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await getEffectiveMatches();

    const of1 = result.find((m) => m.id === "of1")!;
    expect(of1.status).toBe("finished");
    expect(of1.homeScore).toBe(2);
    expect(result.find((m) => m.id === "of2")!.status).toBe("scheduled");
    errSpy.mockRestore();
  });

  it("T6: ESPN falha + Firestore down → base openfootball, console.error 2×", async () => {
    fetchScheduleMock.mockRejectedValue(new Error("espn down"));
    fetchAllMatchesMock.mockResolvedValue([baseMatch("of1")]);
    mockFirestoreDown();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await getEffectiveMatches();

    expect(result.map((m) => m.id)).toEqual(["of1"]);
    expect(errSpy).toHaveBeenCalledTimes(2); // ESPN + Firestore
    errSpy.mockRestore();
  });

  it("T7: ESPN ok + Firestore down → base ESPN, console.error 1×", async () => {
    mapEspnEventsToMatchesMock.mockReturnValue([
      baseMatch("m1", { status: "live", homeScore: 1, awayScore: 1 }),
    ]);
    mockFirestoreDown();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await getEffectiveMatches();

    expect(result[0]!.status).toBe("live");
    expect(result[0]!.homeScore).toBe(1);
    expect(fetchAllMatchesMock).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });

  it("T8: override de partida ausente da base é preservado (append defensivo)", async () => {
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

  it("T9: doc malformado no Firestore é ignorado, base ESPN mantida", async () => {
    mapEspnEventsToMatchesMock.mockReturnValue([baseMatch("m1")]);
    mockPersisted([
      persistedDoc("m1", { status: "finished" /* faltam campos obrigatórios */ }),
    ]);

    const result = await getEffectiveMatches();

    expect(result[0]!.status).toBe("scheduled");
  });

  it("T10: REGRESSÃO — mapEspnEventsToMatches lança → fallback openfootball", async () => {
    // Mapping fail é uma falha ESPN tanto quanto fetch fail: deve cair no fallback.
    fetchScheduleMock.mockResolvedValue([{ id: "e1" }]);
    mapEspnEventsToMatchesMock.mockImplementation(() => {
      throw new Error("stage desconhecido");
    });
    fetchAllMatchesMock.mockResolvedValue([baseMatch("of1")]);
    mockPersisted([]);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await getEffectiveMatches();

    expect(result.map((m) => m.id)).toEqual(["of1"]);
    expect(fetchAllMatchesMock).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });
});
