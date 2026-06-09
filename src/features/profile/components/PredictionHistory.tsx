"use client";

import { useState, type JSX } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  RankingEmptyState,
  RankingErrorState,
  RankingSkeleton,
} from "@/features/rankings/components";
import { cn } from "@/lib/utils";

import { usePredictionHistory, type PredictionHistoryRow } from "../hooks";
import { filterHistory, type HistoryFilter } from "../lib/predictionHistory";

const STAGE_LABEL: Record<string, string> = {
  grupos: "Fase de Grupos",
  "dezesseis-avos": "16-avos de Final",
  oitavas: "Oitavas de Final",
  quartas: "Quartas de Final",
  semifinal: "Semifinal",
  terceiro: "Disputa de 3º Lugar",
  final: "Final",
};

const TABS: { value: HistoryFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "hits", label: "Acertos" },
  { value: "misses", label: "Erros" },
];

/** Tela 03 — Histórico de Palpites (PRD06-03). */
export function PredictionHistory(): JSX.Element {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const history = usePredictionHistory();

  if (history.isLoading) return <RankingSkeleton rows={5} />;
  if (history.isError) {
    return <RankingErrorState onRetry={() => void history.refetch()} />;
  }

  const all = history.data ?? [];
  const rows = filterHistory(all, filter);

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Filtrar palpites"
        className="flex gap-1 rounded-lg bg-muted p-1"
      >
        {TABS.map((tab) => {
          const active = filter === tab.value;
          return (
            <button
              key={tab.value}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setFilter(tab.value)}
              className={cn(
                "min-h-10 flex-1 rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {rows.length === 0 ? (
        <RankingEmptyState
          message="Nenhum palpite por aqui"
          subtitle="Seus palpites aparecem aqui após registrá-los."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.matchId}>
              <HistoryCard row={row} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HistoryCard({ row }: { row: PredictionHistoryRow }): JSX.Element {
  const date = format(new Date(row.kickoffAt), "dd/MM", { locale: ptBR });
  const stage = STAGE_LABEL[row.stage] ?? row.stage;
  const home = row.homeTeam?.name ?? row.homeTeamId;
  const away = row.awayTeam?.name ?? row.awayTeamId;

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {date} · {stage}
        </span>
        <PointsBadge row={row} />
      </div>

      <div className="flex items-center justify-center gap-3 text-sm font-medium text-foreground">
        <span className="flex-1 text-right">{home}</span>
        <span className="rounded-md bg-muted px-2 py-0.5 font-bold tabular-nums">
          {row.predicted.home} <span className="text-muted-foreground">x</span>{" "}
          {row.predicted.away}
        </span>
        <span className="flex-1 text-left">{away}</span>
      </div>

      <ResultLabel row={row} />
    </article>
  );
}

function PointsBadge({ row }: { row: PredictionHistoryRow }): JSX.Element {
  if (row.result === "pending") {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        —
      </span>
    );
  }
  const isHit = row.result === "exact";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        isHit ? "bg-win-bg text-win" : "bg-loss-bg text-loss",
      )}
    >
      {isHit ? "+1 pt" : "0 pt"}
    </span>
  );
}

function ResultLabel({ row }: { row: PredictionHistoryRow }): JSX.Element {
  const color =
    row.result === "exact"
      ? "text-win"
      : row.result === "wrong"
        ? "text-loss"
        : "text-muted-foreground";
  return (
    <span className={cn("text-xs font-medium", color)}>{row.resultLabel}</span>
  );
}
