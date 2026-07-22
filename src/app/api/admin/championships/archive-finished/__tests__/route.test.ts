/**
 * Testes de POST /api/admin/championships/archive-finished (auto-arquivamento).
 *
 * Foco: seleção de candidatos (união dos habilitados nos pools), idempotência pelo
 * DOC RUNTIME (não pelo status resolvido do catálogo — a Copa é archived-by-default
 * mas precisa arquivar na 1ª vez), gate de "encerrado" e isolamento best-effort.
 *
 * `archiveChampionship` é mockado; `isChampionshipFinished` é o REAL (puro).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authorizeMock, getFirestoreMock, getEffectiveMatchesMock, archiveMock } =
  vi.hoisted(() => ({
    authorizeMock: vi.fn(),
    getFirestoreMock: vi.fn(),
    getEffectiveMatchesMock: vi.fn(),
    archiveMock: vi.fn(),
  }));

vi.mock("@/app/api/admin/groups/_authorize", () => ({
  authorizeGroupAdmin: authorizeMock,
}));
vi.mock("@/server/firebaseAdmin", () => ({ getAdminFirestore: getFirestoreMock }));
vi.mock("@/server/copaData/matchSource", () => ({
  getEffectiveMatches: getEffectiveMatchesMock,
}));
vi.mock("@/server/copaData/archive", async (importActual) => {
  const actual = await importActual<typeof import("@/server/copaData/archive")>();
  return { ...actual, archiveChampionship: archiveMock };
});
vi.mock("server-only", () => ({}));

import { POST } from "@/app/api/admin/championships/archive-finished/route";
import { NextResponse } from "next/server";

const finished = [{ id: "m1", status: "finished" }] as never;
const scheduled = [{ id: "m2", status: "scheduled" }] as never;

/**
 * db fake: `pools` habilita os campeonatos dados; `championships` devolve o status
 * runtime por cid (undefined = doc ausente). `getAll` mapeia refs→snaps por cid.
 */
function makeDb(opts: {
  pools: Array<Record<string, unknown>>;
  runtimeStatus?: Record<string, string>;
}) {
  const collection = vi.fn((name: string) => {
    if (name === "pools") {
      return {
        get: vi.fn().mockResolvedValue({
          docs: opts.pools.map((p) => ({ id: p["id"], data: () => p })),
        }),
      };
    }
    if (name === "championships") {
      return { doc: vi.fn((cid: string) => ({ _cid: cid })) };
    }
    return { doc: vi.fn(() => ({})) };
  });
  const getAll = vi.fn(async (...refs: Array<{ _cid?: string }>) =>
    refs.map((r) => {
      const status = r._cid ? opts.runtimeStatus?.[r._cid] : undefined;
      return { exists: status !== undefined, data: () => ({ status }) };
    }),
  );
  return { collection, getAll } as never;
}

const okAuth = () => authorizeMock.mockResolvedValue({ authorized: true, actorUid: null });

beforeEach(() => {
  vi.clearAllMocks();
  archiveMock.mockResolvedValue({ championshipId: "x", historyDocs: 1 });
});
afterEach(() => vi.restoreAllMocks());

const req = () =>
  new Request("http://localhost/api/admin/championships/archive-finished", {
    method: "POST",
  });

describe("POST /api/admin/championships/archive-finished", () => {
  it("auth falha → repassa o errorResponse, sem tocar Firestore", async () => {
    authorizeMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Acesso negado." }, { status: 403 }),
    });
    const res = await POST(req());
    expect(res.status).toBe(403);
    expect(getFirestoreMock).not.toHaveBeenCalled();
  });

  it("Copa encerrada SEM doc runtime → arquiva (archived-by-default não a pula)", async () => {
    okAuth();
    getFirestoreMock.mockReturnValue(
      makeDb({ pools: [{ id: "p1", enabledChampionships: ["fifa.world"] }] }),
    );
    getEffectiveMatchesMock.mockResolvedValue(finished);

    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.archived).toContain("fifa.world");
    expect(archiveMock).toHaveBeenCalledTimes(1);
  });

  it("campeonato JÁ arquivado no runtime → pulado (idempotente, sem re-arquivar)", async () => {
    okAuth();
    getFirestoreMock.mockReturnValue(
      makeDb({
        pools: [{ id: "p1", enabledChampionships: ["fifa.world"] }],
        runtimeStatus: { "fifa.world": "archived" },
      }),
    );

    const res = await POST(req());
    const body = await res.json();
    expect(body.skippedAlreadyArchived).toContain("fifa.world");
    expect(archiveMock).not.toHaveBeenCalled();
    // Nem fetch de partidas para um já-arquivado.
    expect(getEffectiveMatchesMock).not.toHaveBeenCalled();
  });

  it("campeonato NÃO encerrado (jogo agendado, status não-archived) → pulado silencioso, 200", async () => {
    okAuth();
    getFirestoreMock.mockReturnValue(
      makeDb({ pools: [{ id: "p1", enabledChampionships: ["bra.1-2026"] }] }),
    );
    getEffectiveMatchesMock.mockResolvedValue(scheduled);

    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skippedNotFinished).toContain("bra.1-2026");
    expect(body.errors).toEqual([]);
    expect(archiveMock).not.toHaveBeenCalled();
  });

  it("CR-01: status 'archived' (Copa, catálogo) mas fonte não confirma encerramento → ERRO loud + 500, não skip silencioso", async () => {
    // fifa.world é archived-by-default no catálogo e sem doc runtime. Se a ESPN
    // devolver schedule não-terminal, NÃO pode cair no bucket de sucesso
    // `skippedNotFinished` (Copa ficaria invisível: fora do ativo E fora do
    // Histórico). Deve emitir erro e 500 para o cron falhar visível e re-tentar.
    okAuth();
    getFirestoreMock.mockReturnValue(
      makeDb({ pools: [{ id: "p1", enabledChampionships: ["fifa.world"] }] }),
    );
    getEffectiveMatchesMock.mockResolvedValue(scheduled);

    const res = await POST(req());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.skippedNotFinished).not.toContain("fifa.world");
    expect(
      body.errors.map((e: { championshipId: string }) => e.championshipId),
    ).toContain("fifa.world");
    expect(archiveMock).not.toHaveBeenCalled();
  });

  it("best-effort: falha ao arquivar um NÃO derruba os demais", async () => {
    okAuth();
    getFirestoreMock.mockReturnValue(
      makeDb({
        pools: [{ id: "p1", enabledChampionships: ["fifa.world", "bra.1-2026"] }],
      }),
    );
    getEffectiveMatchesMock.mockResolvedValue(finished);
    archiveMock.mockImplementation(async (_db: unknown, champ: { id: string }) => {
      if (champ.id === "fifa.world") throw new Error("ESPN fora");
      return { championshipId: champ.id, historyDocs: 1 };
    });

    const res = await POST(req());
    expect(res.status).toBe(500); // há erro → job falha visível (loud)
    const body = await res.json();
    expect(body.archived).toContain("bra.1-2026");
    expect(body.errors.map((e: { championshipId: string }) => e.championshipId)).toContain(
      "fifa.world",
    );
  });

  it("dedup: mesmo campeonato em 2 pools é processado 1×", async () => {
    okAuth();
    getFirestoreMock.mockReturnValue(
      makeDb({
        pools: [
          { id: "p1", enabledChampionships: ["fifa.world"] },
          { id: "p2", enabledChampionships: ["fifa.world"] },
        ],
      }),
    );
    getEffectiveMatchesMock.mockResolvedValue(finished);

    await POST(req());
    expect(archiveMock).toHaveBeenCalledTimes(1);
  });
});
