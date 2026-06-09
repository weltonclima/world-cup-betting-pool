import type { DistributionBucket } from "@/types";

/**
 * Distribuição de pontuação em faixas fixas (PRD-05 Tela 06). Função pura.
 *
 * Faixas inclusivas: 0–39, 40–59, 60–79, 80–89, 90–topo.
 * O topo é aberto o suficiente para a Copa 2026 (104 partidas ⇒ pontos podem passar de 100):
 * `topo = max(100, maxPoints)`. Label do topo: "90-100 pts" quando topo===100, senão "90+ pts".
 */
export function buildDistribution(
  pointsList: number[],
  maxPoints?: number,
): DistributionBucket[] {
  const top = Math.max(100, maxPoints ?? 100);
  const topLabel = top === 100 ? "90-100 pts" : "90+ pts";

  const ranges: ReadonlyArray<Omit<DistributionBucket, "count">> = [
    { label: "0-39 pts", min: 0, max: 39 },
    { label: "40-59 pts", min: 40, max: 59 },
    { label: "60-79 pts", min: 60, max: 79 },
    { label: "80-89 pts", min: 80, max: 89 },
    { label: topLabel, min: 90, max: top },
  ];

  return ranges.map((range) => ({
    ...range,
    count: pointsList.filter((p) => p >= range.min && p <= range.max).length,
  }));
}
