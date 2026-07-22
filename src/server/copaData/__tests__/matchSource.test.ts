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

const {
  getFirestoreMock,
  fetchScheduleMock,
  mapEspnEventsToMatchesMock,
  mapEspnEventsToLeagueMatchesMock,
  getChampionshipStatusMock,
} = vi.hoisted(() => ({
  getFirestoreMock: vi.fn(),
  fetchScheduleMock: vi.fn(),
  mapEspnEventsToMatchesMock: vi.fn(),
  mapEspnEventsToLeagueMatchesMock: vi.fn(),
  getChampionshipStatusMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/copaData", () => ({
  EspnScoreClient: class {
    fetchSchedule = fetchScheduleMock;
  },
  mapEspnEventsToMatches: mapEspnEventsToMatchesMock,
  mapEspnEventsToLeagueMatches: mapEspnEventsToLeagueMatchesMock,
}));
vi.mock("@/server/copaData/championshipState", () => ({
  getChampionshipStatus: getChampionshipStatusMock,
}));
vi.mock("@/server/firebaseAdmin", () => ({ getAdminFirestore: getFirestoreMock }));

import { getEffectiveMatches } from "@/server/copaData/matchSource";
import type { MatchWithId } from "@/types/matches";

function baseMatch(id: string, over: Partial<MatchWithId> = {}): MatchWithId {
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
  mapEspnEventsToLeagueMatchesMock.mockReturnValue([baseMatch("m1")]);
  // Default de status: não-arquivado (caminho ESPN). Testes archived sobrescrevem.
  getChampionshipStatusMock.mockResolvedValue("upcoming");
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

/**
 * TASK-14 — precedência de leitura banco-first para campeonatos ARQUIVADOS.
 *
 * Regra: `getEffectiveMatches` ramifica por status resolvido em runtime
 * (`getChampionshipStatus`). Só LIGA (`type: "league"`) não-legada `archived` COM
 * snapshot é servida 100% do DB (`matches/{id}`), ESPN ignorada, SEM filtro
 * manual-only (o snapshot É o schedule completo) e ORDENADA por kickoffAt. Sem
 * snapshot → erro claro. CUP não-legado arquivado NÃO vai DB-first (mapper de cup
 * não carimba championshipId/ids namespaced → snapshot mistaggeado; segue ESPN até
 * o namespacing de cup). LEGADO (`fifa.world`) também NUNCA vai DB-first (compat).
 *
 * Fixtures: `bra.1-2026` = liga não-legada; `uefa.euro-2026` = cup não-legado;
 * `fifa.world` = legado.
 */
const NONLEGACY_LEAGUE = "bra.1-2026";
const NONLEGACY_CUP = "uefa.euro-2026";

/** Doc persistido completo de uma liga (schedule congelado). */
function champDoc(
  id: string,
  championshipId: string,
  over: Record<string, unknown> = {},
) {
  return persistedDoc(id, {
    championshipId,
    homeTeamId: "ITA",
    awayTeamId: "GER",
    kickoffAt: "2026-06-15T18:00:00Z",
    stage: "grupos",
    status: "finished",
    homeScore: 2,
    awayScore: 1,
    ...over,
  });
}

describe("getEffectiveMatches — banco-first para arquivados (TASK-14)", () => {
  it("A1: liga archived + snapshot → serve do DB (ordenado por kickoffAt), ESPN NÃO chamada", async () => {
    getChampionshipStatusMock.mockResolvedValue("archived");
    // ESPN retornaria isto — não deve aparecer no resultado.
    mapEspnEventsToLeagueMatchesMock.mockReturnValue([baseMatch("espnOnly")]);
    // Inserção fora de ordem cronológica: db-late antes de db-early.
    mockPersisted([
      champDoc("db-late", NONLEGACY_LEAGUE, { kickoffAt: "2026-08-01T18:00:00Z" }),
      champDoc("db-early", NONLEGACY_LEAGUE, { kickoffAt: "2026-05-01T18:00:00Z" }),
    ]);

    const result = await getEffectiveMatches(NONLEGACY_LEAGUE);

    // Ordenado por kickoffAt, não por ordem de doc-id/inserção.
    expect(result.map((m) => m.id)).toEqual(["db-early", "db-late"]);
    expect(result.some((m) => m.id === "espnOnly")).toBe(false);
    expect(fetchScheduleMock).not.toHaveBeenCalled();
  });

  it("A2: liga archived → devolve docs SEM isManualOverride (schedule completo, não overlay)", async () => {
    getChampionshipStatusMock.mockResolvedValue("archived");
    mockPersisted([
      champDoc("db1", NONLEGACY_LEAGUE /* sem isManualOverride */),
      champDoc("db2", NONLEGACY_LEAGUE, { isManualOverride: false }),
    ]);

    const result = await getEffectiveMatches(NONLEGACY_LEAGUE);

    expect(result.map((m) => m.id).sort()).toEqual(["db1", "db2"]);
  });

  it("A3: liga archived filtra por championshipId (docs de outro campeonato não vazam)", async () => {
    getChampionshipStatusMock.mockResolvedValue("archived");
    mockPersisted([
      champDoc("mine", NONLEGACY_LEAGUE),
      champDoc("foreign", "eng.1-2026"),
    ]);

    const result = await getEffectiveMatches(NONLEGACY_LEAGUE);

    expect(result.map((m) => m.id)).toEqual(["mine"]);
  });

  it("A4: liga archived SEM snapshot → erro claro", async () => {
    getChampionshipStatusMock.mockResolvedValue("archived");
    mockPersisted([]); // nenhum doc da liga

    await expect(getEffectiveMatches(NONLEGACY_LEAGUE)).rejects.toThrow(
      /arquivad|snapshot/i,
    );
    expect(fetchScheduleMock).not.toHaveBeenCalled();
  });

  it("A4b (gate de tipo): CUP não-legado archived NÃO vai DB-first → segue ESPN (não lança)", async () => {
    getChampionshipStatusMock.mockResolvedValue("archived");
    mapEspnEventsToMatchesMock.mockReturnValue([baseMatch("e1", { championshipId: NONLEGACY_CUP })]);
    mockPersisted([]); // sem snapshot; NÃO deve lançar por causa do gate de tipo

    const result = await getEffectiveMatches(NONLEGACY_CUP);

    // Cup usa o mapper Copa (ESPN), não o branch banco-first.
    expect(fetchScheduleMock).toHaveBeenCalledTimes(1);
    expect(result.map((m) => m.id)).toEqual(["e1"]);
  });

  it("A5 (compat): legado fifa.world archived + snapshot → segue ESPN+overlay, NÃO vai DB-first", async () => {
    getChampionshipStatusMock.mockResolvedValue("archived");
    mapEspnEventsToMatchesMock.mockReturnValue([baseMatch("m1"), baseMatch("m2")]);
    mockPersisted([
      persistedDoc("m1", {
        championshipId: "fifa.world",
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

    const result = await getEffectiveMatches("fifa.world");

    // ESPN foi usada (base) e o override venceu — comportamento legado intacto.
    expect(fetchScheduleMock).toHaveBeenCalledTimes(1);
    expect(result.find((m) => m.id === "m1")!.homeScore).toBe(3);
    expect(result.find((m) => m.id === "m2")!.status).toBe("scheduled");
  });

  it("A6: liga NÃO-arquivada (upcoming) → caminho ESPN+overlay", async () => {
    getChampionshipStatusMock.mockResolvedValue("upcoming");
    mapEspnEventsToLeagueMatchesMock.mockReturnValue([
      baseMatch("e1", { championshipId: NONLEGACY_LEAGUE }),
    ]);
    mockPersisted([]);

    const result = await getEffectiveMatches(NONLEGACY_LEAGUE);

    expect(fetchScheduleMock).toHaveBeenCalledTimes(1);
    expect(result.map((m) => m.id)).toEqual(["e1"]);
  });

  it("A7 (curto-circuito): legado NÃO resolve status em runtime (sem leitura extra)", async () => {
    mapEspnEventsToMatchesMock.mockReturnValue([baseMatch("m1")]);
    mockPersisted([]);

    await getEffectiveMatches("fifa.world");

    // Compat: o caminho legado nunca consulta `getChampionshipStatus`.
    expect(getChampionshipStatusMock).not.toHaveBeenCalled();
  });

  it("A8: liga archived + leitura de 'matches' falha → erro propaga (sem fabricar da ESPN)", async () => {
    getChampionshipStatusMock.mockResolvedValue("archived");
    mockFirestoreDown();

    await expect(getEffectiveMatches(NONLEGACY_LEAGUE)).rejects.toThrow("firestore down");
    expect(fetchScheduleMock).not.toHaveBeenCalled();
  });
});
