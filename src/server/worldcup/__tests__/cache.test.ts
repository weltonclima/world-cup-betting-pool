/**
 * Testes de `src/server/worldcup/cache.ts`.
 *
 * Mock do Firestore Admin SDK — nunca conecta a Firebase real.
 * Cobre: isFresh (dois TTLs + boundary), readSnapshot (existe/não existe),
 * writeSnapshot (best-effort: swallows erro de set()).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

const { getMock, setMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  setMock: vi.fn(),
}));

/**
 * Mock de getAdminFirestore: retorna um objeto que simula
 * collection().doc().get() e collection().doc().set().
 */
vi.mock("@/server/firebaseAdmin", () => ({
  getAdminFirestore: () => ({
    collection: () => ({
      doc: () => ({
        get: getMock,
        set: setMock,
      }),
    }),
  }),
}));

// server-only importado transitivamente pelo módulo
vi.mock("server-only", () => ({}));

// Importar APÓS os mocks
import {
  CACHE_VERSION,
  isFresh,
  readSnapshot,
  writeSnapshot,
} from "@/server/worldcup/cache";
import type { CacheSnapshot } from "@/server/worldcup/cache";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_PAYLOAD = { groups: [], hasLiveGroupMatch: false };

function makeSnap(overrides: Partial<CacheSnapshot> = {}): CacheSnapshot {
  return {
    payload: BASE_PAYLOAD,
    computedAt: 1_000_000,
    hasLiveGroupMatch: false,
    ...overrides,
  };
}

// ─── isFresh ─────────────────────────────────────────────────────────────────

describe("isFresh", () => {
  describe("TTL padrão (sem partida ao vivo → 86 400 000 ms)", () => {
    it("retorna true quando elapsed < 86 400 000 ms", () => {
      const snap = makeSnap({ computedAt: 0, hasLiveGroupMatch: false });
      expect(isFresh(snap, 86_399_999)).toBe(true);
    });

    it("retorna false no boundary exato (elapsed === 86 400 000 ms)", () => {
      const snap = makeSnap({ computedAt: 0, hasLiveGroupMatch: false });
      expect(isFresh(snap, 86_400_000)).toBe(false);
    });

    it("retorna false quando elapsed > 86 400 000 ms", () => {
      const snap = makeSnap({ computedAt: 0, hasLiveGroupMatch: false });
      expect(isFresh(snap, 86_400_001)).toBe(false);
    });
  });

  describe("TTL ao vivo (hasLiveGroupMatch → 60 000 ms)", () => {
    it("retorna true quando elapsed < 60 000 ms", () => {
      const snap = makeSnap({ computedAt: 0, hasLiveGroupMatch: true });
      expect(isFresh(snap, 59_999)).toBe(true);
    });

    it("retorna false no boundary exato (elapsed === 60 000 ms)", () => {
      const snap = makeSnap({ computedAt: 0, hasLiveGroupMatch: true });
      expect(isFresh(snap, 60_000)).toBe(false);
    });

    it("retorna false quando elapsed > 60 000 ms", () => {
      const snap = makeSnap({ computedAt: 0, hasLiveGroupMatch: true });
      expect(isFresh(snap, 60_001)).toBe(false);
    });
  });
});

// ─── readSnapshot ─────────────────────────────────────────────────────────────

describe("readSnapshot", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("retorna null quando o doc não existe", async () => {
    getMock.mockResolvedValue({ exists: false, data: () => undefined });

    const result = await readSnapshot("groups");
    expect(result).toBeNull();
  });

  it("retorna o CacheSnapshot quando o doc existe", async () => {
    const snap = makeSnap({ computedAt: 12345, hasLiveGroupMatch: true });
    getMock.mockResolvedValue({ exists: true, data: () => snap });

    const result = await readSnapshot<typeof BASE_PAYLOAD>("groups");
    expect(result).toEqual(snap);
    expect(result?.computedAt).toBe(12345);
    expect(result?.hasLiveGroupMatch).toBe(true);
  });

  it("aceita key 'bracket'", async () => {
    const snap = makeSnap({ payload: { roundOf32: [] } });
    getMock.mockResolvedValue({ exists: true, data: () => snap });

    const result = await readSnapshot("bracket");
    expect(result).toEqual(snap);
  });
});

// ─── writeSnapshot ────────────────────────────────────────────────────────────

describe("writeSnapshot", () => {
  beforeEach(() => {
    setMock.mockReset();
  });

  it("chama set() com os campos corretos", async () => {
    setMock.mockResolvedValue(undefined);

    await writeSnapshot("groups", BASE_PAYLOAD, false, 999_000);

    expect(setMock).toHaveBeenCalledOnce();
    expect(setMock).toHaveBeenCalledWith({
      payload: BASE_PAYLOAD,
      computedAt: 999_000,
      hasLiveGroupMatch: false,
      version: CACHE_VERSION,
    });
  });

  it("engole erro de set() sem propagar (best-effort)", async () => {
    setMock.mockRejectedValue(new Error("Firestore indisponível"));

    // Não deve lançar
    await expect(
      writeSnapshot("bracket", { roundOf32: [] }, false, 1_000),
    ).resolves.toBeUndefined();
  });

  it("não propaga erro mesmo em rejeição assíncrona", async () => {
    setMock.mockRejectedValue(new Error("timeout"));

    let threw = false;
    try {
      await writeSnapshot("groups", {}, true, 0);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});
