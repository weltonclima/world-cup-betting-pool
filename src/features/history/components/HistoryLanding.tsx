"use client";

import { RankingErrorState } from "@/features/rankings";

import { useArchivedChampionships } from "../hooks";
import { ArchivedChampionshipCard } from "./ArchivedChampionshipCard";
import { HistoryEmptyState } from "./HistoryEmptyState";

/**
 * Landing da Seção Histórico (`/rankings/history`, TASK-15): lista os
 * campeonatos `archived` habilitados no pool do usuário, ordenados por data
 * de arquivamento (desc, já ordenado pelo servidor).
 */
export function HistoryLanding() {
  const { data, isLoading, isError, refetch } = useArchivedChampionships();

  return (
    <div className="flex flex-col gap-4">
      {/* h1 da página já vem do layout de /rankings (sr-only "Ranking"); aqui é h2. */}
      <h2 className="sr-only">Histórico de campeonatos</h2>

      {isLoading && (
        <div
          role="status"
          aria-label="Carregando histórico"
          className="flex flex-col gap-2"
        >
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="h-16 animate-pulse rounded-lg bg-muted motion-reduce:animate-none"
            />
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <RankingErrorState
          message="Erro ao carregar o histórico"
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && (data === undefined || data.length === 0) && (
        <HistoryEmptyState />
      )}

      {!isLoading && !isError && data !== undefined && data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {data.map((item) => (
            <li key={item.championshipId}>
              <ArchivedChampionshipCard
                championshipId={item.championshipId}
                name={item.name}
                season={item.season}
                type={item.type}
                archivedAt={item.archivedAt}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
