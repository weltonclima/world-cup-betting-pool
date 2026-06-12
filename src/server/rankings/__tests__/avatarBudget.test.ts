import { describe, expect, it } from "vitest";

import {
  AVATAR_BUDGET_BYTES,
  applyAvatarBudget,
  storedDataUrlBytes,
} from "@/server/rankings/avatarBudget";
import type { RankingEntry } from "@/types/rankings";

const PREFIX = "data:image/jpeg;base64,";

/**
 * Constrói uma data URL cujo tamanho ARMAZENADO (comprimento da string, = custo no
 * doc Firestore) é exatamente `bytes`. É essa string que conta contra o limite de 1MB.
 */
function dataUrlOfBytes(bytes: number): string {
  return `${PREFIX}${"A".repeat(bytes - PREFIX.length)}`;
}

function entry(position: number, avatarUrl?: string): RankingEntry {
  return {
    uid: `u${position}`,
    nickname: `user${position}`,
    position,
    points: 100 - position,
    ...(avatarUrl !== undefined ? { avatarUrl } : {}),
  };
}

describe("storedDataUrlBytes", () => {
  it("mede o comprimento da string armazenada (= custo no doc)", () => {
    const url = "data:image/jpeg;base64,QUJD";
    expect(storedDataUrlBytes(url)).toBe(url.length);
  });

  it("conta a data URL inteira, incluindo o prefixo", () => {
    expect(storedDataUrlBytes(dataUrlOfBytes(30_000))).toBe(30_000);
  });

  it("é maior que o tamanho decodificado (~4/3) — não confundir as métricas", () => {
    // base64 de 400 chars decodifica 300 bytes, mas ocupa 400+prefixo na string.
    const url = `${PREFIX}${"A".repeat(400)}`;
    expect(storedDataUrlBytes(url)).toBe(PREFIX.length + 400);
    expect(storedDataUrlBytes(url)).toBeGreaterThan(300);
  });
});

describe("applyAvatarBudget", () => {
  it("mantém todos os avatares quando cabem no orçamento", () => {
    const entries = [
      entry(1, dataUrlOfBytes(10_000)),
      entry(2, dataUrlOfBytes(10_000)),
      entry(3, dataUrlOfBytes(10_000)),
    ];
    const out = applyAvatarBudget(entries, 50_000);
    expect(out.map((e) => e.avatarUrl !== undefined)).toEqual([true, true, true]);
  });

  it("mantém o prefixo por posição e descarta a cauda quando estoura", () => {
    const entries = [
      entry(1, dataUrlOfBytes(30_000)),
      entry(2, dataUrlOfBytes(30_000)),
      entry(3, dataUrlOfBytes(30_000)),
      entry(4, dataUrlOfBytes(30_000)),
    ];
    // Orçamento comporta só os 2 primeiros (60_000) — o 3º estouraria.
    const out = applyAvatarBudget(entries, 70_000);
    expect(out.map((e) => e.avatarUrl !== undefined)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it("omite um avatar único maior que o orçamento (não quebra)", () => {
    const entries = [entry(1, dataUrlOfBytes(900_000))];
    const out = applyAvatarBudget(entries, 800_000);
    expect(out[0]!.avatarUrl).toBeUndefined();
    // a entry permanece (só sem foto)
    expect(out).toHaveLength(1);
    expect(out[0]!.uid).toBe("u1");
  });

  it("entries sem avatarUrl permanecem inalteradas e não consomem orçamento", () => {
    const entries = [
      entry(1), // sem foto
      entry(2, dataUrlOfBytes(30_000)),
      entry(3), // sem foto
      entry(4, dataUrlOfBytes(30_000)),
    ];
    const out = applyAvatarBudget(entries, 70_000);
    // ambos com foto cabem (60_000 ≤ 70_000); sem-foto não consomem nada.
    expect(out.map((e) => e.avatarUrl !== undefined)).toEqual([
      false,
      true,
      false,
      true,
    ]);
  });

  it("prioriza o topo do ranking (ordem de posição preservada)", () => {
    const entries = [
      entry(1, dataUrlOfBytes(40_000)),
      entry(2, dataUrlOfBytes(40_000)),
    ];
    const out = applyAvatarBudget(entries, 50_000);
    // só o 1º cabe.
    expect(out[0]!.avatarUrl).toBeDefined();
    expect(out[1]!.avatarUrl).toBeUndefined();
    expect(out.map((e) => e.position)).toEqual([1, 2]);
  });

  it("é idempotente", () => {
    const entries = [
      entry(1, dataUrlOfBytes(30_000)),
      entry(2, dataUrlOfBytes(30_000)),
      entry(3, dataUrlOfBytes(30_000)),
    ];
    const once = applyAvatarBudget(entries, 70_000);
    const twice = applyAvatarBudget(once, 70_000);
    expect(twice).toEqual(once);
  });

  it("não muta o array de entrada", () => {
    const entries = [entry(1, dataUrlOfBytes(900_000))];
    applyAvatarBudget(entries, 800_000);
    expect(entries[0]!.avatarUrl).toBeDefined();
  });

  it("usa AVATAR_BUDGET_BYTES como padrão (< 1MB do Firestore)", () => {
    expect(AVATAR_BUDGET_BYTES).toBeLessThan(1024 * 1024);
    expect(AVATAR_BUDGET_BYTES).toBeGreaterThan(0);
  });

  it("invariante: soma das strings de avatar mantidas nunca excede o orçamento", () => {
    // Muitos avatares grandes; só um prefixo cabe sob o orçamento padrão.
    const entries = Array.from({ length: 30 }, (_, i) =>
      entry(i + 1, dataUrlOfBytes(60 * 1024)),
    );
    const out = applyAvatarBudget(entries); // orçamento padrão (AVATAR_BUDGET_BYTES)
    const keptBytes = out
      .filter((e) => e.avatarUrl !== undefined)
      .reduce((sum, e) => sum + storedDataUrlBytes(e.avatarUrl!), 0);
    expect(keptBytes).toBeLessThanOrEqual(AVATAR_BUDGET_BYTES);
    // E o orçamento garante folga até o teto de 1MB do Firestore.
    expect(keptBytes).toBeLessThan(1024 * 1024);
  });
});
