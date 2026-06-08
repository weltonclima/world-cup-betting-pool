import { describe, expect, it } from "vitest";

import { evolutionIndicator } from "@/features/rankings/lib";

describe("evolutionIndicator", () => {
  it("subiu quando posição diminui (10 -> 4)", () => {
    expect(evolutionIndicator(10, 4)).toEqual({ direction: "up", delta: 6 });
  });

  it("caiu quando posição aumenta (4 -> 7)", () => {
    expect(evolutionIndicator(4, 7)).toEqual({ direction: "down", delta: 3 });
  });

  it("manteve quando posição igual", () => {
    expect(evolutionIndicator(5, 5)).toEqual({ direction: "same", delta: 0 });
  });

  it("sem posição anterior (undefined) = manteve", () => {
    expect(evolutionIndicator(undefined, 15)).toEqual({
      direction: "same",
      delta: 0,
    });
  });

  it("sem posição anterior (null) = manteve", () => {
    expect(evolutionIndicator(null, 1)).toEqual({
      direction: "same",
      delta: 0,
    });
  });

  it("delta sempre >= 0", () => {
    expect(evolutionIndicator(1, 20).delta).toBeGreaterThanOrEqual(0);
    expect(evolutionIndicator(20, 1).delta).toBeGreaterThanOrEqual(0);
  });
});
