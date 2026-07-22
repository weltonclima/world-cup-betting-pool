/**
 * TASK-05 — `getEffectiveMatches`/`readPersistedMatches` escopados por campeonato.
 *
 * Garantias:
 *  1. sem arg → "fifa.world" (compat) → mapper Copa + slug "fifa.world";
 *  2. campeonato de liga → EspnScoreClient com o espnSlug da liga + mapper de liga;
 *  3. campeonato inexistente → erro claro;
 *  4. readPersistedMatches filtra overrides pelo championshipId (legado sem o
 *     campo conta como "fifa.world").
 *
 * getChampionship e deriveRanges são REAIS (catálogo/derivação de verdade); só o
 * cliente ESPN e os mappers são mockados. EspnScoreClient captura o slug do
 * construtor. Mock do barrel num único namespace (memória: barrel+submódulo).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getFirestoreMock,
  fetchScheduleMock,
  mapCopaMock,
  mapLeagueMock,
  constructedSlugs,
} = vi.hoisted(() => ({
  getFirestoreMock: vi.fn(),
  fetchScheduleMock: vi.fn(),
  mapCopaMock: vi.fn(),
  mapLeagueMock: vi.fn(),
  constructedSlugs: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/copaData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/copaData")>();
  return {
    ...actual,
    EspnScoreClient: class {
      constructor(slug = "fifa.world") {
        constructedSlugs.push(slug);
      }
      fetchSchedule = fetchScheduleMock;
    },
    mapEspnEventsToMatches: mapCopaMock,
    mapEspnEventsToLeagueMatches: mapLeagueMock,
  };
});
vi.mock("@/server/firebaseAdmin", () => ({ getAdminFirestore: getFirestoreMock }));

import {
  getEffectiveMatches,
  readPersistedMatches,
} from "@/server/copaData/matchSource";
import type { MatchWithId } from "@/types/matches";

function match(id: string, over: Partial<MatchWithId> = {}): MatchWithId {
  return {
    id,
    championshipId: "fifa.world",
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
  constructedSlugs.length = 0;
  fetchScheduleMock.mockResolvedValue([{ id: "e1" }]);
  mapCopaMock.mockReturnValue([match("m1")]);
  mapLeagueMock.mockReturnValue([
    match("bra.1-2026:701001", { championshipId: "bra.1-2026", stage: "liga" }),
  ]);
  mockPersisted([]);
});

describe("getEffectiveMatches escopado (TASK-05)", () => {
  it("sem arg → fifa.world: slug 'fifa.world' + mapper Copa", async () => {
    await getEffectiveMatches();
    expect(constructedSlugs).toEqual(["fifa.world"]);
    expect(mapCopaMock).toHaveBeenCalledTimes(1);
    expect(mapLeagueMock).not.toHaveBeenCalled();
  });

  it("campeonato de liga → slug da liga + mapper de liga", async () => {
    const result = await getEffectiveMatches("bra.1-2026");
    expect(constructedSlugs).toEqual(["bra.1"]);
    expect(mapLeagueMock).toHaveBeenCalledTimes(1);
    expect(mapCopaMock).not.toHaveBeenCalled();
    expect(result.map((m) => m.id)).toEqual(["bra.1-2026:701001"]);
  });

  it("campeonato inexistente lança erro claro", async () => {
    await expect(getEffectiveMatches("nao.existe-9999")).rejects.toThrow(
      /nao\.existe-9999/,
    );
  });
});

describe("readPersistedMatches filtra por championshipId (TASK-05)", () => {
  const legacy = {
    homeTeamId: "BRA",
    awayTeamId: "ARG",
    kickoffAt: "2026-06-11T12:00:00Z",
    stage: "grupos",
    status: "finished",
    homeScore: 1,
    awayScore: 0,
    isManualOverride: true,
    // sem championshipId → default "fifa.world"
  };
  const braDoc = {
    championshipId: "bra.1-2026",
    homeTeamId: "83",
    awayTeamId: "133",
    kickoffAt: "2026-05-10T20:00:00Z",
    stage: "liga",
    status: "finished",
    homeScore: 2,
    awayScore: 1,
    isManualOverride: true,
  };

  it("fifa.world inclui doc legado (sem campo) e exclui doc de outra liga", async () => {
    mockPersisted([persistedDoc("m1", legacy), persistedDoc("bra.1-2026:x", braDoc)]);
    const map = await readPersistedMatches("fifa.world");
    expect(map.has("m1")).toBe(true);
    expect(map.has("bra.1-2026:x")).toBe(false);
  });

  it("bra.1-2026 inclui só o doc da liga", async () => {
    mockPersisted([persistedDoc("m1", legacy), persistedDoc("bra.1-2026:x", braDoc)]);
    const map = await readPersistedMatches("bra.1-2026");
    expect(map.has("bra.1-2026:x")).toBe(true);
    expect(map.has("m1")).toBe(false);
  });
});
