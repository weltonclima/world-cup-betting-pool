/**
 * Testes do Route Handler POST /api/admin/groups/[id]/invites
 * (superadmin-invite-generator TASK-02).
 *
 * Espelha a geração de `POST /api/group/invites`, mas: (1) autoriza via
 * `authorizeGroupAdmin` (super_admin global/secret, não a sessão do pool);
 * (2) `groupId` vem do PARAM da URL (`ctx.params.id`), nunca do body;
 * (3) audita em `system_logs` via `writeAuditLog` (best-effort).
 *
 * Casos:
 *  1. 403 — gate barra (não-super_admin); não toca no Firestore
 *  2. 400 — JSON malformado
 *  3. 422 — body inválido (maxUses=0)
 *  4. 404 — pool inexistente
 *  5. 409 — allowInvites=false
 *  6. 201 — cria com groupId do param, code gerado, createdBy=actorUid
 *  7. A3 — expira o ativo anterior (createdAt menor) ao criar o novo
 *  8. auditoria — writeAuditLog chamado; 201 mantido mesmo se ele rejeitar
 *
 * Mocks: server-only, authorizeGroupAdmin, getAdminFirestore, writeAuditLog.
 * Schemas inviteSchema/poolSchema são REAIS.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizeMock, getFirestoreMock, writeAuditLogMock } = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  getFirestoreMock: vi.fn(),
  writeAuditLogMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/admin/groups/_authorize", () => ({
  authorizeGroupAdmin: authorizeMock,
}));
vi.mock("@/server/firebaseAdmin", () => ({ getAdminFirestore: getFirestoreMock }));
vi.mock("@/server/admin/auditLog", () => ({ writeAuditLog: writeAuditLogMock }));

import { NextResponse } from "next/server";

import { POST } from "@/app/api/admin/groups/[id]/invites/route";

type PostReq = Parameters<typeof POST>[0];

function makeReq(opts: { body?: unknown; badJson?: boolean }): PostReq {
  return {
    json: async () => {
      if (opts.badJson) throw new Error("bad json");
      return opts.body;
    },
  } as unknown as PostReq;
}

function ctx(id = "pool-1"): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
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

function inviteDoc(
  over: Record<string, unknown> = {},
): { id: string; ref: unknown; data: () => unknown } {
  const code = (over["code"] as string) ?? "OLD111";
  return {
    id: code,
    ref: { id: code },
    data: () => ({
      id: code,
      groupId: "pool-1",
      code,
      maxUses: 10,
      usedCount: 0,
      expiresAt: "2099-01-01T00:00:00Z",
      isActive: true,
      createdBy: "admin-1",
      createdAt: "2020-01-01T00:00:00Z", // bem antigo → expira sob A3
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
  activeInvites?: { id: string; ref: unknown; data: () => unknown }[];
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
      where: () =>
        chain({
          empty: (opts.activeInvites ?? []).length === 0,
          docs: opts.activeInvites ?? [],
        }),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks limpa chamadas mas NÃO a implementação — restaura os defaults
  // p/ evitar que um mockRejectedValue de um teste vaze para o seguinte.
  createMock.mockResolvedValue(undefined);
  batchCommit.mockResolvedValue(undefined);
  authorizeMock.mockResolvedValue({ authorized: true, actorUid: "super-1" });
  writeAuditLogMock.mockResolvedValue("log-1");
});

describe("POST /api/admin/groups/[id]/invites", () => {
  const okBody = { maxUses: 10, validityDays: 30 };

  it("403 quando o gate barra (não toca no Firestore)", async () => {
    authorizeMock.mockResolvedValue({
      errorResponse: NextResponse.json({ error: "Acesso negado." }, { status: 403 }),
    });
    const res = await POST(makeReq({ body: okBody }), ctx());
    expect(res.status).toBe(403);
    expect(getFirestoreMock).not.toHaveBeenCalled();
  });

  it("400 quando o JSON é malformado", async () => {
    const res = await POST(makeReq({ badJson: true }), ctx());
    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("422 quando o body é inválido (maxUses=0)", async () => {
    const res = await POST(makeReq({ body: { maxUses: 0, validityDays: 30 } }), ctx());
    expect(res.status).toBe(422);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("404 quando o pool não existe", async () => {
    mockDb({ poolExists: false });
    const res = await POST(makeReq({ body: okBody }), ctx());
    expect(res.status).toBe(404);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("409 quando allowInvites=false", async () => {
    mockDb({ poolData: pool({ allowInvites: false }) });
    const res = await POST(makeReq({ body: okBody }), ctx());
    expect(res.status).toBe(409);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("201 cria o convite com groupId do param, code gerado e createdBy=actorUid", async () => {
    mockDb({ activeInvites: [] });
    const res = await POST(makeReq({ body: okBody }), ctx("pool-1"));
    expect(res.status).toBe(201);
    expect(createMock).toHaveBeenCalledOnce();
    const body = (await res.json()) as {
      invite: {
        groupId: string;
        code: string;
        createdBy: string;
        usedCount: number;
        isActive: boolean;
      };
    };
    expect(body.invite.groupId).toBe("pool-1");
    expect(body.invite.createdBy).toBe("super-1");
    expect(body.invite.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(body.invite.usedCount).toBe(0);
    expect(body.invite.isActive).toBe(true);
  });

  it("A3: expira o convite ativo anterior (createdAt menor) ao criar o novo", async () => {
    mockDb({ activeInvites: [inviteDoc()] });
    const res = await POST(makeReq({ body: okBody }), ctx());
    expect(res.status).toBe(201);
    expect(createMock).toHaveBeenCalledOnce();
    // O ativo anterior é expirado via batch.update(ref, { isActive: false }).
    expect(batchUpdate).toHaveBeenCalledWith(
      { id: "OLD111" },
      { isActive: false },
    );
    expect(batchCommit).toHaveBeenCalledOnce();
  });

  it("retry de colisão: create falha com gRPC 6 e tenta outro code → 201", async () => {
    mockDb({ activeInvites: [] });
    createMock.mockRejectedValueOnce({ code: 6 }); // 1ª tentativa colide
    const res = await POST(makeReq({ body: okBody }), ctx());
    expect(res.status).toBe(201);
    expect(createMock).toHaveBeenCalledTimes(2); // colidiu 1x, sucesso na 2ª
  });

  it("colisão persistente: 5 tentativas falham com ALREADY_EXISTS → 409", async () => {
    mockDb({ activeInvites: [] });
    createMock.mockRejectedValue({ code: "ALREADY_EXISTS" });
    const res = await POST(makeReq({ body: okBody }), ctx());
    expect(res.status).toBe(409);
    expect(createMock).toHaveBeenCalledTimes(5);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/código único/i); // mensagem distinta do allowInvites
  });

  it("A3: convite ativo MAIS NOVO que o atual NÃO é expirado", async () => {
    // Um ativo antigo (2020 → expira) e um do futuro (2099 → preserva).
    mockDb({
      activeInvites: [
        inviteDoc({ code: "OLD111", createdAt: "2020-01-01T00:00:00Z" }),
        inviteDoc({ code: "NEW999", createdAt: "2099-01-01T00:00:00Z" }),
      ],
    });
    const res = await POST(makeReq({ body: okBody }), ctx());
    expect(res.status).toBe(201);
    // Só o antigo entra no batch; o mais novo é preservado.
    expect(batchUpdate).toHaveBeenCalledTimes(1);
    expect(batchUpdate).toHaveBeenCalledWith({ id: "OLD111" }, { isActive: false });
    expect(batchUpdate).not.toHaveBeenCalledWith({ id: "NEW999" }, { isActive: false });
  });

  it("audita group_invite_created e mantém 201 mesmo se writeAuditLog rejeitar", async () => {
    writeAuditLogMock.mockRejectedValue(new Error("audit down"));
    mockDb({ activeInvites: [] });
    const res = await POST(makeReq({ body: okBody }), ctx());
    expect(res.status).toBe(201);
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "group_invite_created",
        actorUid: "super-1",
      }),
    );
  });
});
