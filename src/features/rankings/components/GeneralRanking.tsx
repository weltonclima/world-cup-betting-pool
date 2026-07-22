"use client";

import { useAuth } from "@/hooks/useAuth";
import { usePoolRanking, usePoolRankingByScope } from "@/features/rankings";
import {
  SeasonEndedNotice,
  useActiveChampionship,
} from "@/features/championships";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";

import { RankingSkeleton } from "./RankingSkeleton";
import { RankingEmptyState } from "./RankingEmptyState";
import { RankingErrorState } from "./RankingErrorState";
import { RecalcGroupRankingButton } from "./RecalcGroupRankingButton";
import { RankingView } from "./RankingView";

/** Tela 01 — Ranking do pool do usuário (PRD-05 TASK-08, fechado por pool PRD-09). */
export function GeneralRanking() {
  const auth = useAuth();
  const groupId = auth.profile?.groupId;
  const currentUid = auth.firebaseUser?.uid;
  const generalQuery = usePoolRanking(groupId);

  // Temporada encerrada (pool 100%-arquivado): o ranking ao vivo da Copa some — o
  // ranking final congelado está no Histórico. `false` só após o load com conjunto
  // vazio (nunca durante o load → sem flash).
  const { hasActiveChampionship } = useActiveChampionship();

  // Flag de exibição do pool (split-phase-ranking). Ausência/`false` = ramo OFF
  // (geral cumulativo, comportamento legado intocado). Só `true` ativa o split.
  const split = generalQuery.data?.splitPhaseRanking === true;

  // Hooks de escopo SEMPRE chamados (regras de hooks); `enabled` gateia o fetch —
  // no ramo OFF as 2 leituras não disparam (gating W2).
  const gruposQuery = usePoolRankingByScope("grupos", { enabled: split });
  const eliminatoriasQuery = usePoolRankingByScope("eliminatorias", {
    enabled: split,
  });

  // Usuário sem pool não pertence a ranking nenhum (e nunca aparece em outro).
  if (!groupId)
    return (
      <RankingEmptyState
        message="Você ainda não está em um grupo"
        subtitle="Entre ou crie um grupo para ver o ranking dos participantes."
      />
    );

  // Temporada encerrada: sem campeonato ativo, o ranking ao vivo dá lugar ao aviso
  // com atalho ao Histórico (ranking final congelado).
  if (!hasActiveChampionship)
    return (
      <SeasonEndedNotice subtitle="O ranking final da temporada está congelado no Histórico." />
    );

  // O ranking geral também carrega a flag — aguardar antes de decidir o ramo.
  if (generalQuery.isLoading) return <RankingSkeleton />;
  if (generalQuery.isError)
    return <RankingErrorState onRetry={() => void generalQuery.refetch()} />;

  // No split, a aba inicial depende da fase atual: se a eliminatória já tem
  // pontos (mata-mata iniciado), abre direto nela; senão, abre em Grupos. Como
  // `defaultValue` só é lido na montagem das Tabs, aguardar o escopo resolver
  // para decidir com o dado certo (skeleton enquanto carrega).
  if (split && eliminatoriasQuery.isLoading) return <RankingSkeleton />;
  const knockoutActive = (eliminatoriasQuery.data?.entries.length ?? 0) > 0;
  const defaultTab = knockoutActive ? "eliminatorias" : "grupos";

  // Recalc reprocessa o pool inteiro (geral + escopos) — refazer todas as leituras
  // exibidas para refletir o resultado.
  const handleRecalcDone = () => {
    void generalQuery.refetch();
    if (split) {
      void gruposQuery.refetch();
      void eliminatoriasQuery.refetch();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Ação admin: reprocessa o ranking do pool (só group_admin/super_admin;
          retorna null p/ os demais — sem item flex, sem gap extra). */}
      <RecalcGroupRankingButton onDone={handleRecalcDone} />

      {split ? (
        <Tabs defaultValue={defaultTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTab value="grupos" className="min-h-11">
              Grupos
            </TabsTab>
            <TabsTab value="eliminatorias" className="min-h-11">
              Eliminatórias
            </TabsTab>
          </TabsList>

          <TabsPanel value="grupos" keepMounted>
            <RankingView query={gruposQuery} currentUid={currentUid} />
          </TabsPanel>

          <TabsPanel value="eliminatorias" keepMounted>
            <RankingView
              query={eliminatoriasQuery}
              currentUid={currentUid}
              emptyMessage="Fase eliminatória ainda não começou"
              emptySubtitle="Os pontos aparecem quando o mata-mata iniciar."
            />
          </TabsPanel>
        </Tabs>
      ) : (
        <RankingView query={generalQuery} currentUid={currentUid} />
      )}
    </div>
  );
}
