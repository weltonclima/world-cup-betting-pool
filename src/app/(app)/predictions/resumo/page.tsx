"use client";

/**
 * Página Resumo Final (/predictions/resumo) — TASK-15 (PRD03-12 / PRD03-15).
 *
 * Última etapa do wizard de palpites em massa. Faz o data-fetching (useMatches +
 * useTeams + usePredictions + draft local), deriva os finalistas (campeão/vice/3º/4º)
 * via deriveFinalists (sobre os fixtures `final`/`terceiro` + placar atual), a
 * contagem global (computeProgress), e renderiza o FinalSummary apresentacional
 * dentro do container de tema `.palpites-theme` (shell verde — MASTER §2.4-palpites).
 *
 * "Confirmar e Enviar" (A5): faz upsert em lote dos palpites pendentes do rascunho
 * local (draft) que não estão bloqueados por kickoff — sem flag de submissão nova;
 * "enviado" é derivado da existência das predictions (filled === total).
 */

import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { useMatches, useTeams } from "@/features/matches/hooks";
import {
  usePredictionDraft,
  usePredictions,
  useUpsertPredictionsBatch,
} from "@/features/predictions/hooks";
import {
  FinalSummary,
  buildSaveFeedback,
  deriveFinalists,
  type ScoresByMatchId,
} from "@/features/predictions/components";
import { computeProgress } from "@/features/predictions/lib";
import { isPredictionLocked } from "@/features/predictions/lib/predictionsHelpers";
import type { MatchWithId } from "@/types";
import type { UpsertPredictionInput } from "@/services/predictions";

const HUB_HREF = "/predictions";

const TOAST_BY_TONE = {
  success: toast.success,
  warning: toast.warning,
  error: toast.error,
  info: toast.info,
} as const;

export default function ResumoFinalPage() {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  const matchesQuery = useMatches();
  const teamsQuery = useTeams();
  const predictionsQuery = usePredictions(uid);
  const draft = usePredictionDraft(uid ?? "");
  const batch = useUpsertPredictionsBatch(uid ?? "");

  const isLoading =
    uid === null ||
    matchesQuery.isLoading ||
    teamsQuery.isLoading ||
    predictionsQuery.isLoading;
  const isError =
    matchesQuery.isError || teamsQuery.isError || predictionsQuery.isError;

  const matches = useMemo<MatchWithId[]>(
    () => matchesQuery.data ?? [],
    [matchesQuery.data],
  );

  // Placar atual por matchId: draft tem prioridade sobre salvo.
  const scores = useMemo<ScoresByMatchId>(() => {
    const savedByMatchId = new Map(
      (predictionsQuery.data ?? []).map((p) => [p.matchId, p]),
    );
    const result: ScoresByMatchId = {};
    for (const match of matches) {
      const draftVal = draft.allDrafts[match.id];
      const saved = savedByMatchId.get(match.id);
      const current = draftVal ?? saved;
      if (current) {
        result[match.id] = { home: current.homeScore, away: current.awayScore };
      }
    }
    return result;
  }, [matches, predictionsQuery.data, draft.allDrafts]);

  const finalists = useMemo(
    () => deriveFinalists(matches, scores, teamsQuery.data ?? []),
    [matches, scores, teamsQuery.data],
  );

  const progress = useMemo(
    () => computeProgress(predictionsQuery.data ?? [], matches),
    [predictionsQuery.data, matches],
  );

  const isComplete =
    progress.global.total > 0 && progress.global.filled === progress.global.total;

  // Pendentes enviáveis = rascunho local cujo jogo existe e não está bloqueado.
  const pendingPayload = useMemo<UpsertPredictionInput[]>(() => {
    const now = new Date();
    const matchById = new Map(matches.map((m) => [m.id, m]));
    const payload: UpsertPredictionInput[] = [];
    for (const [matchId, value] of Object.entries(draft.allDrafts)) {
      const match = matchById.get(matchId);
      if (!match) continue;
      if (isPredictionLocked(match, now)) continue;
      payload.push({
        matchId,
        homeScore: value.homeScore,
        awayScore: value.awayScore,
      });
    }
    return payload;
  }, [draft.allDrafts, matches]);

  const handleConfirm = useCallback(() => {
    if (pendingPayload.length === 0) {
      toast.info("Não há palpites pendentes para enviar.");
      return;
    }
    batch.mutate(pendingPayload, {
      onSuccess: (result) => {
        const feedback = buildSaveFeedback(result);
        TOAST_BY_TONE[feedback.tone](feedback.message);
        // Limpa do rascunho os itens efetivamente gravados.
        draft.clearDraft();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  }, [pendingPayload, batch, draft]);

  const refetch = useCallback(() => {
    void matchesQuery.refetch();
    void teamsQuery.refetch();
    void predictionsQuery.refetch();
  }, [matchesQuery, teamsQuery, predictionsQuery]);

  return (
    <div className="palpites-theme mx-auto flex max-w-2xl flex-col pb-20 md:pb-4">
      <FinalSummary
        finalists={finalists}
        filled={progress.global.filled}
        total={progress.global.total}
        isComplete={isComplete}
        hasPending={pendingPayload.length > 0}
        hubHref={HUB_HREF}
        isLoading={isLoading}
        isError={isError}
        isSaving={batch.isPending}
        onConfirm={handleConfirm}
        onRetry={refetch}
      />
    </div>
  );
}
