"use client";

/**
 * RaioXCard — "Raio-X dos Palpites" da Home (TASK-03 home-revamp).
 *
 * Substitui o card "Meu Desempenho" (redundante) por um donut que mostra a
 * textura real dos palpites finalizados: placar exato (10) / só vencedor (5) /
 * erro (0). Cores semânticas reusam os tokens de estado (win/warning/loss).
 *
 * Componente presentacional puro: recebe `PredictionBreakdown` por prop, sem
 * fetch e sem lógica de derivação (tudo vem de derivePredictionBreakdown).
 * Contrato visual: ai/ui-spec/task-home-revamp-03.md.
 */

import { PieChartIcon } from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { PredictionBreakdown } from "@/features/home/lib/homeDashboardHelpers";

const raioXConfig: ChartConfig = {
  correct: { label: "Exato", color: "var(--color-win)" },
  partial: { label: "Vencedor", color: "var(--color-warning)" },
  wrong: { label: "Erro", color: "var(--color-loss)" },
};

/** Chaves das categorias do raio-X. */
type CategoryKey = "correct" | "partial" | "wrong";

/** Ordem fixa de categorias (legenda + donut). */
const CATEGORIES: ReadonlyArray<{
  key: CategoryKey;
  label: string;
  color: string;
}> = [
  { key: "correct", label: "Exato", color: "var(--color-win)" },
  { key: "partial", label: "Vencedor", color: "var(--color-warning)" },
  { key: "wrong", label: "Erro", color: "var(--color-loss)" },
];

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

/** Placeholder animado — exibir durante isLoading (sem layout shift). */
export function RaioXCardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando raio-X dos palpites"
      className="rounded-lg border border-border bg-card p-4 shadow-sm flex flex-col gap-3"
    >
      <div className="h-3 w-2/5 rounded bg-muted animate-pulse motion-reduce:animate-none" />
      <div className="flex items-center gap-4">
        <div className="size-32 shrink-0 rounded-full bg-muted animate-pulse motion-reduce:animate-none" />
        <div className="flex flex-1 flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-3 w-full rounded bg-muted animate-pulse motion-reduce:animate-none"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legenda
// ---------------------------------------------------------------------------

function LegendRow({
  color,
  label,
  count,
  pct,
}: {
  color: string;
  label: string;
  count: number;
  pct: number;
}) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span
        aria-hidden="true"
        className="size-3 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-foreground">{label}</span>
      <span className="ml-auto font-medium tabular-nums text-muted-foreground">
        {count} ({pct}%)
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RaioXCardProps {
  breakdown: PredictionBreakdown;
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Card "Raio-X dos Palpites" com donut + legenda.
 * Empty-state explícito quando não há palpites finalizados (não donut zerado).
 */
export function RaioXCard({ breakdown }: RaioXCardProps) {
  const { correct, partial, wrong, total, isEmpty } = breakdown;

  const counts: Record<CategoryKey, number> = { correct, partial, wrong };
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  // Dados do Pie: omite segmentos zerados (evita slivers invisíveis); a legenda
  // ainda mostra a categoria com "0".
  const pieData = CATEGORIES.filter((c) => counts[c.key] > 0).map((c) => ({
    key: c.key,
    value: counts[c.key],
    color: c.color,
  }));

  // Equivalente textual do donut para leitores de tela.
  const chartAriaLabel = `${correct} placar${correct === 1 ? "" : "es"} exato${correct === 1 ? "" : "s"}, ${partial} só vencedor, ${wrong} erro${wrong === 1 ? "" : "s"}`;

  return (
    <article
      aria-label="Raio-X dos Palpites"
      className="rounded-lg border border-border bg-card p-4 shadow-sm flex flex-col gap-3"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Raio-X dos Palpites
      </h2>

      {isEmpty ? (
        /* Empty-state — sem donut zerado */
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <PieChartIcon
            size={32}
            aria-hidden="true"
            className="text-muted-foreground"
          />
          <p className="text-sm text-muted-foreground">
            Faça seu primeiro palpite para ver seu raio-X.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          {/* Donut com total no centro.
              role=img + aria-label no wrapper: ChartContainer não repassa rest
              props ao div, então o equivalente textual fica aqui (role=img
              impede o SR de mergulhar no SVG do recharts). */}
          <div
            role="img"
            aria-label={chartAriaLabel}
            className="relative size-40 shrink-0"
          >
            <ChartContainer config={raioXConfig} className="h-40 w-40">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="key"
                  innerRadius={50}
                  outerRadius={70}
                  strokeWidth={0}
                  startAngle={90}
                  endAngle={-270}
                >
                  {pieData.map((slice) => (
                    <Cell key={slice.key} fill={slice.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
            >
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {total}
              </span>
              <span className="text-xs text-muted-foreground">
                {total === 1 ? "palpite" : "palpites"}
              </span>
            </div>
          </div>

          {/* Legenda */}
          <ul className="flex w-full flex-col gap-2">
            {CATEGORIES.map((c) => (
              <LegendRow
                key={c.key}
                color={c.color}
                label={c.label}
                count={counts[c.key]}
                pct={pct(counts[c.key])}
              />
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
