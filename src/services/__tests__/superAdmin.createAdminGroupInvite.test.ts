import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAdminGroupInvite,
  SuperAdminServiceError,
} from "@/services/superAdmin";

/**
 * Testes da camada de serviço super_admin → `POST /api/admin/groups/[id]/invites`
 * (superadmin-invite-generator TASK-03).
 *
 * Mockamos `global.fetch` — sem rede real. Cobrimos: URL + body + credentials,
 * `encodeURIComponent` no poolId, sucesso 201 → Invite parseado, non-2xx →
 * SuperAdminServiceError com status, shape inválido → ZodError.
 */

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

/** Invite válido (mesmo shape do `POST /api/group/invites`). */
function makeInvite(overrides: Record<string, unknown> = {}) {
  return {
    id: "ABC234",
    groupId: "pool-1",
    code: "ABC234",
    maxUses: 50,
    usedCount: 0,
    expiresAt: "2026-07-01T00:00:00.000Z",
    isActive: true,
    createdBy: "super-1",
    createdAt: "2026-06-13T00:00:00.000Z",
    ...overrides,
  };
}

function okJson(body: unknown, status = 201): Response {
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

describe("createAdminGroupInvite", () => {
  it("faz POST na URL do pool com body {maxUses, validityDays} e credentials same-origin", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ invite: makeInvite() }));

    await createAdminGroupInvite("pool-1", { maxUses: 50, validityDays: 30 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/admin/groups/pool-1/invites");
    expect(init).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(init.body as string)).toEqual({
      maxUses: 50,
      validityDays: 30,
    });
  });

  it("não envia `label` no body (decisão travada)", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ invite: makeInvite() }));

    await createAdminGroupInvite("pool-1", { maxUses: 1, validityDays: 1 });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body).not.toHaveProperty("label");
  });

  it("sucesso 201 → retorna o Invite parseado", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ invite: makeInvite() }));

    const result = await createAdminGroupInvite("pool-1", {
      maxUses: 50,
      validityDays: 30,
    });

    expect(result).toMatchObject({ id: "ABC234", code: "ABC234", groupId: "pool-1" });
  });

  it("poolId com caractere especial é encodeURIComponent-ado na URL", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ invite: makeInvite() }));

    await createAdminGroupInvite("pool/with space", {
      maxUses: 1,
      validityDays: 1,
    });

    expect(fetchMock.mock.calls[0]![0]).toBe(
      "/api/admin/groups/pool%2Fwith%20space/invites",
    );
  });

  it("non-2xx → lança SuperAdminServiceError com status (ex.: 409 allowInvites=false)", async () => {
    fetchMock.mockResolvedValue(
      errorJson(409, "Os convites estão desativados nas configurações do grupo."),
    );

    await expect(
      createAdminGroupInvite("pool-1", { maxUses: 1, validityDays: 1 }),
    ).rejects.toBeInstanceOf(SuperAdminServiceError);
    await expect(
      createAdminGroupInvite("pool-1", { maxUses: 1, validityDays: 1 }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("404 (pool inexistente) → SuperAdminServiceError status 404", async () => {
    fetchMock.mockResolvedValueOnce(errorJson(404, "Grupo não encontrado."));

    await expect(
      createAdminGroupInvite("ghost", { maxUses: 1, validityDays: 1 }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("invite com shape inválido → lança ZodError", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({ invite: makeInvite({ code: "bad" }) }),
    );

    await expect(
      createAdminGroupInvite("pool-1", { maxUses: 1, validityDays: 1 }),
    ).rejects.toThrow();
  });
});
