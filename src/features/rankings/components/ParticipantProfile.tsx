"use client";

import { useMemo, type JSX } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMatches } from "@/features/matches/hooks";
import {
  groupProfilePredictions,
  deriveBettorDna,
  deriveProfileComparison,
  derivePredictionsCount,
  type PredictionPhaseBucket,
} from "@/features/rankings/lib";
import {
  useParticipantProfile,
  usePoolRanking,
  usePoolRankingByScope,
  useProfilePredictions,
} from "@/features/rankings/hooks";
import { useAuth } from "@/hooks/useAuth";
import type { Ranking, RankingEntry, Statistics } from "@/types";

import { RankingEmptyState } from "./RankingEmptyState";
import { RankingErrorState } from "./RankingErrorState";
import { RankingSkeleton } from "./RankingSkeleton";
import {
  BettorDnaCard,
  ProfileComparisonCard,
  ProfilePredictionsList,
} from "./profile";

const STAGE_LABELS = [
  { scope: "grupos", label: "Fase de Grupos" },
  { scope: "oitavas", label: "Oitavas de Final" },
  { scope: "quartas", label: "Quartas de Final" },
  { scope: "semifinal", label: "Semifinal" },
  { scope: "final", label: "Final" },
] as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

function deriveOpenPhase(
  buckets: PredictionPhaseBucket[],
): "grupos" | "eliminatoria" {
  for (const b of buckets) {
    if (b.subBuckets.some((sb) => sb.items.some((i) => i.matchStatus === "live"))) {
      return b.phase;
    }
  }
  if (buckets.some((b) => b.phase === "eliminatoria" && b.totalItems > 0)) {
    return "eliminatoria";
  }
  return "grupos";
}

interface ParticipantProfileProps {
  uid: string;
}

export function ParticipantProfile({
  uid,
}: ParticipantProfileProps): JSX.Element {
  const { profile } = useAuth();
  const currentUid = profile?.uid;
  const isSelf = currentUid === uid;

  const myGroupId = profile?.groupId;
  const rankingQuery = usePoolRanking(myGroupId);
  // Split por fase (split-phase-ranking TASK-05): flag embutida no payload do
  // ranking do pool (TASK-02). Gating: as 2 leituras de escopo só disparam quando
  // a flag está ON (`enabled`). Hooks chamados sempre (regras de hooks).
  const splitOn = rankingQuery.data?.splitPhaseRanking === true;
  const gruposQuery = usePoolRankingByScope("grupos", { enabled: splitOn });
  const eliminatoriasQuery = usePoolRankingByScope("eliminatorias", { enabled: splitOn });
  const statsQuery = useParticipantProfile(uid);
  const predictionsQuery = useProfilePredictions(uid, isSelf);
  // Own predictions only needed for ProfileComparisonCard when viewing another profile
  const myPredictionsQuery = useProfilePredictions(
    isSelf ? undefined : currentUid,
    true,
  );
  const matchesQuery = useMatches();

  const isLoading =
    rankingQuery.isLoading ||
    gruposQuery.isLoading ||
    eliminatoriasQuery.isLoading ||
    statsQuery.isLoading ||
    predictionsQuery.isLoading;
  const isError =
    rankingQuery.isError ||
    gruposQuery.isError ||
    eliminatoriasQuery.isError ||
    statsQuery.isError ||
    predictionsQuery.isError;

  const items = predictionsQuery.items;
  const allMatches = matchesQuery.data ?? [];

  const buckets = useMemo(() => groupProfilePredictions(items), [items]);
  const openPhase = useMemo(() => deriveOpenPhase(buckets), [buckets]);
  const dna = useMemo(() => deriveBettorDna(items), [items]);
  const predictionsCount = useMemo(
    () => derivePredictionsCount(items, allMatches, new Date()),
    [items, allMatches],
  );
  // Os 3 cards contam TIPOS DE ACERTO em jogos encerrados (displayStatus só
  // assume estes valores quando finished): "acertou" = placar exato; "acertou_vencedor"
  // = errou placar mas acertou o vencedor; "acertou_empate" = errou placar mas acertou
  // que foi empate. NÃO é entry.points (ponderado) nem tendência de aposta.
  const exactHits = useMemo(
    () => items.filter((i) => i.displayStatus === "acertou").length,
    [items],
  );
  const wins = useMemo(
    () => items.filter((i) => i.displayStatus === "acertou_vencedor").length,
    [items],
  );
  const draws = useMemo(
    () => items.filter((i) => i.displayStatus === "acertou_empate").length,
    [items],
  );

  if (isLoading) return <RankingSkeleton />;
  if (isError) {
    return (
      <RankingErrorState
        onRetry={() => {
          void rankingQuery.refetch();
          void statsQuery.refetch();
          void predictionsQuery.refetch();
        }}
      />
    );
  }

  const entry = rankingQuery.data?.entries.find((e) => e.uid === uid) ?? null;
  if (!entry) return <RankingEmptyState message="Participante não encontrado" />;

  const stats = statsQuery.data ?? null;
  const displayName = entry.name ?? entry.nickname;

  const myEntry = !isSelf
    ? (rankingQuery.data?.entries.find((e) => e.uid === currentUid) ?? null)
    : null;

  const myFinished = myPredictionsQuery.items.filter(
    (i) => i.matchStatus === "finished",
  );
  const otherFinished = items.filter((i) => i.matchStatus === "finished");

  const comparison =
    myEntry && !isSelf
      ? deriveProfileComparison(myEntry, entry, myFinished, otherFinished)
      : null;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <ProfileIdentity
        entry={entry}
        displayName={isSelf ? "Meu Perfil" : displayName}
        nickname={entry.nickname}
        isSelf={isSelf}
      />
      {splitOn ? (
        <DualPositionCard
          grupos={findScopePosition(gruposQuery.data, uid)}
          eliminatorias={findScopePosition(eliminatoriasQuery.data, uid)}
        />
      ) : (
        <CurrentPositionCard
          position={entry.position}
          total={rankingQuery.data?.entries.length ?? 0}
        />
      )}
      <ProfileStatsGrid exactHits={exactHits} wins={wins} draws={draws} longestStreak={stats?.longestStreak} />
      <StagePerformance stats={stats} />

      {isSelf && <BettorDnaCard dna={dna} />}

      {!isSelf && myEntry && comparison && (
        <ProfileComparisonCard
          myEntry={myEntry}
          otherEntry={entry}
          comparison={comparison}
          displayName={displayName}
          isLoading={myPredictionsQuery.isLoading}
        />
      )}

      {items.length > 0 && (
        <ProfilePredictionsList
          buckets={buckets}
          isSelf={isSelf}
          openPhase={openPhase}
          predictionsCount={predictionsCount}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Sub-components (internal — not exported from barrel)
// ──────────────────────────────────────────────────────────────────

function ProfileIdentity({
  entry,
  displayName,
  nickname,
  isSelf,
}: {
  entry: RankingEntry;
  displayName: string;
  nickname: string;
  isSelf: boolean;
}): JSX.Element {
  return (
    <section className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
      <Avatar className="h-20 w-20" role="img" aria-label={displayName}>
        <AvatarImage src={entry.avatarUrl} alt="" />
        <AvatarFallback className="text-lg font-semibold">
          {initials(isSelf ? (entry.name ?? entry.nickname) : displayName)}
        </AvatarFallback>
      </Avatar>
      <h2 className="text-xl font-semibold text-foreground">{displayName}</h2>
      <p className="text-sm text-muted-foreground">@{nickname}</p>
      {!isSelf && (
        <p
          role="status"
          className="rounded-full bg-muted px-3 py-0.5 text-xs text-muted-foreground"
        >
          Apenas jogos encerrados
        </p>
      )}
    </section>
  );
}

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
      <p className="text-sm tabular-nums text-muted-foreground">
        de {total} participantes
      </p>
    </section>
  );
}

/** Posição/total de um usuário num escopo, ou `null` se ausente. */
interface ScopePosition {
  position: number;
  total: number;
}

/**
 * Localiza posição/total de um usuário num ranking de escopo (split-phase-ranking
 * TASK-05). `null` quando o doc da fase não existe ainda (`ranking == null`) ou o
 * usuário não tem entry nesse escopo — a UI degrada para "—".
 */
function findScopePosition(
  ranking: Ranking | null | undefined,
  uid: string,
): ScopePosition | null {
  if (!ranking) return null;
  const entry = ranking.entries.find((e) => e.uid === uid);
  if (!entry) return null;
  return { position: entry.position, total: ranking.entries.length };
}

/**
 * Card de posição dividido por fase (split-phase-ranking TASK-05). Dois blocos
 * lado a lado: "Grupos" e "Eliminatórias". Bloco sem dados (`null`) mostra "—".
 */
function DualPositionCard({
  grupos,
  eliminatorias,
}: {
  grupos: ScopePosition | null;
  eliminatorias: ScopePosition | null;
}): JSX.Element {
  return (
    <section className="grid grid-cols-2 gap-3">
      <ScopePositionBlock label="Grupos" data={grupos} />
      <ScopePositionBlock label="Eliminatórias" data={eliminatorias} />
    </section>
  );
}

function ScopePositionBlock({
  label,
  data,
}: {
  label: string;
  data: ScopePosition | null;
}): JSX.Element {
  return (
    <div
      className="rounded-xl border border-border bg-card p-4 text-center shadow-sm"
      aria-label={
        data
          ? `${label}: posição ${data.position} de ${data.total} participantes`
          : `${label}: ainda sem dados`
      }
    >
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      {data ? (
        <>
          <p className="text-4xl font-bold tabular-nums text-primary">#{data.position}</p>
          <p className="text-sm tabular-nums text-muted-foreground">
            de {data.total} participantes
          </p>
        </>
      ) : (
        <>
          <p className="text-4xl font-bold tabular-nums text-muted-foreground">—</p>
          <p className="text-sm text-muted-foreground">Ainda sem dados</p>
        </>
      )}
    </div>
  );
}

function ProfileStatsGrid({
  exactHits,
  wins,
  draws,
  longestStreak,
}: {
  exactHits: number;
  wins: number;
  draws: number;
  longestStreak?: number | null;
}): JSX.Element {
  const metrics: ReadonlyArray<{ label: string; value: string }> = [
    { label: "Acertos", value: String(exactHits) },
    { label: "Vitórias", value: String(wins) },
    { label: "Empates", value: String(draws) },
  ];

  return (
    <section aria-labelledby="stats-heading" className="flex flex-col gap-2">
      <h3
        id="stats-heading"
        className="sr-only"
      >
        Métricas
      </h3>
      <dl className="grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <dt className="text-xs font-medium text-muted-foreground">
              {m.label}
            </dt>
            <dd className="text-2xl font-bold tabular-nums text-primary">
              {m.value}
            </dd>
          </div>
        ))}
      </dl>
      {longestStreak != null && (
        <p className="text-sm text-muted-foreground">
          Sequência Máx.:{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {longestStreak}
          </span>
        </p>
      )}
    </section>
  );
}

function StagePerformance({
  stats,
}: {
  stats: Statistics | null;
}): JSX.Element | null {
  if (!stats) return null;

  const visibleStages = STAGE_LABELS.filter(
    ({ scope }) => (stats.correctByStage[scope] ?? 0) > 0,
  );

  if (visibleStages.length === 0) return null;

  return (
    <section aria-labelledby="stage-perf-heading" className="flex flex-col gap-2">
      <h3
        id="stage-perf-heading"
        className="text-lg font-semibold text-foreground"
      >
        Desempenho por Fase
      </h3>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visibleStages.map(({ scope, label }) => {
          const pts = stats.correctByStage[scope] ?? 0;
          return (
            <li
              key={scope}
              className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3"
            >
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-base font-bold tabular-nums text-primary">
                {pts} pts
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
