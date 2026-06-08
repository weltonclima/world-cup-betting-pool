import { describe, expect, it } from "vitest";

import { buildDistribution } from "@/features/rankings/lib";
import { distributionBucketSchema } from "@/schemas";

describe("buildDistribution", () => {
  it("sempre retorna 5 faixas fixas", () => {
    const buckets = buildDistribution([]);
    expect(buckets).toHaveLength(5);
    expect(buckets.map((b) => b.count)).toEqual([0, 0, 0, 0, 0]);
  });

  it("conta valores por faixa", () => {
    // 0-39, 40-59, 60-79, 80-89, 90-100
    const buckets = buildDistribution([10, 45, 55, 70, 85, 95, 98]);
    expect(buckets.map((b) => b.count)).toEqual([1, 2, 1, 1, 2]);
  });

  it("respeita fronteiras inclusivas", () => {
    const buckets = buildDistribution([39, 40, 59, 60, 79, 80, 89, 90]);
    // 39->b0, 40&59->b1, 60&79->b2, 80&89->b3, 90->b4
    expect(buckets.map((b) => b.count)).toEqual([1, 2, 2, 2, 1]);
  });

  it("soma dos counts === itens dentro do range", () => {
    const list = [0, 39, 40, 100];
    const buckets = buildDistribution(list);
    const total = buckets.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(list.length);
  });

  it("captura pontos acima de 100 quando maxPoints informado (WC2026)", () => {
    const buckets = buildDistribution([104, 95], 104);
    const top = buckets[buckets.length - 1];
    expect(top?.count).toBe(2);
    expect(top?.label).toBe("90+ pts");
    expect(top?.min).toBe(90);
    expect(top && top.max >= 104).toBe(true);
  });

  it("label topo é '90-100 pts' quando maxPoints <= 100", () => {
    const buckets = buildDistribution([95]);
    expect(buckets[buckets.length - 1]?.label).toBe("90-100 pts");
  });

  it("buckets validam contra distributionBucketSchema (min <= max)", () => {
    for (const b of buildDistribution([1, 50, 104], 104)) {
      expect(distributionBucketSchema.safeParse(b).success).toBe(true);
      expect(b.min).toBeLessThanOrEqual(b.max);
    }
  });
});
