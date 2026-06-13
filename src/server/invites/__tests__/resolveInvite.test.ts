/**
 * Testes do util server-only `resolveInvite` (TASK-04).
 *
 * Regra de negócio compartilhada entre o Server Component `/invite/[code]` e a
 * rota pública `GET /api/invite/[code]/resolve`. Valida o convite (formato →
 * existência → isActive → expiresAt → usedCount/maxUses → pool existe → pool não
 * bloqueado) e resolve `{ groupId, groupName }`. NUNCA lança.
 *
 * Discriminante `code: "expired" | "generic"`: só expiração devolve "expired"
 * (UI dedicada de TASK-03); todo o resto é "generic".
 *
 * Mocks: server-only, getAdminFirestore. `inviteSchema`/`poolSchema` REAIS.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { getFirestoreMock } = vi.hoisted(() => ({
  getFirestoreMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/firebaseAdmin", () => ({
  getAdminFirestore: getFirestoreMock,
}));

import { resolveInvite } from "@/server/invites/resolveInvite";

const VALID_CODE = "ABC123";

function invite(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: VALID_CODE,
    groupId: "pool-1",
    code: VALID_CODE,
    maxUses: 10,
    usedCount: 0,
    expiresAt: "2099-01-01T00:00:00Z",
    isActive: true,
    createdBy: "admin-1",
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function pool(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "pool-1",
    name: "Bolão dos Parças",
    slug: "bolao-dos-parcas",
    status: "active",
    adminId: "admin-1",
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

/**
 * Monta o mock do Firestore: `invites/{code}` e `pools/{groupId}`.
 * `inviteData === null` → invite inexistente; `poolData === null` → pool inexistente;
 * `throwOnGet` → falha inesperada de leitura.
 */
function mockDb(opts: {
  inviteData?: Record<string, unknown> | null;
  poolData?: Record<string, unknown> | null;
  throwOnGet?: boolean;
}): void {
  const snap = (data: Record<string, unknown> | null | undefined) =>
    data == null
      ? { exists: false, data: () => undefined }
      : { exists: true, data: () => data };

  getFirestoreMock.mockReturnValue({
    collection: (name: string) => ({
      doc: () => ({
        get: async () => {
          if (opts.throwOnGet) throw new Error("firestore down");
          return name === "invites" ? snap(opts.inviteData) : snap(opts.poolData);
        },
      }),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveInvite", () => {
  it("código fora do formato → generic, sem tocar o Firestore", async () => {
    const res = await resolveInvite("abc");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("generic");
    expect(getFirestoreMock).not.toHaveBeenCalled();
  });

  it("convite inexistente → generic", async () => {
    mockDb({ inviteData: null });
    const res = await resolveInvite(VALID_CODE);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("generic");
  });

  it("convite inativo → generic", async () => {
    mockDb({ inviteData: invite({ isActive: false }), poolData: pool() });
    const res = await resolveInvite(VALID_CODE);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("generic");
  });

  it("convite expirado → expired", async () => {
    mockDb({
      inviteData: invite({ expiresAt: "2000-01-01T00:00:00Z" }),
      poolData: pool(),
    });
    const res = await resolveInvite(VALID_CODE);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("expired");
  });

  it("limite de usos atingido → generic", async () => {
    mockDb({
      inviteData: invite({ maxUses: 5, usedCount: 5 }),
      poolData: pool(),
    });
    const res = await resolveInvite(VALID_CODE);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("generic");
  });

  it("pool inexistente → generic", async () => {
    mockDb({ inviteData: invite(), poolData: null });
    const res = await resolveInvite(VALID_CODE);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("generic");
  });

  it("pool bloqueado → generic", async () => {
    mockDb({ inviteData: invite(), poolData: pool({ status: "blocked" }) });
    const res = await resolveInvite(VALID_CODE);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("generic");
  });

  it("convite válido → ok com groupId e groupName do pool", async () => {
    mockDb({ inviteData: invite(), poolData: pool({ name: "Bolão dos Parças" }) });
    const res = await resolveInvite(VALID_CODE);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.invite).toEqual({
        groupId: "pool-1",
        groupName: "Bolão dos Parças",
      });
    }
  });

  it("falha inesperada do Firestore → generic, não lança", async () => {
    mockDb({ throwOnGet: true });
    const res = await resolveInvite(VALID_CODE);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("generic");
  });

  it("tolera campos legados extras no doc (.strip) e resolve normalmente", async () => {
    mockDb({
      inviteData: invite({ campoLegado: "x", outroExtra: 42 }),
      poolData: pool({ legacyFlag: true }),
    });
    const res = await resolveInvite(VALID_CODE);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.invite.groupId).toBe("pool-1");
  });
});
