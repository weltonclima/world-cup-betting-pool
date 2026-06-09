import { describe, expect, it } from "vitest";

import { computeAccuracy } from "@/features/rankings/lib";

describe("computeAccuracy", () => {
  it("12 acertos de 48 jogos = 25%", () => {
    expect(computeAccuracy(12, 48)).toBe(25);
  });

  it("arredonda ao inteiro mais próximo", () => {
    expect(computeAccuracy(1, 3)).toBe(33); // 33.33 -> 33
    expect(computeAccuracy(2, 3)).toBe(67); // 66.66 -> 67
  });

  it("denominador 0 retorna 0", () => {
    expect(computeAccuracy(0, 0)).toBe(0);
    expect(computeAccuracy(5, 0)).toBe(0);
  });

  it("100% quando acerta tudo", () => {
    expect(computeAccuracy(10, 10)).toBe(100);
  });

  it("clampa em 100 (defensivo: points > denominador)", () => {
    expect(computeAccuracy(11, 10)).toBe(100);
  });

  it("nunca negativo", () => {
    expect(computeAccuracy(0, 10)).toBe(0);
  });
});
