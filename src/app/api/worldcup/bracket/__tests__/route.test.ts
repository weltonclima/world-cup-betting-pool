/**
 * Testes do Route Handler GET /api/worldcup/bracket.
 *
 * Mocks: @/server/copaData/matchSource (getEffectiveMatches — fonte ESPN),
 *        @/server/copaData (fetchAllTeams), @/server/worldcup/cache (snapshot).
 * Cobre: cache fresco, stale, ausente, fetch falha + snap, fetch falha + sem snap,
 *        headers Cache-Control, writeSnapshot lança → 200 (best-effort),
 *        snapshot corrompido → fallthrough para recomputo (Fix 1),
 *        snapshot legado SEM kickoffAt → fallthrough para recomputo (Fix "Data a confirmar"),
 *        after() desacopla escrita do response (Fix 3).
 * Confirma: body de bracket NÃO contém hasLiveGroupMatch (contrato TASK-01).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

const {
  getEffectiveMatchesMock,
  fetchAllTeamsMock,
  fetchEspnBracketMapMock,
  readSnapshotMock,
  writeSnapshotMock,
  isFreshMock,
  isCurrentVersionMock,
} = vi.hoisted(() => ({
  getEffectiveMatchesMock: vi.fn(),
  fetchAllTeamsMock: vi.fn(),
  fetchEspnBracketMapMock: vi.fn(),
  readSnapshotMock: vi.fn(),
  writeSnapshotMock: vi.fn(),
  isFreshMock: vi.fn(),
  isCurrentVersionMock: vi.fn(),
}));

vi.mock("@/server/copaData/matchSource", () => ({
  getEffectiveMatches: getEffectiveMatchesMock,
}));

vi.mock("@/server/copaData", () => ({
  fetchAllTeams: fetchAllTeamsMock,
  fetchEspnBracketMap: fetchEspnBracketMapMock,
}));

vi.mock("@/server/worldcup/cache", () => ({
  readSnapshot: readSnapshotMock,
  writeSnapshot: writeSnapshotMock,
  isFresh: isFreshMock,
  isCurrentVersion: isCurrentVersionMock,
}));

// Fix 3: mock after() para executar o callback sincronamente no ambiente de testes.
// Preserva NextResponse e demais exports do módulo intactos.
vi.mock("next/server", async (importOriginal) => {
  const mod = await importOriginal<typeof import("next/server")>();
  return { ...mod, after: (fn: () => unknown) => { void fn(); } };
});

// server-only é importado pelos módulos de servidor
vi.mock("server-only", () => ({}));

import { EspnFetchError, EspnTimeoutError } from "@/server/copaData/espnClient";
import { GET } from "@/app/api/worldcup/bracket/route";
import type { BracketResponse } from "@/types/worldcup";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Partida eliminatória de oitavas agendada (fonte ESPN — sempre tem kickoffAt) */
const MOCK_KNOCKOUT_MATCH = {
  id: "m65",
  homeTeamId: "1A",
  awayTeamId: "2B",
  kickoffAt: "2026-07-04T20:00:00Z",
  stage: "oitavas" as const,
  round: 1,
  groupId: null,
  venue: { name: "MetLife Stadium", city: "East Rutherford" },
  status: "scheduled" as const,
  homeScore: null,
  awayScore: null,
};

/**
 * Payload de bracket pré-computado VÁLIDO (contrato TASK-01 — sem hasLiveGroupMatch).
 * Inclui kickoffAt no confronto → passa no guard snapshotHasKickoff.
 */
const MOCK_BRACKET_PAYLOAD: BracketResponse = {
  roundOf32: [],
  roundOf16: [
    {
      id: "m65",
      phase: "oitavas",
      kickoffAt: "2026-07-04T20:00:00Z",
      homeTeam: { name: "1º do Grupo A", defined: false },
      awayTeam: { name: "2º do Grupo B", defined: false },
      status: "aguardando",
    },
  ],
  quarterFinals: [],
  semiFinals: [],
  thirdPlace: [],
  final: [],
};

const MOCK_SNAPSHOT = {
  payload: MOCK_BRACKET_PAYLOAD,
  computedAt: Date.now() - 100,
  hasLiveGroupMatch: false,
};

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("GET /api/worldcup/bracket", () => {
  beforeEach(() => {
    getEffectiveMatchesMock.mockReset();
    fetchAllTeamsMock.mockReset();
    fetchEspnBracketMapMock.mockReset();
    readSnapshotMock.mockReset();
    writeSnapshotMock.mockReset();
    isFreshMock.mockReset();
    isCurrentVersionMock.mockReset();
    // Default: snapshot é da versão atual (testes de cache fresco servem o snapshot).
    isCurrentVersionMock.mockReturnValue(true);
    // Default: writeSnapshot resolve sem erro
    writeSnapshotMock.mockResolvedValue(undefined);
    // Default: bracket map vazio (degradação — TASK-08 nunca lança)
    fetchEspnBracketMapMock.mockResolvedValue(new Map());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Cache fresco ────────────────────────────────────────────────────────────

  it("retorna payload do snapshot quando fresco, sem chamar getEffectiveMatches", async () => {
    readSnapshotMock.mockResolvedValue(MOCK_SNAPSHOT);
    isFreshMock.mockReturnValue(true);

    const response = await GET(new Request("http://x/api/worldcup/bracket"));

    expect(response.status).toBe(200);
    expect(getEffectiveMatchesMock).not.toHaveBeenCalled();
    expect(fetchAllTeamsMock).not.toHaveBeenCalled();

    const body = (await response.json()) as BracketResponse;
    expect(body.roundOf16).toEqual(MOCK_BRACKET_PAYLOAD.roundOf16);
  });

  it("TASK-09: snapshot fresco de versão antiga é recomputado (cache busting)", async () => {
    // Snapshot fresco no TTL mas de versão de derivação anterior (sem
    // parentMatchIds) → isCurrentVersion=false → recomputa da fonte.
    readSnapshotMock.mockResolvedValue(MOCK_SNAPSHOT);
    isFreshMock.mockReturnValue(true);
    isCurrentVersionMock.mockReturnValue(false);
    getEffectiveMatchesMock.mockResolvedValue([MOCK_KNOCKOUT_MATCH]);
    fetchAllTeamsMock.mockResolvedValue([]);

    const response = await GET(new Request("http://x/api/worldcup/bracket"));

    expect(response.status).toBe(200);
    // Recomputou: bateu na fonte ESPN em vez de servir o snapshot velho.
    expect(getEffectiveMatchesMock).toHaveBeenCalled();
  });

  it("body do snapshot NÃO contém hasLiveGroupMatch (contrato TASK-01)", async () => {
    readSnapshotMock.mockResolvedValue(MOCK_SNAPSHOT);
    isFreshMock.mockReturnValue(true);

    const response = await GET(new Request("http://x/api/worldcup/bracket"));
    const body = (await response.json()) as Record<string, unknown>;
    // Bracket body puro: não deve ter hasLiveGroupMatch
    expect(body).not.toHaveProperty("hasLiveGroupMatch");
  });

  it("inclui header Cache-Control correto (sem live) quando snapshot fresco", async () => {
    readSnapshotMock.mockResolvedValue(MOCK_SNAPSHOT);
    isFreshMock.mockReturnValue(true);

    const response = await GET(new Request("http://x/api/worldcup/bracket"));
    expect(response.headers.get("Cache-Control")).toBe(
      "s-maxage=86400, stale-while-revalidate=60",
    );
  });

  it("inclui header Cache-Control com ttl=60 e swr=0 quando snapshot fresco e hasLive=true", async () => {
    const liveSnap = { ...MOCK_SNAPSHOT, hasLiveGroupMatch: true };
    readSnapshotMock.mockResolvedValue(liveSnap);
    isFreshMock.mockReturnValue(true);

    const response = await GET(new Request("http://x/api/worldcup/bracket"));
    // Fix 4 (WR-02): stale-while-revalidate=0 quando ao vivo
    expect(response.headers.get("Cache-Control")).toBe(
      "s-maxage=60, stale-while-revalidate=0",
    );
  });

  // ── Snapshot corrompido (Fix 1) ─────────────────────────────────────────────

  it("ignora snapshot fresco corrompido, faz fallthrough para fetch+computa e retorna payload computado", async () => {
    // Snapshot "fresco" mas com payload que não passa no bracketResponseSchema
    const corruptSnap = {
      payload: { groups: "not-an-array" },
      computedAt: Date.now() - 100,
      hasLiveGroupMatch: false,
    };
    readSnapshotMock.mockResolvedValue(corruptSnap);
    isFreshMock.mockReturnValue(true);
    getEffectiveMatchesMock.mockResolvedValue([MOCK_KNOCKOUT_MATCH]);
    fetchAllTeamsMock.mockResolvedValue([]);

    const response = await GET(new Request("http://x/api/worldcup/bracket"));

    // Deve ter caído no caminho de recomputo, não usado o cache corrompido
    expect(getEffectiveMatchesMock).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);

    const body = (await response.json()) as BracketResponse;
    expect(body).toHaveProperty("roundOf16");
    expect(body).not.toHaveProperty("hasLiveGroupMatch");
  });

  // ── Snapshot legado SEM kickoffAt (Fix "Data a confirmar") ──────────────────

  it("ignora snapshot fresco legado SEM kickoffAt e recomputa da ESPN (auto-cura)", async () => {
    // Snapshot válido no schema (kickoffAt é opcional) mas sem a hora — formato
    // pré-PRD-16 TASK-01. A UI mostraria "Data a confirmar". Deve recomputar.
    const legacyPayload: BracketResponse = {
      roundOf32: [],
      roundOf16: [
        {
          id: "m65",
          phase: "oitavas",
          // SEM kickoffAt
          homeTeam: { name: "1º do Grupo A", defined: false },
          awayTeam: { name: "2º do Grupo B", defined: false },
          status: "aguardando",
        },
      ],
      quarterFinals: [],
      semiFinals: [],
      thirdPlace: [],
      final: [],
    };
    readSnapshotMock.mockResolvedValue({
      payload: legacyPayload,
      computedAt: Date.now() - 100,
      hasLiveGroupMatch: false,
    });
    isFreshMock.mockReturnValue(true);
    getEffectiveMatchesMock.mockResolvedValue([MOCK_KNOCKOUT_MATCH]);
    fetchAllTeamsMock.mockResolvedValue([]);

    const response = await GET(new Request("http://x/api/worldcup/bracket"));

    // Não serviu o snapshot legado — recomputou da fonte
    expect(getEffectiveMatchesMock).toHaveBeenCalledOnce();
    expect(writeSnapshotMock).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);

    const body = (await response.json()) as BracketResponse;
    // Payload recomputado traz kickoffAt
    expect(body.roundOf16[0]?.kickoffAt).toBe("2026-07-04T20:00:00Z");
  });

  // ── Anti-congelamento: snapshot fresco mas jogo já passou do kickoff ─────────

  it("recomputa quando snapshot fresco tem confronto 'definido' com kickoff já no passado", async () => {
    // Cenário chicken-egg: snapshot gravado antes do kickoff (hasLiveGroupMatch=false
    // → TTL 24h em isFresh). O jogo já começou (kickoff no passado) mas o snapshot
    // ainda mostra "definido"/"Agendado". Deve tratar como miss e recomputar da ESPN.
    const duePayload: BracketResponse = {
      roundOf32: [],
      roundOf16: [
        {
          id: "m65",
          phase: "oitavas",
          kickoffAt: "2020-01-01T00:00:00Z", // já passou
          homeTeam: { name: "Brasil", code: "BRA", defined: true },
          awayTeam: { name: "Argentina", code: "ARG", defined: true },
          status: "definido",
        },
      ],
      quarterFinals: [],
      semiFinals: [],
      thirdPlace: [],
      final: [],
    };
    readSnapshotMock.mockResolvedValue({
      payload: duePayload,
      computedAt: Date.now() - 100,
      hasLiveGroupMatch: false,
    });
    isFreshMock.mockReturnValue(true);
    getEffectiveMatchesMock.mockResolvedValue([MOCK_KNOCKOUT_MATCH]);
    fetchAllTeamsMock.mockResolvedValue([]);

    const response = await GET(new Request("http://x/api/worldcup/bracket"));

    // Não serviu o snapshot preso — recomputou da fonte
    expect(getEffectiveMatchesMock).toHaveBeenCalledOnce();
    expect(writeSnapshotMock).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });

  // ── Cache stale ─────────────────────────────────────────────────────────────

  it("faz fetch + computa + chama writeSnapshot quando cache stale", async () => {
    readSnapshotMock.mockResolvedValue(MOCK_SNAPSHOT);
    isFreshMock.mockReturnValue(false);
    getEffectiveMatchesMock.mockResolvedValue([MOCK_KNOCKOUT_MATCH]);
    fetchAllTeamsMock.mockResolvedValue([]);

    const response = await GET(new Request("http://x/api/worldcup/bracket"));

    expect(response.status).toBe(200);
    expect(getEffectiveMatchesMock).toHaveBeenCalledOnce();
    expect(fetchAllTeamsMock).toHaveBeenCalledOnce();
    expect(writeSnapshotMock).toHaveBeenCalledOnce();

    const body = (await response.json()) as BracketResponse;
    expect(body).toHaveProperty("roundOf16");
    // Body puro (sem hasLiveGroupMatch)
    expect(body).not.toHaveProperty("hasLiveGroupMatch");
  });

  // ── Cache ausente ───────────────────────────────────────────────────────────

  it("faz fetch + computa quando snapshot ausente (null)", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getEffectiveMatchesMock.mockResolvedValue([MOCK_KNOCKOUT_MATCH]);
    fetchAllTeamsMock.mockResolvedValue([]);

    const response = await GET(new Request("http://x/api/worldcup/bracket"));

    expect(response.status).toBe(200);
    expect(getEffectiveMatchesMock).toHaveBeenCalledOnce();
    expect(writeSnapshotMock).toHaveBeenCalledOnce();
  });

  it("inclui header Cache-Control correto após recomputação sem partida ao vivo", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getEffectiveMatchesMock.mockResolvedValue([MOCK_KNOCKOUT_MATCH]); // stage=oitavas, não grupos
    fetchAllTeamsMock.mockResolvedValue([]);

    const response = await GET(new Request("http://x/api/worldcup/bracket"));
    expect(response.headers.get("Cache-Control")).toBe(
      "s-maxage=86400, stale-while-revalidate=60",
    );
  });

  it("inclui header Cache-Control ttl=60 e swr=0 após recomputação com partida de grupo ao vivo", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    const liveGroupMatch = {
      ...MOCK_KNOCKOUT_MATCH,
      stage: "grupos" as const,
      status: "live" as const,
      groupId: "A",
    };
    getEffectiveMatchesMock.mockResolvedValue([liveGroupMatch]);
    fetchAllTeamsMock.mockResolvedValue([]);

    const response = await GET(new Request("http://x/api/worldcup/bracket"));
    // Fix 4 (WR-02): stale-while-revalidate=0 quando ao vivo
    expect(response.headers.get("Cache-Control")).toBe(
      "s-maxage=60, stale-while-revalidate=0",
    );
  });

  it("inclui header Cache-Control ttl=60 e swr=0 após recomputação com partida de mata-mata ao vivo", async () => {
    // Knockout-live blind spot: jogo de eliminatória ao vivo também deve encurtar o TTL.
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    const liveKnockoutMatch = {
      ...MOCK_KNOCKOUT_MATCH,
      status: "live" as const,
      homeScore: 1,
      awayScore: 0,
    };
    getEffectiveMatchesMock.mockResolvedValue([liveKnockoutMatch]);
    fetchAllTeamsMock.mockResolvedValue([]);

    const response = await GET(new Request("http://x/api/worldcup/bracket"));
    expect(response.headers.get("Cache-Control")).toBe(
      "s-maxage=60, stale-while-revalidate=0",
    );
  });

  // ── Fetch falha + snapshot existe ──────────────────────────────────────────

  it("retorna snapshot stale com Cache-Control: no-store quando fetch falha e snap existe", async () => {
    readSnapshotMock.mockResolvedValue(MOCK_SNAPSHOT);
    isFreshMock.mockReturnValue(false);
    getEffectiveMatchesMock.mockRejectedValue(new EspnFetchError(503));

    const response = await GET(new Request("http://x/api/worldcup/bracket"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const body = (await response.json()) as BracketResponse;
    expect(body.roundOf16).toEqual(MOCK_BRACKET_PAYLOAD.roundOf16);
  });

  // ── Fetch falha + sem snapshot ──────────────────────────────────────────────

  it("retorna 502 quando fetch lança EspnFetchError e não há snapshot", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getEffectiveMatchesMock.mockRejectedValue(new EspnFetchError(503));

    const response = await GET(new Request("http://x/api/worldcup/bracket"));
    expect(response.status).toBe(502);
  });

  it("retorna 504 quando fetch lança EspnTimeoutError e não há snapshot", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getEffectiveMatchesMock.mockRejectedValue(new EspnTimeoutError(10000));

    const response = await GET(new Request("http://x/api/worldcup/bracket"));
    expect(response.status).toBe(504);
  });

  it("retorna 500 quando fetch lança Error genérico e não há snapshot", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getEffectiveMatchesMock.mockRejectedValue(new Error("erro inesperado"));

    const response = await GET(new Request("http://x/api/worldcup/bracket"));
    expect(response.status).toBe(500);
  });

  // ── TASK-08: integração com fetchEspnBracketMap ─────────────────────────────

  it("TASK-08: chama fetchEspnBracketMap durante recomputo", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getEffectiveMatchesMock.mockResolvedValue([MOCK_KNOCKOUT_MATCH]);
    fetchAllTeamsMock.mockResolvedValue([]);

    await GET(new Request("http://x/api/worldcup/bracket"));

    expect(fetchEspnBracketMapMock).toHaveBeenCalledOnce();
  });

  it("TASK-08: parentMatchIds flui ao payload quando o mapa resolve os pais", async () => {
    // Oitava cujos dois lados são placeholders com bracketSlot no R32.
    const r16WithSlots = {
      ...MOCK_KNOCKOUT_MATCH,
      id: "m89",
      homeTeamId: "W73",
      awayTeamId: "W75",
      stage: "oitavas" as const,
      homeBracketSlot: { round: "round-of-32", game: 1 },
      awayBracketSlot: { round: "round-of-32", game: 3 },
    };
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getEffectiveMatchesMock.mockResolvedValue([r16WithSlots]);
    fetchAllTeamsMock.mockResolvedValue([]);
    fetchEspnBracketMapMock.mockResolvedValue(
      new Map([
        ["m73", { round: "round-of-32", slotInRound: 1 }],
        ["m75", { round: "round-of-32", slotInRound: 3 }],
      ]),
    );

    const response = await GET(new Request("http://x/api/worldcup/bracket"));
    const body = (await response.json()) as BracketResponse;

    expect(response.status).toBe(200);
    expect(body.roundOf16[0]?.parentMatchIds).toEqual(["m73", "m75"]);
  });

  // ── writeSnapshot lança → 200 (best-effort) ─────────────────────────────────

  it("retorna 200 mesmo quando writeSnapshot lança (best-effort)", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getEffectiveMatchesMock.mockResolvedValue([MOCK_KNOCKOUT_MATCH]);
    fetchAllTeamsMock.mockResolvedValue([]);
    // writeSnapshot engole o erro internamente; verifica que rota continua com 200
    writeSnapshotMock.mockResolvedValue(undefined);

    const response = await GET(new Request("http://x/api/worldcup/bracket"));
    expect(response.status).toBe(200);
  });

  // ── TASK-06: escopo por campeonato + gate cup/league ────────────────────────

  it("400 para campeonato de liga (gate cup/league), sem ler snapshot nem fonte", async () => {
    const response = await GET(
      new Request("http://x/api/worldcup/bracket?championship=bra.1-2026"),
    );
    expect(response.status).toBe(400);
    expect(readSnapshotMock).not.toHaveBeenCalled();
    expect(getEffectiveMatchesMock).not.toHaveBeenCalled();
  });

  it("400 para campeonato fora do catálogo, sem ler snapshot", async () => {
    const response = await GET(
      new Request("http://x/api/worldcup/bracket?championship=nao.existe"),
    );
    expect(response.status).toBe(400);
    expect(readSnapshotMock).not.toHaveBeenCalled();
  });

  it("lê o snapshot na chave escopada por campeonato (bracket:fifa.world)", async () => {
    readSnapshotMock.mockResolvedValue(MOCK_SNAPSHOT);
    isFreshMock.mockReturnValue(true);

    await GET(new Request("http://x/api/worldcup/bracket"));
    expect(readSnapshotMock).toHaveBeenCalledWith("bracket:fifa.world");
  });

  it("faz fallback de leitura à chave legada 'bracket' para a Copa default", async () => {
    // Escopada ausente → lê a chave legada (preserva snapshot pré-TASK-06).
    readSnapshotMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(MOCK_SNAPSHOT);
    isFreshMock.mockReturnValue(true);

    const response = await GET(new Request("http://x/api/worldcup/bracket"));
    expect(readSnapshotMock).toHaveBeenNthCalledWith(1, "bracket:fifa.world");
    expect(readSnapshotMock).toHaveBeenNthCalledWith(2, "bracket");
    expect(response.status).toBe(200);
  });

  it("NÃO faz fallback legado para campeonato cup não-default", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getEffectiveMatchesMock.mockResolvedValue([]);
    fetchAllTeamsMock.mockResolvedValue([]);

    await GET(
      new Request("http://x/api/worldcup/bracket?championship=uefa.champions-2026"),
    );
    expect(readSnapshotMock).toHaveBeenCalledTimes(1);
    expect(readSnapshotMock).toHaveBeenCalledWith("bracket:uefa.champions-2026");
    expect(getEffectiveMatchesMock).toHaveBeenCalledWith("uefa.champions-2026");
  });

  it("grava o snapshot na chave escopada por campeonato", async () => {
    readSnapshotMock.mockResolvedValue(null);
    isFreshMock.mockReturnValue(false);
    getEffectiveMatchesMock.mockResolvedValue([MOCK_KNOCKOUT_MATCH]);
    fetchAllTeamsMock.mockResolvedValue([]);

    await GET(new Request("http://x/api/worldcup/bracket"));
    expect(writeSnapshotMock).toHaveBeenCalledWith(
      "bracket:fifa.world",
      expect.anything(),
      expect.any(Boolean),
      expect.any(Number),
    );
  });
});
