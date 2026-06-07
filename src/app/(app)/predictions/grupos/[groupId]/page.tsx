"use client";

/**
 * Página de Palpite em Massa do Grupo (/predictions/grupos/[groupId]) —
 * TASK-09 (PRD03-03).
 *
 * Preenche os 6 jogos do grupo numa tela: data-fetching via useGroupPredictions,
 * auto-save em rascunho local (usePredictionDraft) a cada alteração (sem travar
 * a digitação) e persistência server em lote (useUpsertPredictionsBatch) ao
 * "Salvar Grupo". Feedback agregado via Sonner. Jogos encerrados entram travados.
 *
 * Container com tema `.palpites-theme` (shell verde — MASTER §2.4-palpites).
 * O componente apresentacional GroupQuickFill cuida do render; esta página
 * orquestra hooks, draft e toast.
 */

import { use, useCallback } from "react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import {
  useGroupPredictions,
  usePredictionDraft,
  useUpsertPredictionsBatch,
} from "@/features/predictions/hooks";
import {
  GroupQuickFill,
  buildSaveFeedback,
} from "@/features/predictions/components";
import type { UpsertPredictionInput } from "@/services/predictions";

interface GroupFillPageProps {
  params: Promise<{ groupId: string }>;
}

const TOAST_BY_TONE = {
  success: toast.success,
  warning: toast.warning,
  error: toast.error,
  info: toast.info,
} as const;

export default function GroupFillPage({ params }: GroupFillPageProps) {
  const { groupId } = use(params);

  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  const group = useGroupPredictions(groupId);
  const draft = usePredictionDraft(uid ?? "");
  const batch = useUpsertPredictionsBatch(uid ?? "");

  // uid ausente é tratado como loading (consistente com Hub/grid).
  const isLoading = uid === null || group.isLoading;

  /**
   * Auto-save local (R3): grava o rascunho apenas quando o par está completo
   * (home e away números). Enquanto um lado é null, não persiste par parcial.
   */
  const handleScoreChange = useCallback(
    (matchId: string, home: number | null, away: number | null) => {
      if (home !== null && away !== null) {
        draft.setDraft(matchId, { homeScore: home, awayScore: away });
      }
    },
    [draft],
  );

  /**
   * Salvar Grupo (R5/R6): monta o payload com itens não bloqueados e com par
   * completo; dispara o batch; toast agregado conforme o resultado.
   */
  const handleSave = useCallback(() => {
    const payload: UpsertPredictionInput[] = group.items
      .filter(
        (item) =>
          !item.isLocked &&
          item.currentScores !== undefined &&
          Number.isFinite(item.currentScores.homeScore) &&
          Number.isFinite(item.currentScores.awayScore),
      )
      .map((item) => ({
        matchId: item.matchId,
        homeScore: item.currentScores!.homeScore,
        awayScore: item.currentScores!.awayScore,
      }));

    if (payload.length === 0) {
      toast.info("Preencha ao menos um jogo para salvar.");
      return;
    }

    batch.mutate(payload, {
      onSuccess: (result) => {
        const feedback = buildSaveFeedback(result);
        TOAST_BY_TONE[feedback.tone](feedback.message);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  }, [group.items, batch]);

  return (
    <div className="palpites-theme mx-auto flex max-w-2xl flex-col pb-20 md:pb-4">
      <GroupQuickFill
        groupId={groupId}
        items={group.items}
        isLoading={isLoading}
        isError={group.isError}
        isSaving={batch.isPending}
        onRetry={group.refetch}
        onScoreChange={handleScoreChange}
        onSave={handleSave}
      />
    </div>
  );
}
