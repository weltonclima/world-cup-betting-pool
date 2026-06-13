/**
 * Testes do Route Handler GET /api/invite/[code]/resolve (TASK-04).
 *
 * Rota PÚBLICA (sem auth) que resolve um código de convite válido em
 * `{ groupId, groupName }`. Mapeia o resultado de `resolveInvite` para HTTP:
 *  - válido        → 200 { groupId, groupName }   (e NADA além disso)
 *  - expirado      → 410 { error }
 *  - generic/404   → 404 { error }
 *
 * Mock: o util `resolveInvite` (a regra de negócio é testada à parte).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveInviteMock } = vi.hoisted(() => ({
  resolveInviteMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/invites/resolveInvite", () => ({
  resolveInvite: resolveInviteMock,
}));

import { GET } from "@/app/api/invite/[code]/resolve/route";

type GetParams = Parameters<typeof GET>;

const VALID_CODE = "ABC123";

function req(): GetParams[0] {
  return {} as unknown as GetParams[0];
}

function ctx(code: string): GetParams[1] {
  return { params: Promise.resolve({ code }) } as unknown as GetParams[1];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/invite/[code]/resolve", () => {
  it("200 convite válido devolve apenas groupId e groupName", async () => {
    resolveInviteMock.mockResolvedValue({
      ok: true,
      invite: { groupId: "pool-1", groupName: "Bolão dos Parças" },
    });
    const res = await GET(req(), ctx(VALID_CODE));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ groupId: "pool-1", groupName: "Bolão dos Parças" });
    // Não vaza campos sensíveis.
    expect(body).not.toHaveProperty("usedCount");
    expect(body).not.toHaveProperty("maxUses");
    expect(body).not.toHaveProperty("expiresAt");
    expect(body).not.toHaveProperty("createdBy");
  });

  it("410 convite expirado", async () => {
    resolveInviteMock.mockResolvedValue({
      ok: false,
      code: "expired",
      reason: "Este convite expirou.",
    });
    const res = await GET(req(), ctx(VALID_CODE));
    expect(res.status).toBe(410);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("error");
    expect(body).not.toHaveProperty("groupId");
  });

  it("404 convite indisponível (generic)", async () => {
    resolveInviteMock.mockResolvedValue({
      ok: false,
      code: "generic",
      reason: "Convite não encontrado.",
    });
    const res = await GET(req(), ctx(VALID_CODE));
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("error");
    expect(body).not.toHaveProperty("groupId");
  });
});
