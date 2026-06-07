"use client";

/**
 * Página do Hub de Palpites (/predictions) — TASK-07 (PRD03-01).
 *
 * Substitui a antiga lista como destino: vira a tela inicial do fluxo de
 * palpites em massa. Faz o data-fetching (useMatches + usePredictions),
 * deriva o progresso global (computeProgress) e as fases com bloqueio A6
 * (buildHubPhases), e renderiza o PredictionsHub apresentacional dentro do
 * container de tema `.palpites-theme` (shell verde — MASTER §2.4-palpites).
 *
 * Nav "Palpites" segue apontando para /predictions; o reapontamento formal do
 * fluxo (wizard + Completar Copa contínuo) é TASK-16.
 */

import { useMemo } from "react";

import { useAuth } from "@/hooks/useAuth";
import { useMatches } from "@/features/matches/hooks";
import { usePredictions } from "@/features/predictions/hooks";
import {
  PredictionsHub,
  buildHubPhases,
  type HubPhaseInput,
  type PhaseHubItem,
} from "@/features/predictions/components";
import { computeProgress } from "@/features/predictions/lib";
import type { Stage } from "@/types";

/** Ordem fixa das 7 fases no Hub + rótulo e destino de cada uma. */
const HUB_PHASES: ReadonlyArray<{ stage: Stage; title: string; href: string }> = [
  { stage: "grupos", title: "Fase de Grupos", href: "/predictions/grupos" },
  {
    stage: "dezesseis-avos",
    title: "16 Avos de Final",
    href: "/predictions/chave/dezesseis-avos",
  },
  { stage: "oitavas", title: "Oitavas de Final", href: "/predictions/chave/oitavas" },
  { stage: "quartas", title: "Quartas de Final", href: "/predictions/chave/quartas" },
  { stage: "semifinal", title: "Semifinal", href: "/predictions/chave/semifinal" },
  {
    stage: "terceiro",
    title: "Disputa de 3º Lugar",
    href: "/predictions/chave/terceiro",
  },
  { stage: "final", title: "Final", href: "/predictions/chave/final" },
];

export default function PredictionsHubPage() {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  const matchesQuery = useMatches();
  const predictionsQuery = usePredictions(uid);

  const isLoading =
    uid === null || matchesQuery.isLoading || predictionsQuery.isLoading;
  const isError = matchesQuery.isError || predictionsQuery.isError;

  const progress = useMemo(
    () =>
      computeProgress(
        predictionsQuery.data ?? [],
        matchesQuery.data ?? [],
      ),
    [predictionsQuery.data, matchesQuery.data],
  );

  const phases = useMemo<PhaseHubItem[]>(() => {
    const inputs: HubPhaseInput[] = HUB_PHASES.map((p) => {
      const stageMetrics = progress.byStage[p.stage];
      return {
        stage: p.stage,
        title: p.title,
        href: p.href,
        gamesCount: stageMetrics?.total ?? 0,
        filledCount: stageMetrics?.filled ?? 0,
      };
    });
    return buildHubPhases(inputs);
  }, [progress.byStage]);

  const isComplete = progress.global.total > 0 && progress.global.filled === progress.global.total;

  // CTA: destino do "Completar Copa" → primeira fase não-concluída e não-bloqueada.
  // Fallback para a Fase de Grupos (sempre desbloqueada).
  const completeHref = useMemo(() => {
    const next = phases.find(
      (p) => p.status === "andamento" || p.status === "nao-iniciado",
    );
    return next?.href ?? "/predictions/grupos";
  }, [phases]);

  const refetch = () => {
    void matchesQuery.refetch();
    void predictionsQuery.refetch();
  };

  return (
    <div className="palpites-theme mx-auto flex max-w-2xl flex-col pb-20 md:pb-4">
      <PredictionsHub
        filled={progress.global.filled}
        total={progress.global.total}
        phases={phases}
        completeHref={completeHref}
        isComplete={isComplete}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
      />
    </div>
  );
}
