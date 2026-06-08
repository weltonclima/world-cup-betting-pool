"use client";

import type { CSSProperties, ReactElement } from "react";
import { ResponsiveContainer } from "recharts";

import { cn } from "@/lib/utils";

/**
 * Primitivo de gráfico enxuto e totalmente tipado (TASK-06).
 *
 * Substitui o `chart.tsx` verbatim do shadcn (que tipa o payload do tooltip como `any`,
 * proibido pelo CLAUDE.md, e mira a API do recharts 2). Mantém o essencial: tema por
 * CSS vars (`--color-<key>`) e responsividade via `ResponsiveContainer`.
 */
export type ChartConfig = Record<
  string,
  { label?: string; color?: string }
>;

interface ChartContainerProps {
  config: ChartConfig;
  /** Único elemento de gráfico recharts (exigência do ResponsiveContainer). */
  children: ReactElement;
  className?: string;
}

export function ChartContainer({
  config,
  children,
  className,
}: ChartContainerProps): ReactElement {
  // CSS vars de cor por série (data-driven theming) — consumidas por stroke/fill="var(--color-<key>)".
  const styleVars: Record<string, string> = {};
  for (const [key, item] of Object.entries(config)) {
    if (item.color) styleVars[`--color-${key}`] = item.color;
  }

  return (
    <div className={cn("w-full", className)} style={styleVars as CSSProperties}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
