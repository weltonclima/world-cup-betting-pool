"use client";

import type { JSX } from "react";

import { usePoolStats } from "@/features/rankings/hooks/usePoolStats";
import { DistributionBars } from "@/features/rankings/components/charts/DistributionBars";

import { RankingSkeleton } from "./RankingSkeleton";
import { RankingEmptyState } from "./RankingEmptyState";
import { RankingErrorState } from "./RankingErrorState";

const integerFormatter = new Intl.NumberFormat("pt-BR");
const averageFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Card de métrica (card-via-classes; padrão do app, sem Card Shadcn). */
function StatCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-3xl font-bold tabular-nums text-primary">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{sublabel}</span>
    </div>
  );
}

/** Tela 06 — Estatísticas Gerais (visão agregada do bolão) (PRD-05, TASK-13). */
export function PoolStatsScreen(): JSX.Element {
  const { data, isLoading, isError, refetch } = usePoolStats();

  if (isLoading) return <RankingSkeleton />;
  if (isError) return <RankingErrorState onRetry={() => void refetch()} />;
  if (data === null || data === undefined || data.totalParticipants === 0) {
    return (
      <RankingEmptyState
        message="Sem estatísticas ainda"
        subtitle="As estatísticas aparecem após o primeiro recálculo."
      />
    );
  }

  const showDistribution = data.distribution.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <header className="rounded-2xl bg-primary p-6 text-center text-primary-foreground">
        <p className="text-sm font-medium opacity-90">Visão Geral do Bolão</p>
        <p className="text-4xl font-bold tabular-nums">
          {integerFormatter.format(data.totalParticipants)}
        </p>
        <p className="text-sm font-medium opacity-90">Participantes</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Maior Pontuação"
          value={integerFormatter.format(data.highestPoints)}
          sublabel={data.highestPointsName ?? "Participante"}
        />
        <StatCard
          label="Menor Pontuação"
          value={integerFormatter.format(data.lowestPoints)}
          sublabel="Participante"
        />
        <StatCard
          label="Média Geral"
          value={averageFormatter.format(data.averagePoints)}
          sublabel="pontos"
        />
        <StatCard
          label="Total de Acertos"
          value={integerFormatter.format(data.totalCorrect)}
          sublabel="placares exatos"
        />
      </div>

      {showDistribution && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-foreground">
            Distribuição de Pontuação
          </h2>
          <DistributionBars buckets={data.distribution} />
        </section>
      )}
    </div>
  );
}
