"use client";

import type { JSX } from "react";
import { Percent, Target, Trophy, XCircle, type LucideIcon } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useMyRanking, useParticipantProfile } from "@/features/rankings";
import {
  RankingEmptyState,
  RankingErrorState,
  RankingSkeleton,
} from "@/features/rankings/components";
import type { RankingEntry, Statistics } from "@/types";

// Fases com ranking (ordem de exibição do gráfico "Desempenho por Fase").
const PHASES: { key: string; label: string }[] = [
  { key: "grupos", label: "Grupos" },
  { key: "oitavas", label: "Oitavas" },
  { key: "quartas", label: "Quartas" },
  { key: "semifinal", label: "Semi" },
  { key: "final", label: "Final" },
];

/** Tela 02 — Estatísticas Pessoais (PRD06-02). Compõe de `features/rankings`. */
export function PersonalStats(): JSX.Element {
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
        message="Você ainda não tem estatísticas"
        subtitle="Faça seus palpites e volte após a apuração."
      />
    );
  }

  return (
    <PopulatedStats
      entry={myRanking.data.entry}
      total={myRanking.data.total}
      statistics={profile.data}
    />
  );
}

function PopulatedStats({
  entry,
  total,
  statistics,
}: {
  entry: RankingEntry;
  total: number;
  statistics: Statistics;
}): JSX.Element {
  // Pontos = total PONDERADO (placar exato 10, vencedor/empate 5). Acertos Exatos =
  // só os placares cheios (totalCorrect) — distinto dos pontos.
  const points = entry.points;
  const correct = statistics.totalCorrect;
  const partial = statistics.totalPartial ?? 0; // parciais (vencedor/empate, 5)
  const wrong = statistics.totalWrong ?? 0;
  // Jogos jogados = exatos + parciais + erros (denominador real do aproveitamento).
  const played = correct + partial + wrong;
  const accuracy = entry.accuracy ?? statistics.accuracy;
  const byStage = statistics.correctByStage ?? {};
  const maxStage = Math.max(
    1,
    ...PHASES.map((p) => (byStage as Record<string, number>)[p.key] ?? 0),
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Header verde — posição geral */}
      <div
        className="rounded-2xl bg-primary p-6 text-center text-primary-foreground"
        aria-label={`Posição geral: número ${entry.position} de ${total} participantes`}
      >
        <p className="text-sm font-medium opacity-90">Posição Geral</p>
        <span className="text-4xl font-bold tabular-nums">#{entry.position}</span>
        <p className="mt-1 text-sm opacity-90 tabular-nums">
          de {total} participantes
        </p>
      </div>

      {/* Grid de métricas (pontuação ponderada) */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Pontos" value={String(points)} icon={Trophy} />
        <StatCard label="Acertos Exatos" value={String(correct)} icon={Target} />
        <StatCard label="Erros" value={String(wrong)} icon={XCircle} />
        <StatCard
          label="Aproveitamento"
          value={`${accuracy}%`}
          hint={`${correct} de ${played} jogos`}
          icon={Percent}
        />
      </div>
      <p className="px-1 text-xs text-muted-foreground">
        Placar exato vale 10 pontos. Acertar só o vencedor ou o empate vale 5.
      </p>

      {/* Desempenho por fase */}
      <section className="flex flex-col gap-3" aria-labelledby="desempenho-fase">
        <h2
          id="desempenho-fase"
          className="text-lg font-medium text-foreground"
        >
          Desempenho por Fase
        </h2>
        <div className="flex items-end justify-between gap-2 rounded-lg border border-border bg-card p-4">
          {PHASES.map((phase) => {
            const value = (byStage as Record<string, number>)[phase.key] ?? 0;
            const heightPct = Math.round((value / maxStage) * 100);
            return (
              <div
                key={phase.key}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <span className="text-xs font-semibold tabular-nums text-foreground">
                  {value}
                </span>
                <div className="flex h-24 w-full items-end justify-center">
                  {/* `style={{ height }}` — mesma exceção documentada de
                      DistributionBars: altura é DADO (proporção), não estilo. */}
                  <div
                    className="w-5 rounded-t bg-primary"
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                    role="img"
                    aria-label={`${phase.label}: ${value} acertos`}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {phase.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

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
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon size={16} aria-hidden="true" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className="text-3xl font-bold tabular-nums text-primary">{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
