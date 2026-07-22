/**
 * Testes do Route Handler GET /api/group/championships (multi-championship TASK-09).
 *
 * Rota escopada a MEMBRO (`authorizeGroupMemberOfPool`), não admin: qualquer
 * participante lê os campeonatos habilitados do pool para o seletor. Devolve só a
 * projeção mínima (`enabledChampionships`, `rankingMode`) — nunca o pool inteiro.
 * Defaults-na-leitura via `@/lib/poolChampionships` (pool legado → `["fifa.world"]`
 * / `"geral"`).
 *
 * Mocks: server-only, authorizeGroupMemberOfPool, getAdminFirestore. `poolSchema`
 * e os helpers de `poolChampionships` REAIS (defesa em profundidade real).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizeMock, getFirestoreMock } = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  getFirestoreMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/group/_authorize", () => ({
  authorizeGroupMemberOfPool: authorizeMock,
}));
vi.mock("@/server/firebaseAdmin", () => ({ getAdminFirestore: getFirestoreMock }));

import { NextResponse } from "next/server";

import { GET } from "@/app/api/group/championships/route";

function pool(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "pool-1",
    name: "Bolão FC",
    slug: "pool-1",
    status: "active",
    adminId: "admin-1",
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function mockDb(opts: { exists?: boolean; data?: Record<string, unknown> }): void {
  const snap = { exists: opts.exists ?? true, data: () => opts.data ?? pool() };
  getFirestoreMock.mockReturnValue({
    // `doc().get()` → pool; `collection().get()` → overrides de status vazios
    // (`loadChampionshipStatuses` REAL cai nos defaults do catálogo: fifa.world
    // archived, demais upcoming). Mantém os helpers reais (defesa em profundidade).
    collection: () => ({
      doc: () => ({ get: async () => snap }),
      get: async () => ({ docs: [] as unknown[] }),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authorizeMock.mockResolvedValue({ auth: { uid: "member-1", groupId: "pool-1" } });
});

describe("GET /api/group/championships", () => {
  it("401/403 quando não autorizado (propaga errorResponse)", async () => {
    authorizeMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Acesso negado." }, { status: 403 }),
    });
    const res = await GET();
    expect(res.status).toBe(403);
    // Não deve nem tocar o Firestore quando a autorização falha.
    expect(getFirestoreMock).not.toHaveBeenCalled();
  });

  it("404 quando o pool não existe", async () => {
    mockDb({ exists: false });
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("200 segmenta arquivados da área ativa (TASK-15 §6.5): fifa.world (archived) sai, bra.1-2026 fica", async () => {
    mockDb({
      data: pool({
        enabledChampionships: ["fifa.world", "bra.1-2026"],
        rankingMode: "por-campeonato",
      }),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      enabledChampionships: string[];
      rankingMode: string;
    };
    // fifa.world é `archived` no catálogo → removido da área ativa (vive só no
    // Histórico); bra.1-2026 (`upcoming`) permanece.
    expect(body.enabledChampionships).toEqual(["bra.1-2026"]);
    expect(body.rankingMode).toBe("por-campeonato");
    // Nunca vaza o pool inteiro (só a projeção mínima).
    expect((body as Record<string, unknown>)["adminId"]).toBeUndefined();
    expect((body as Record<string, unknown>)["slug"]).toBeUndefined();
  });

  it("200 pool Copa-only legado com a Copa arquivada → área ativa VAZIA (temporada encerrada)", async () => {
    // BUGFIX: a proteção anti-vazio foi removida. Um pool 100%-arquivado zera a
    // área ativa; o cliente exibe "temporada encerrada → Histórico" (SeasonEnded-
    // Notice) em vez de manter a Copa encerrada em jogos/palpite/ranking.
    mockDb({ data: pool() });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      enabledChampionships: string[];
      rankingMode: string;
    };
    expect(body.enabledChampionships).toEqual([]);
    expect(body.rankingMode).toBe("geral");
  });
});
