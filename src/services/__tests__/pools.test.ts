/**
 * Testes TDD (red-first) da camada de serviço de pools (TASK-04).
 *
 * `src/services/pools.ts` ainda não existe — import falha (red).
 * Mock: global fetch. Cobre Read/Write split + mapeamento de erro pt-BR.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPool, getPool, PoolServiceError, searchPools } from "@/services/pools";
import type { Pool } from "@/types/pools";

const iso = "2026-06-05T12:00:00Z";
const pool: Pool = {
  id: "bolao-dos-parcas",
  name: "Bolão dos Parças",
  slug: "bolao-dos-parcas",
  status: "pending",
  adminId: "uid-1",
  createdAt: iso,
};

function fetchOk(body: unknown, status = 200) {
  return vi.fn(async () => ({ ok: true, status, json: async () => body }) as unknown as Response);
}
function fetchErr(status: number) {
  return vi.fn(async () => ({ ok: false, status, json: async () => ({ error: "x" }) }) as unknown as Response);
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("services/pools", () => {
  it("createPool retorna o pool criado no sucesso", async () => {
    vi.stubGlobal("fetch", fetchOk({ pool }, 201));
    const result = await createPool({ name: pool.name, slug: pool.slug });
    expect(result.slug).toBe("bolao-dos-parcas");
    expect(result.status).toBe("pending");
  });

  it("createPool lança PoolServiceError 409 com mensagem pt-BR", async () => {
    vi.stubGlobal("fetch", fetchErr(409));
    await expect(createPool({ name: "X", slug: "x" })).rejects.toMatchObject({
      name: "PoolServiceError",
      status: 409,
    });
    await expect(createPool({ name: "X", slug: "x" })).rejects.toThrow(/já existe|identificador|slug/i);
  });

  it("createPool mapeia 401 → mensagem de autenticação", async () => {
    vi.stubGlobal("fetch", fetchErr(401));
    await expect(createPool({ name: "X", slug: "x" })).rejects.toBeInstanceOf(PoolServiceError);
  });

  it("searchPools retorna a lista de pools", async () => {
    vi.stubGlobal("fetch", fetchOk({ pools: [pool] }));
    const result = await searchPools("parca");
    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe("bolao-dos-parcas");
  });

  it("searchPools propaga erro tipado em falha HTTP", async () => {
    vi.stubGlobal("fetch", fetchErr(403));
    await expect(searchPools()).rejects.toBeInstanceOf(PoolServiceError);
  });

  it("getPool retorna pool + memberCount", async () => {
    vi.stubGlobal("fetch", fetchOk({ pool, memberCount: 5 }));
    const result = await getPool("bolao-dos-parcas");
    expect(result.pool.slug).toBe("bolao-dos-parcas");
    expect(result.memberCount).toBe(5);
  });

  it("getPool lança PoolServiceError 404", async () => {
    vi.stubGlobal("fetch", fetchErr(404));
    await expect(getPool("nope")).rejects.toMatchObject({ status: 404 });
  });
});
