"use client";

import Link from "next/link";

import { useAuth } from "@/hooks/useAuth";
import {
  RankingErrorState,
  RankingSkeleton,
  RankingEmptyState,
  RankingView,
} from "@/features/rankings";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import type { ChampionshipType } from "@/types/championships";

import { useChampionshipHistory } from "../hooks";
import { FrozenBanner } from "./FrozenBanner";
import { FrozenMatchList } from "./FrozenMatchList";
import { FrozenStats } from "./FrozenStats";

const TYPE_LABEL: Record<ChampionshipType, string> = {
  league: "Liga",
  cup: "Copa",
};

export interface HistoryDetailProps {
  championshipId: string;
}

/**
 * Detalhe de um campeonato arquivado (`/rankings/history/[championshipId]`,
 * TASK-15): ranking final congelado + jogos + estatísticas do pool, servidos
 * de `GET /api/history/[id]`. Read-only — sem `RecalcGroupRankingButton` nem
 * qualquer outra ação admin.
 */
export function HistoryDetail({ championshipId }: HistoryDetailProps) {
  const auth = useAuth();
  const currentUid = auth.firebaseUser?.uid;
  const { data, isLoading, isError, refetch } = useChampionshipHistory(championshipId);

  if (isLoading) return <RankingSkeleton />;
  if (isError)
    return <RankingErrorState onRetry={() => void refetch()} />;
  if (!data) {
    return (
      <div className="flex flex-col items-center gap-4">
        <RankingEmptyState message="Campeonato não encontrado no histórico" />
        <Link
          href="/rankings/history"
          className="flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Voltar ao Histórico
        </Link>
      </div>
    );
  }

  const { championship, ranking, statistics, matches } = data;

  // Shape estrutural exigido por `RankingView`: dado já resolvido (sem fetch
  // próprio), então `isLoading`/`isError` fixos e `refetch` no-op (nada a
  // reconsultar — o snapshot é congelado).
  const rankingQuery = {
    data: { entries: ranking },
    isLoading: false,
    isError: false,
    refetch: () => undefined,
  };

  return (
    <div className="flex flex-col gap-4">
      <FrozenBanner />

      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-foreground">{championship.name}</h2>
          <Badge variant="secondary">{TYPE_LABEL[championship.type]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Temporada {championship.season}</p>
      </header>

      <Tabs defaultValue="ranking">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTab value="ranking" className="min-h-11">
            Ranking
          </TabsTab>
          <TabsTab value="jogos" className="min-h-11">
            Jogos
          </TabsTab>
          <TabsTab value="estatisticas" className="min-h-11">
            Estatísticas
          </TabsTab>
        </TabsList>

        <TabsPanel value="ranking" keepMounted>
          <RankingView query={rankingQuery} currentUid={currentUid} />
        </TabsPanel>

        <TabsPanel value="jogos" keepMounted>
          <FrozenMatchList championshipId={championshipId} matches={matches} />
        </TabsPanel>

        <TabsPanel value="estatisticas" keepMounted>
          <FrozenStats statistics={statistics} ranking={ranking} />
        </TabsPanel>
      </Tabs>
    </div>
  );
}
