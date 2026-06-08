"use client";

import type { JSX } from "react";
import Link from "next/link";
import {
  Award,
  Percent,
  Target,
  TrendingUp,
  Trophy,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useMyRanking, useParticipantProfile } from "@/features/rankings";
import {
  averagePointsPerRound,
  bestPosition,
  geralHistory,
  roundsCount,
  toEvolutionPoints,
} from "@/features/rankings/lib";
import { Badge } from "@/components/ui/badge";
import type { RankingEntry, Statistics } from "@/types";

import { EvolutionLineChart } from "./charts/EvolutionLineChart";
import { RankingSkeleton } from "./RankingSkeleton";
import { RankingEmptyState } from "./RankingEmptyState";
import { RankingErrorState } from "./RankingErrorState";

const percentFmt = (value: number): string => `${value}%`;

/** Tela 02 — Meu Ranking (resumo pessoal) (PRD-05, TASK-10). */
export function MyRanking(): JSX.Element {
  const uid = useAuth().firebaseUser?.uid;
  const myRanking = useMyRanking();
  const profile = useParticipantProfile(uid);

  if (myRanking.isLoading || profile.isLoading) {
    return <RankingSkeleton rows={6} />;
  }

  if (myRanking.isError || profile.isError) {
    return (
      <RankingErrorState
        onRetry={() => {
          void myRanking.refetch();
          void profile.refetch();
        }}
      />
    );
  }

  if (!myRanking.data || !profile.data) {
    return (
      <RankingEmptyState
        message="Você ainda não está no ranking"
        subtitle="Faça seus palpites e volte após a apuração."
      />
    );
  }

  return (
    <PopulatedMyRanking
      entry={myRanking.data.entry}
      total={myRanking.data.total}
      statistics={profile.data}
    />
  );
}

// ───────────────────────── Conteúdo populado ─────────────────────────
function PopulatedMyRanking({
  entry,
  total,
  statistics,
}: {
  entry: RankingEntry;
  total: number;
  statistics: Statistics;
}): JSX.Element {
  const geral = geralHistory(statistics.positionHistory);
  const evolution = toEvolutionPoints(geral);
  const best = bestPosition(geral);
  const rounds = roundsCount(geral);
  const average = averagePointsPerRound(entry.points, rounds);

  // Pontos === Acertos (binário). Ver spec §6.1.
  const points = entry.points;
  const totalWrong = statistics.totalWrong;
  const errosValue = totalWrong === undefined ? "—" : String(totalWrong);

  const accuracy = entry.accuracy ?? statistics.accuracy;
  const correct = statistics.totalCorrect;
  const playedGames = correct + (totalWrong ?? 0);
  const accuracyHint = `${correct} de ${playedGames} jogos`;

  const evolutionSummary =
    evolution.length > 0
      ? `Posição por rodada: ${evolution
          .map((p) => `${p.label} #${p.position}`)
          .join(", ")}.`
      : "Sem histórico de posições ainda.";

  return (
    <div className="flex flex-col gap-4">
      <MyRankingHeader position={entry.position} total={total} />

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Pontos" value={String(points)} icon={Trophy} />
        <StatCard
          label="Acertos"
          value={String(points)}
          hint="Cada placar exato vale 1 ponto — pontos e acertos são o mesmo número."
          icon={Target}
        />
        <StatCard label="Erros" value={errosValue} icon={XCircle} />
        <StatCard
          label="Aproveitamento"
          value={percentFmt(accuracy)}
          hint={accuracyHint}
          icon={Percent}
        />
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="desempenho-geral">
        <div className="flex items-center justify-between gap-2">
          <h2 id="desempenho-geral" className="text-lg font-medium text-foreground">
            Desempenho Geral
          </h2>
          <Link
            href="/rankings/evolucao"
            className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-primary underline-offset-4 transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver evolução
          </Link>
        </div>
        <div role="img" aria-label={evolutionSummary}>
          <p className="sr-only">{evolutionSummary}</p>
          <EvolutionLineChart data={evolution} />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Melhor Posição"
          value={best === null ? "—" : `#${best.position}`}
          hint={best === null ? undefined : `Rodada ${best.round}`}
          icon={Award}
        />
        <StatCard
          label="Média de Pontos"
          value={average}
          hint="por rodada"
          icon={TrendingUp}
        />
      </div>
    </div>
  );
}

// ───────────────────────── Header verde (hero) ─────────────────────────
function MyRankingHeader({
  position,
  total,
}: {
  position: number;
  total: number;
}): JSX.Element {
  return (
    <div
      className="rounded-2xl bg-primary p-6 text-center text-primary-foreground"
      aria-label={`Sua posição atual: número ${position} de ${total} participantes`}
    >
      <p className="text-sm font-medium opacity-90">Sua Posição Atual</p>
      <div className="mt-1 flex items-center justify-center gap-2">
        <span className="text-4xl font-bold tabular-nums">#{position}</span>
        <Badge className="bg-primary-foreground text-primary">Você</Badge>
      </div>
      <p className="mt-1 text-sm opacity-90 tabular-nums">
        de {total} participantes
      </p>
    </div>
  );
}

// ───────────────────────── Card de métrica ─────────────────────────
function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 shadow-none">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon size={16} aria-hidden="true" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className="text-3xl font-bold tabular-nums text-primary">
        {value}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
