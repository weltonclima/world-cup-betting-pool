"use client";

/**
 * HeroCard — bloco de destaque da Home (TASK-01 home-revamp).
 *
 * Substitui o trio compacto Ranking/Acertos/Aproveitamento por um Hero único:
 * posição + tendência, aproveitamento com denominador, maior sequência, pontos,
 * sparkline de evolução de posição e régua de percentil vs o bolão.
 *
 * Componente presentacional puro: recebe `HeroSummary` por prop, sem fetch.
 * Contrato visual: ai/ui-spec/task-home-revamp-01.md.
 */

import { ArrowDown, ArrowUp, Flame, Minus, TrendingUp } from "lucide-react";
import { Line, LineChart, YAxis } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type {
  HeroSummary,
  HeroSummaryByScope,
} from "@/features/home/lib/homeDashboardHelpers";

const numberFormatter = new Intl.NumberFormat("pt-BR");

const sparklineConfig: ChartConfig = {
  position: { label: "Posição", color: "var(--chart-1)" },
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

/** Placeholder animado do Hero — exibir durante isLoading (sem layout shift). */
export function HeroCardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando seu desempenho"
      className="rounded-lg border border-border bg-card p-4 shadow-sm flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <div className="h-3 w-2/5 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        <div className="h-4 w-12 rounded bg-muted animate-pulse motion-reduce:animate-none" />
      </div>
      <div className="h-10 w-1/2 rounded bg-muted animate-pulse motion-reduce:animate-none" />
      <div className="h-12 w-full rounded bg-muted animate-pulse motion-reduce:animate-none" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-12 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        <div className="h-12 rounded bg-muted animate-pulse motion-reduce:animate-none" />
      </div>
      <div className="h-8 w-full rounded bg-muted animate-pulse motion-reduce:animate-none" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes internos
// ---------------------------------------------------------------------------

/** Chip de tendência: ícone + delta. Cor não é único indicador (ícone + texto). */
function TrendChip({ trend }: { trend: NonNullable<HeroSummary["trend"]> }) {
  const { direction, delta, roundLabel } = trend;

  const config = {
    up: { Icon: ArrowUp, className: "text-win", label: `Subiu ${delta}` },
    down: { Icon: ArrowDown, className: "text-loss", label: `Caiu ${delta}` },
    stable: { Icon: Minus, className: "text-muted-foreground", label: "Estável" },
  }[direction];

  const { Icon, className, label } = config;

  return (
    <span
      className={`flex items-center gap-1 text-sm font-medium tabular-nums ${className}`}
      aria-label={`Tendência: ${label}${roundLabel ? ` (${roundLabel})` : ""}`}
    >
      <Icon size={16} aria-hidden="true" />
      {direction !== "stable" && <span>{delta}</span>}
      {roundLabel && (
        <span className="text-xs text-muted-foreground">({roundLabel})</span>
      )}
    </span>
  );
}

/** Sparkline de evolução de posição (eixo invertido: menor = melhor, no topo). */
function Sparkline({ positions }: { positions: number[] }) {
  const data = positions.map((position, i) => ({ i, position }));
  const first = positions[0];
  const last = positions[positions.length - 1];

  return (
    <div>
      {/* aria-hidden no wrapper: ChartContainer não repassa rest props ao div,
          então ocultamos o SVG do recharts aqui. Equivalente textual em sr-only abaixo. */}
      <div aria-hidden="true">
        <ChartContainer config={sparklineConfig} className="h-12 w-full">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <YAxis reversed hide domain={["dataMin", "dataMax"]} />
            <Line
              type="monotone"
              dataKey="position"
              stroke="var(--color-position)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      </div>
      <span className="sr-only">
        Evolução da posição: {first} a {last} nas últimas {positions.length} atualizações.
      </span>
    </div>
  );
}

/** Régua de percentil (padrão bullet chart) — SVG inline, geometria por atributos. */
function PercentileRuler({ ruler }: { ruler: NonNullable<HeroSummary["ruler"]> }) {
  const { lowest, average, highest, userPoints, fraction, averageFraction, label } = ruler;

  const userX = fraction * 100;
  const avgX = averageFraction * 100;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Você no bolão
      </span>
      <svg
        viewBox="0 0 100 12"
        preserveAspectRatio="none"
        className="w-full h-3"
        role="img"
        aria-label={`Você tem ${numberFormatter.format(userPoints)} pontos. O bolão varia de ${numberFormatter.format(lowest)} a ${numberFormatter.format(highest)} pontos, média ${numberFormatter.format(average)}. Você está ${label}.`}
      >
        {/* trilho */}
        <rect x="0" y="4" width="100" height="4" rx="2" className="fill-muted" />
        {/* preenchimento até o usuário */}
        <rect x="0" y="4" width={userX} height="4" rx="2" className="fill-primary" />
        {/* marcador da média — vector-effect evita distorção do preserveAspectRatio="none" */}
        <line
          x1={avgX}
          y1="1"
          x2={avgX}
          y2="11"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          className="stroke-muted-foreground"
        />
        {/* marcador do usuário — barra estreita (não-distorce como um circle esticado) */}
        <rect x={userX} y="1" width="1.5" height="10" rx="0.75" className="fill-primary" />
      </svg>
      <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
        <span>mín {numberFormatter.format(lowest)}</span>
        <span>média {numberFormatter.format(average)}</span>
        <span>máx {numberFormatter.format(highest)}</span>
      </div>
      {/* capitaliza só a 1ª letra na exibição (fonte fica lowercase p/ a frase do aria-label) */}
      <span className="inline-block text-sm font-medium text-foreground first-letter:uppercase">
        {label}
      </span>
    </div>
  );
}

/**
 * Bloco compacto de um escopo no ramo split (split-phase-ranking TASK-05).
 * Mostra só o essencial por fase: posição/total + pontos. Sparkline/régua/
 * métricas secundárias NÃO entram aqui (não há statistics por escopo). Quando
 * `summary` é `null` (doc da fase inexistente) ou `isEmpty` (usuário sem entry),
 * degrada para "Ainda sem dados".
 */
function HeroScopeBlock({ label, summary }: { label: string; summary: HeroSummary | null }) {
  const position = summary != null && !summary.isEmpty ? summary.position : null;

  if (summary == null || position == null) {
    return (
      <div
        className="flex flex-col gap-1 rounded-md border border-border bg-background/50 p-3"
        aria-label={`${label}: ainda sem dados`}
      >
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-3xl font-bold tabular-nums text-muted-foreground">—</span>
        <span className="text-xs text-muted-foreground">Ainda sem dados</span>
      </div>
    );
  }

  const { totalParticipants, points } = summary;

  return (
    <div
      className="flex flex-col gap-1 rounded-md border border-border bg-background/50 p-3"
      aria-label={
        `${label}: posição ${position} de ${totalParticipants ?? "?"}` +
        (points != null ? `, ${points} pontos` : "")
      }
    >
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tabular-nums text-foreground">
          {`#${numberFormatter.format(position)}`}
        </span>
        {totalParticipants != null && (
          <span className="text-xs text-muted-foreground">
            de {numberFormatter.format(totalParticipants)}
          </span>
        )}
      </div>
      {points != null && (
        <span className="text-sm font-medium tabular-nums text-foreground">
          {numberFormatter.format(points)} pts
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface HeroCardProps {
  summary: HeroSummary;
  /**
   * Hero dividido por fase (split-phase-ranking TASK-05). Quando presente (flag
   * ON), renderiza dois blocos compactos (Grupos | Eliminatórias) no lugar do
   * hero único. `undefined` → hero único atual (ramo OFF, retrocompat).
   */
  summaryByScope?: HeroSummaryByScope;
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Hero da Home. Renderiza estado empty intencional para conta nova/pré-torneio.
 */
export function HeroCard({ summary, summaryByScope }: HeroCardProps) {
  // Ramo split (flag ON): dois blocos compactos lado a lado (Grupos|Eliminatórias).
  // Omite sparkline/régua/métricas — não há statistics por escopo (ver ui-spec §2).
  if (summaryByScope) {
    return (
      <article
        aria-label="Sua posição no bolão por fase"
        className="rounded-lg border border-border bg-card p-4 shadow-sm flex flex-col gap-3"
      >
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Sua posição no bolão
        </span>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <HeroScopeBlock label="Grupos" summary={summaryByScope.grupos} />
          <HeroScopeBlock label="Eliminatórias" summary={summaryByScope.eliminatorias} />
        </div>
      </article>
    );
  }

  if (summary.isEmpty) {
    return (
      <article
        aria-label="Seu desempenho no bolão"
        className="rounded-lg border border-border bg-card p-4 shadow-sm flex flex-col items-center gap-2 py-8"
      >
        <TrendingUp size={32} aria-hidden="true" className="text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center">
          Seu desempenho aparece aqui após o primeiro jogo.
        </p>
      </article>
    );
  }

  const {
    position,
    totalParticipants,
    points,
    trend,
    accuracy,
    totalCorrect,
    denominator,
    longestStreak,
    sparkline,
    ruler,
  } = summary;

  return (
    <article
      aria-label="Seu desempenho no bolão"
      className="rounded-lg border border-border bg-card p-4 shadow-sm flex flex-col gap-3"
    >
      {/* Label + tendência */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Sua posição no bolão
        </span>
        {trend && <TrendChip trend={trend} />}
      </div>

      {/* Número herói + pontos */}
      <div className="flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tabular-nums text-foreground">
            {position != null ? `#${numberFormatter.format(position)}` : "—"}
          </span>
          {totalParticipants != null && (
            <span className="text-sm text-muted-foreground">
              de {numberFormatter.format(totalParticipants)}
            </span>
          )}
        </div>
        {points != null && (
          <span className="text-sm font-medium tabular-nums text-foreground">
            {numberFormatter.format(points)} pts
          </span>
        )}
      </div>

      {/* Sparkline de evolução */}
      {sparkline && <Sparkline positions={sparkline} />}

      {/* Métricas secundárias */}
      <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Aproveitamento
          </span>
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {Math.round(accuracy)}%
          </span>
          {denominator != null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {numberFormatter.format(totalCorrect)} de {numberFormatter.format(denominator)} palpites
            </span>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Maior sequência
          </span>
          <span className="flex items-center gap-1 text-2xl font-bold tabular-nums text-foreground">
            <Flame size={20} aria-hidden="true" className="text-muted-foreground" />
            {numberFormatter.format(longestStreak)}
          </span>
        </div>
      </div>

      {/* Régua de percentil */}
      {ruler && (
        <div className="border-t border-border pt-3">
          <PercentileRuler ruler={ruler} />
        </div>
      )}
    </article>
  );
}
