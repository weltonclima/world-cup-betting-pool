"use client";

import { type JSX } from "react";

import { useParticipantProfile, useRanking } from "@/features/rankings";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { RankingEntry, Statistics } from "@/types";

import { RankingSkeleton } from "./RankingSkeleton";
import { RankingEmptyState } from "./RankingEmptyState";
import { RankingErrorState } from "./RankingErrorState";

/** Fases de ranking exibidas em "Desempenho por Fase" (exclui "geral", "dezesseis-avos", "terceiro"). */
const STAGE_LABELS = [
  { scope: "grupos", label: "Fase de Grupos" },
  { scope: "oitavas", label: "Oitavas de Final" },
  { scope: "quartas", label: "Quartas de Final" },
  { scope: "semifinal", label: "Semifinal" },
  { scope: "final", label: "Final" },
] as const;

/** Iniciais p/ fallback de avatar (sem foto no schema). */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

interface ParticipantProfileProps {
  uid: string;
}

/** Tela 05 — Perfil do Participante (PRD-05, TASK-12). Somente-leitura, dados de outro participante. */
export function ParticipantProfile({
  uid,
}: ParticipantProfileProps): JSX.Element {
  const rankingQuery = useRanking("geral");
  const statsQuery = useParticipantProfile(uid);

  if (rankingQuery.isLoading || statsQuery.isLoading) {
    return <RankingSkeleton />;
  }
  if (rankingQuery.isError || statsQuery.isError) {
    return (
      <RankingErrorState
        onRetry={() => {
          void rankingQuery.refetch();
          void statsQuery.refetch();
        }}
      />
    );
  }

  const entry =
    rankingQuery.data?.entries.find((e) => e.uid === uid) ?? null;
  // Sem entry no ranking geral = participante não presente (posição/identidade vêm daí).
  if (!entry) {
    return <RankingEmptyState message="Participante não encontrado" />;
  }

  const stats = statsQuery.data ?? null;
  const displayName = entry.name ?? entry.nickname;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <ProfileIdentity entry={entry} displayName={displayName} />
      <CurrentPositionCard
        position={entry.position}
        total={rankingQuery.data?.entries.length ?? 0}
      />
      <ProfileStatsGrid entry={entry} stats={stats} />
      <StagePerformance stats={stats} />
      {/*
        A5 (bloqueador de produto, RESOLVIDO = privado): histórico de palpites de
        OUTRO participante NÃO é exibido. Botão "Ver histórico de palpites" omitido.
        Não renderizar navegação/destino. Rules negam leitura cruzada (TASK-14).
      */}
    </div>
  );
}

// ───────────────────────── Identidade ─────────────────────────
function ProfileIdentity({
  entry,
  displayName,
}: {
  entry: RankingEntry;
  displayName: string;
}): JSX.Element {
  return (
    <section className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
      <Avatar className="h-20 w-20" role="img" aria-label={displayName}>
        <AvatarFallback className="text-lg font-semibold">
          {initials(displayName)}
        </AvatarFallback>
      </Avatar>
      <h1 className="text-xl font-semibold text-foreground">{displayName}</h1>
      <p className="text-sm text-muted-foreground">@{entry.nickname}</p>
    </section>
  );
}

// ───────────────────────── Posição atual ─────────────────────────
function CurrentPositionCard({
  position,
  total,
}: {
  position: number;
  total: number;
}): JSX.Element {
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">Posição Atual</p>
      <p className="text-4xl font-bold tabular-nums text-primary">
        #{position}
      </p>
      <p className="text-sm text-muted-foreground tabular-nums">
        de {total} participantes
      </p>
    </section>
  );
}

// ───────────────────────── Grid de métricas ─────────────────────────
function ProfileStatsGrid({
  entry,
  stats,
}: {
  entry: RankingEntry;
  stats: Statistics | null;
}): JSX.Element {
  const erros = entry.wrong ?? stats?.totalWrong;
  const metrics: ReadonlyArray<{ label: string; value: string }> = [
    // Binário: Pontos === Acertos (mesmo número). Mantém ambos rótulos por fidelidade ao layout.
    { label: "Pontos", value: String(entry.points) },
    { label: "Acertos", value: String(entry.points) },
    { label: "Erros", value: erros === undefined ? "—" : String(erros) },
    {
      label: "Aproveitamento",
      value: entry.accuracy === undefined ? "—" : `${entry.accuracy}%`,
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <dt className="text-sm font-medium text-muted-foreground">
            {m.label}
          </dt>
          <dd className="text-3xl font-bold tabular-nums text-primary">
            {m.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ───────────────────────── Desempenho por fase ─────────────────────────
function StagePerformance({
  stats,
}: {
  stats: Statistics | null;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-foreground">
        Desempenho por Fase
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {STAGE_LABELS.map(({ scope, label }) => {
          const pts = stats ? (stats.correctByStage[scope] ?? 0) : null;
          return (
            <li
              key={scope}
              className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3"
            >
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-base font-bold tabular-nums text-primary">
                {pts === null ? "—" : `${pts} pts`}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
