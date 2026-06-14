import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getAdminGroupInvite,
  SuperAdminServiceError,
} from "@/services/superAdmin";

/**
 * Testes da camada de serviço super_admin → `GET /api/admin/groups/[id]/invites`
 * (superadmin-invite-generator — link nos detalhes do grupo).
 *
 * Mockamos `global.fetch`. Cobrimos: método GET + URL + credentials,
 * `encodeURIComponent` no poolId, sucesso com invite → Invite parseado,
 * `{ invite: null }` → null (sem convite ativo), non-2xx → SuperAdminServiceError,
 * shape inválido → ZodError.
 */

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function makeInvite(overrides: Record<string, unknown> = {}) {
  return {
    id: "ABC234",
    groupId: "pool-1",
    code: "ABC234",
    maxUses: 50,
    usedCount: 3,
    expiresAt: "2026-07-01T00:00:00.000Z",
    isActive: true,
    createdBy: "super-1",
    createdAt: "2026-06-13T00:00:00.000Z",
    ...overrides,
  };
}

function okJson(body: unknown, status = 200): Response {
  return { ok: true, status, json: async () => body } as unknown as Response;
}

function errorJson(status: number, error?: string): Response {
  return {
    ok: false,
    status,
    json: async () => (error === undefined ? {} : { error }),
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getAdminGroupInvite", () => {
  it("faz GET na URL do pool com credentials same-origin", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ invite: makeInvite() }));

    await getAdminGroupInvite("pool-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/admin/groups/pool-1/invites");
    expect(init).toMatchObject({ method: "GET", credentials: "same-origin" });
  });

  it("sucesso → retorna o Invite parseado", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ invite: makeInvite() }));

    const result = await getAdminGroupInvite("pool-1");

    expect(result).toMatchObject({
      id: "ABC234",
      code: "ABC234",
      groupId: "pool-1",
      usedCount: 3,
    });
  });

  it("{ invite: null } → retorna null (sem convite ativo)", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ invite: null }));

    const result = await getAdminGroupInvite("pool-1");

    expect(result).toBeNull();
  });

  it("poolId com caractere especial é encodeURIComponent-ado na URL", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ invite: null }));

    await getAdminGroupInvite("pool/with space");

    expect(fetchMock.mock.calls[0]![0]).toBe(
      "/api/admin/groups/pool%2Fwith%20space/invites",
    );
  });

  it("non-2xx → lança SuperAdminServiceError com status", async () => {
    fetchMock.mockResolvedValue(errorJson(403, "Acesso negado."));

    await expect(getAdminGroupInvite("pool-1")).rejects.toBeInstanceOf(
      SuperAdminServiceError,
    );
    await expect(getAdminGroupInvite("pool-1")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("invite com shape inválido → lança ZodError", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ invite: makeInvite({ code: "bad" }) }));

    await expect(getAdminGroupInvite("pool-1")).rejects.toThrow();
  });
});
