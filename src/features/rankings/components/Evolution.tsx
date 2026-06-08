"use client";

import { type JSX } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useParticipantProfile } from "@/features/rankings";
import {
  evolutionIndicator,
  geralHistory,
  toEvolutionPoints,
  type EvolutionResult,
} from "@/features/rankings/lib";

import { EvolutionLineChart } from "./charts/EvolutionLineChart";
import { RankingSkeleton } from "./RankingSkeleton";
import { RankingEmptyState } from "./RankingEmptyState";
import { RankingErrorState } from "./RankingErrorState";

const EMPTY_SUBTITLE = "Sua evolução aparece após a primeira rodada";

interface EvolutionRowData {
  round: number;
  position: number;
  indicator: EvolutionResult;
  isCurrent: boolean;
}

/** Tela 04 — Evolução no Ranking (PRD-05, TASK-11). Posição do usuário por rodada. */
export function Evolution(): JSX.Element {
  const uid = useAuth().firebaseUser?.uid;
  const { data, isLoading, isError, refetch } = useParticipantProfile(uid);

  if (isLoading) return <RankingSkeleton />;
  if (isError) return <RankingErrorState onRetry={() => void refetch()} />;

  const geral = data ? geralHistory(data.positionHistory) : [];
  if (geral.length === 0) {
    return (
      <RankingEmptyState
        message="Sem histórico ainda"
        subtitle={EMPTY_SUBTITLE}
      />
    );
  }

  const chartData = toEvolutionPoints(geral);

  // Calcula indicadores na ordem cronológica (ascendente); exibe invertido (recente no topo).
  const rowsAsc: EvolutionRowData[] = geral.map((h, i) => ({
    round: h.round ?? i + 1,
    position: h.position,
    indicator: evolutionIndicator(geral[i - 1]?.position, h.position),
    isCurrent: i === geral.length - 1,
  }));
  const rows = [...rowsAsc].reverse();

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl bg-primary p-4 text-primary-foreground">
        <h2 className="text-base font-semibold">Sua evolução nas rodadas</h2>
        <div className="mt-3 rounded-xl bg-card p-2">
          <EvolutionLineChart data={chartData} />
        </div>
      </section>

      <ol className="divide-y divide-border rounded-lg border border-border bg-card">
        {rows.map((row) => (
          <EvolutionRow key={row.round} {...row} />
        ))}
      </ol>

      <EvolutionLegend />
    </div>
  );
}

// ───────────────────────── Linha de rodada ─────────────────────────
function pluralPosicoes(delta: number): string {
  return delta === 1 ? "1 posição" : `${delta} posições`;
}

function EvolutionRow({
  round,
  position,
  indicator,
  isCurrent,
}: EvolutionRowData): JSX.Element {
  const { direction, delta } = indicator;
  const meta =
    direction === "up"
      ? {
          Icon: ArrowUp,
          className: "text-primary",
          label: `subiu ${pluralPosicoes(delta)}`,
        }
      : direction === "down"
        ? {
            Icon: ArrowDown,
            className: "text-destructive",
            label: `caiu ${pluralPosicoes(delta)}`,
          }
        : {
            Icon: Minus,
            className: "text-muted-foreground",
            label: "manteve a posição",
          };
  const { Icon } = meta;

  return (
    <li className="flex min-h-11 items-center justify-between px-4 py-3">
      <span className="flex items-center gap-2">
        <span className="text-sm text-foreground">Rodada {round}</span>
        {isCurrent && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Atual
          </span>
        )}
      </span>
      <span className="flex items-center gap-3">
        <span className="text-base font-bold tabular-nums text-foreground">
          #{position}
        </span>
        <span
          className={cn(
            "flex items-center gap-1 text-sm tabular-nums",
            meta.className,
          )}
          aria-label={meta.label}
        >
          <Icon size={16} aria-hidden="true" />
          <span aria-hidden="true">
            {direction === "same" ? "—" : delta}
          </span>
        </span>
      </span>
    </li>
  );
}

// ───────────────────────── Legenda ─────────────────────────
function EvolutionLegend(): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-foreground">Legenda</p>
      <ul className="flex flex-wrap gap-4 text-xs">
        <li className="flex items-center gap-1 text-primary">
          <ArrowUp size={14} aria-hidden="true" />
          <span>Subiu</span>
        </li>
        <li className="flex items-center gap-1 text-muted-foreground">
          <Minus size={14} aria-hidden="true" />
          <span>Manteve</span>
        </li>
        <li className="flex items-center gap-1 text-destructive">
          <ArrowDown size={14} aria-hidden="true" />
          <span>Caiu</span>
        </li>
      </ul>
    </div>
  );
}
