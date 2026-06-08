"use client";

import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import { cn } from "@/lib/utils";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

/** Ponto de evolução: rótulo da rodada + posição (1-indexed). */
export interface EvolutionPoint {
  label: string;
  position: number;
}

export interface EvolutionLineChartProps {
  data: EvolutionPoint[];
  className?: string;
}

const config: ChartConfig = {
  position: { label: "Posição", color: "var(--chart-1)" },
};

/**
 * Gráfico de linha da evolução de posição por rodada (PRD-05 Telas 02/04).
 * Eixo Y invertido: posição menor (melhor) no topo → linha sobe quando melhora.
 * Estado vazio renderiza alternativa textual (acessibilidade).
 */
export function EvolutionLineChart({
  data,
  className,
}: EvolutionLineChartProps) {
  if (data.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Sem histórico ainda
      </p>
    );
  }

  return (
    <ChartContainer config={config} className={cn("h-48", className)}>
      <LineChart data={data} margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis
          reversed
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <Tooltip formatter={(value) => [`#${String(value)}`, "Posição"]} />
        <Line
          type="monotone"
          dataKey="position"
          stroke="var(--color-position)"
          strokeWidth={2}
          dot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
