/**
 * Testes dos Route Handlers GET/POST /api/group/invites (PRD-10 TASK-08).
 *
 * Escopo multi-tenant: `authorizeGroupAdminOfPool` resolve o `groupId` SEMPRE da
 * sessão (nunca do body/query — D2). GET lista só os convites ATIVOS do pool da
 * sessão; POST respeita `allowInvites` (ausente = true; `false` → 409) e gera o
 * `code` server-side.
 *
 * Casos:
 *  1. GET 401 — não autorizado (gate barra, não toca no Firestore)
 *  2. GET 200 — filtra por groupId da sessão e devolve os convites
 *  3. POST 404 — pool inexistente
 *  4. POST 409 — allowInvites=false bloqueia a criação
 *  5. POST 201 — cria o convite com code gerado e groupId da sessão
 *
 * Mocks: server-only, authorizeGroupAdminOfPool, getAdminFirestore. Os schemas
 * `inviteSchema`/`poolSchema` são REAIS.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizeMock, getFirestoreMock } = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  getFirestoreMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/group/_authorize", () => ({
  authorizeGroupAdminOfPool: authorizeMock,
}));
vi.mock("@/server/firebaseAdmin", () => ({ getAdminFirestore: getFirestoreMock }));

import { NextResponse } from "next/server";

import { GET, POST } from "@/app/api/group/invites/route";

type PostReq = Parameters<typeof POST>[0];

function makeReq(opts: { body?: unknown; badJson?: boolean }): PostReq {
  return {
    json: async () => {
      if (opts.badJson) throw new Error("bad json");
      return opts.body;
    },
  } as unknown as PostReq;
}

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

function inviteDoc(over: Record<string, unknown> = {}): { data: () => unknown } {
  return {
    data: () => ({
      id: "ABC123",
      groupId: "pool-1",
      code: "ABC123",
      maxUses: 10,
      usedCount: 0,
      expiresAt: "2099-01-01T00:00:00Z",
      isActive: true,
      createdBy: "admin-1",
      createdAt: "2026-01-01T00:00:00Z",
      ...over,
    }),
  };
}

const createMock = vi.fn(async () => {});
const batchUpdate = vi.fn();
const batchCommit = vi.fn(async () => {});

/** Query encadeável `.where().where().get()` que devolve `result`. */
function chain(result: unknown): unknown {
  const node: Record<string, unknown> = {
    where: () => node,
    get: async () => result,
  };
  return node;
}

function mockDb(opts: {
  poolExists?: boolean;
  poolData?: Record<string, unknown>;
  activeInvites?: { ref: unknown }[];
  listInvites?: { data: () => unknown }[];
}): void {
  const poolSnap = {
    exists: opts.poolExists ?? true,
    data: () => opts.poolData ?? pool(),
  };
  getFirestoreMock.mockReturnValue({
    batch: () => ({ update: batchUpdate, commit: batchCommit }),
    collection: (name: string) => ({
      doc: (id?: string) =>
        name === "pools"
          ? { id, get: async () => poolSnap }
          : { id, create: createMock },
      // GET usa a query de `listInvites`; POST usa a de `activeInvites`.
      where: () =>
        chain({
          empty: (opts.activeInvites ?? []).length === 0,
          docs: opts.listInvites ?? opts.activeInvites ?? [],
        }),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authorizeMock.mockResolvedValue({
    auth: { uid: "admin-1", groupId: "pool-1", role: "group_admin" },
  });
});

describe("GET /api/group/invites", () => {
  it("401 quando não autorizado (não toca no Firestore)", async () => {
    authorizeMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Acesso negado." }, { status: 401 }),
    });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(getFirestoreMock).not.toHaveBeenCalled();
  });

  it("200 devolve os convites do pool da sessão", async () => {
    mockDb({
      listInvites: [
        inviteDoc({ code: "AAA111", id: "AAA111", createdAt: "2026-02-01T00:00:00Z" }),
        inviteDoc({ code: "BBB222", id: "BBB222", createdAt: "2026-03-01T00:00:00Z" }),
      ],
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { invites: { code: string }[] };
    expect(body.invites).toHaveLength(2);
    // Ordenado por createdAt desc → o mais recente primeiro.
    expect(body.invites[0]!.code).toBe("BBB222");
  });
});

describe("POST /api/group/invites", () => {
  const okBody = { maxUses: 10, validityDays: 30 };

  it("404 quando o pool não existe", async () => {
    mockDb({ poolExists: false });
    const res = await POST(makeReq({ body: okBody }));
    expect(res.status).toBe(404);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("409 quando allowInvites=false", async () => {
    mockDb({ poolData: pool({ allowInvites: false }) });
    const res = await POST(makeReq({ body: okBody }));
    expect(res.status).toBe(409);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("201 cria o convite com code gerado e groupId da sessão", async () => {
    mockDb({ activeInvites: [] });
    const res = await POST(makeReq({ body: okBody }));
    expect(res.status).toBe(201);
    expect(createMock).toHaveBeenCalledOnce();
    const body = (await res.json()) as {
      invite: { groupId: string; code: string; createdBy: string };
    };
    expect(body.invite.groupId).toBe("pool-1");
    expect(body.invite.createdBy).toBe("admin-1");
    expect(body.invite.code).toMatch(/^[A-Z0-9]{6}$/);
  });
});
