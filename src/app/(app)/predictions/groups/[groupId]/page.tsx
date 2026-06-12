"use client";

/**
 * Página de Palpite em Massa do Grupo (/predictions/groups/[groupId]) —
 * TASK-09 (PRD03-03) + Classificação Prevista TASK-10 (PRD03-04).
 *
 * Preenche os 6 jogos do grupo numa tela: data-fetching via useGroupPredictions,
 * auto-save em rascunho local (usePredictionDraft) a cada alteração (sem travar
 * a digitação) e persistência server em lote (useUpsertPredictionsBatch) ao
 * "Salvar Grupo". Feedback agregado via Sonner. Jogos encerrados entram travados.
 *
 * Após "Salvar Grupo" (com sucesso) ou via toggle, exibe a seção Classificação
 * Prevista (TASK-10) calculada client-side de computeGroupStandings — VISUAL,
 * não pontuada (A2). Mantém o fluxo numa única rota para o wizard (TASK-16).
 *
 * Container com tema `.palpites-theme` (shell verde — MASTER §2.4-palpites).
 */

import { use, useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ListOrdered } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useGroupMatches, useTeams } from "@/features/matches/hooks";
import {
  buildTeamMap,
  resolveTeam,
} from "@/features/matches/lib/matchesHelpers";
import {
  useGroupPredictions,
  useUpsertPredictionsBatch,
} from "@/features/predictions/hooks";
import {
  GroupQuickFill,
  PredictedStandings,
  buildSaveFeedback,
} from "@/features/predictions/components";
import { computeGroupStandings } from "@/features/predictions/lib";
import type { Prediction } from "@/types";
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
  const router = useRouter();

  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  const group = useGroupPredictions(groupId);
  const batch = useUpsertPredictionsBatch(uid ?? "");

  // Fontes brutas para a classificação prevista (TASK-10): matches do grupo +
  // mapa de times. As predictions são montadas dos currentScores dos items.
  const groupMatchesQuery = useGroupMatches(groupId);
  const teamsQuery = useTeams();

  const [showStandings, setShowStandings] = useState(false);

  // uid ausente é tratado como loading (consistente com Hub/grid).
  const isLoading = uid === null || group.isLoading;

  // Edição vai direto para a fonte única (`group.setScore`): atualiza o input ao
  // vivo (parciais inclusos) e persiste no rascunho quando o par fica completo.
  // ANTES havia uma 2ª instância de usePredictionDraft aqui, que NUNCA refletia
  // nos inputs (eles liam de outra instância) — causa raiz do "não dá pra digitar".

  /**
   * Salvar Grupo (R5/R6): monta o payload com itens não bloqueados e com par
   * completo; dispara o batch; toast agregado conforme o resultado. Em sucesso
   * com saved>0, revela a Classificação Prevista (TASK-10).
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
        // Filtro acima garante ambos finitos; cast remove o `| null` do tipo.
        homeScore: item.currentScores!.homeScore as number,
        awayScore: item.currentScores!.awayScore as number,
      }));

    if (payload.length === 0) {
      toast.info("Preencha ao menos um jogo para salvar.");
      return;
    }

    batch.mutate(payload, {
      onSuccess: (result) => {
        const feedback = buildSaveFeedback(result);
        TOAST_BY_TONE[feedback.tone](feedback.message);
        if (result.saved.length > 0) setShowStandings(true);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  }, [group.items, batch]);

  // Classificação prevista (TASK-10): derivada client-side dos currentScores.
  const teamMap = useMemo(
    () => buildTeamMap(teamsQuery.data ?? []),
    [teamsQuery.data],
  );

  const predictionsFromDraft = useMemo<Prediction[]>(
    () =>
      group.items
        // Só pares COMPLETOS entram na classificação prevista (ignora parciais
        // em edição — um lado `null` não é um palpite válido).
        .filter(
          (item) =>
            item.currentScores !== undefined &&
            Number.isFinite(item.currentScores.homeScore) &&
            Number.isFinite(item.currentScores.awayScore),
        )
        .map((item) => ({
          uid: uid ?? "",
          matchId: item.matchId,
          homeScore: item.currentScores!.homeScore as number,
          awayScore: item.currentScores!.awayScore as number,
        })),
    [group.items, uid],
  );

  const standings = useMemo(
    () =>
      computeGroupStandings(
        groupMatchesQuery.data ?? [],
        predictionsFromDraft,
      ),
    [groupMatchesQuery.data, predictionsFromDraft],
  );

  const resolveTeamName = useCallback(
    (teamId: string) => resolveTeam(teamId, teamMap),
    [teamMap],
  );

  const isPartial = group.filledCount < group.totalCount;
  const canShowStandings =
    !isLoading && !group.isError && standings.length > 0;

  return (
    <div className="palpites-theme mx-auto flex max-w-2xl flex-col gap-6 pb-20 md:pb-4">
      <GroupQuickFill
        groupId={groupId}
        items={group.items}
        isLoading={isLoading}
        isError={group.isError}
        isSaving={batch.isPending}
        onRetry={group.refetch}
        onScoreChange={group.setScore}
        onSave={handleSave}
      />

      {canShowStandings && !showStandings ? (
        <button
          type="button"
          onClick={() => setShowStandings(true)}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "min-h-[44px] w-full md:w-auto md:self-start",
          )}
        >
          <ListOrdered size={20} aria-hidden="true" />
          Ver classificação prevista
        </button>
      ) : null}

      {canShowStandings && showStandings ? (
        <PredictedStandings
          groupId={groupId}
          standings={standings}
          resolveTeamName={resolveTeamName}
          isPartial={isPartial}
          onConfirm={() => router.push("/predictions/groups")}
          onEdit={() => setShowStandings(false)}
        />
      ) : null}
    </div>
  );
}
