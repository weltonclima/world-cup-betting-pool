"use client";

/**
 * MatchList — compositor da página Lista de Jogos `/matches` (TASK-04).
 *
 * Responsabilidades:
 *  1. Chama `useMatchesList()` para obter view-model pronto.
 *  2. Mantém estado local de busca, filtros rápidos e controle do sheet.
 *  3. Aplica pipeline de filtro (busca + stage + predictionStatus) sobre flatList.
 *  4. Re-agrupa o resultado filtrado preservando os labels de data originais.
 *  5. Renderiza header + estados (loading/error/empty) + seções por dia com MatchCard.
 *
 * Decisão arquitetural:
 *  - Busca opera sobre homeTeam.name/awayTeam.name (já resolvidos no view-model).
 *    Não reutiliza `searchMatchesByCountry` da lib (que recebe MatchWithId[]; aqui temos MatchListItem[]).
 *  - Re-agrupamento usa a estrutura de grupos original do hook para preservar labels pt-BR.
 *  - Sheet de filtros avançados: placeholder comentado — implementado na TASK-05.
 *
 * Contrato visual: ai/screen/jogos-task-04.md
 */

import { useState } from "react";

import type { MatchWithId } from "@/types";
import type { MatchPredictionStatus } from "@/features/matches/lib/matchesHelpers";
import type { Stage } from "@/types";

import { useMatchesList } from "@/features/matches/hooks/useMatchesList";
import type {
  MatchListItem,
  MatchListItemDaySection,
} from "@/features/matches/hooks/useMatchesList";

import { MatchCard } from "@/features/matches/components/MatchCard";
import { MatchListSkeleton } from "@/features/matches/components/MatchListSkeleton";
import { MatchesEmptyState } from "@/features/matches/components/MatchesEmptyState";
import { MatchesErrorState } from "@/features/matches/components/MatchesErrorState";
import { MatchListHeader } from "@/features/matches/components/MatchListHeader";

// ---------------------------------------------------------------------------
// Funções puras co-localizadas (operação sobre MatchListItem[])
// ---------------------------------------------------------------------------

/**
 * Busca por nome de seleção (mandante ou visitante) no view-model.
 * Os nomes já estão resolvidos nos campos homeTeam.name / awayTeam.name.
 */
function searchItemsByName(items: MatchListItem[], query: string): MatchListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.homeTeam.name.toLowerCase().includes(q) ||
      item.awayTeam.name.toLowerCase().includes(q),
  );
}

/**
 * Re-agrupa uma lista filtrada de MatchListItem nas seções de dia originais.
 * Preserva labels ("Hoje", "Amanhã", data por extenso) calculados pelo hook.
 * Seções sem matches após o filtro são omitidas.
 */
function regroupFilteredItems(
  filteredIds: Set<string>,
  originalGroups: MatchListItemDaySection[],
): MatchListItemDaySection[] {
  return originalGroups
    .map((group) => ({
      ...group,
      matches: group.matches.filter((m) => filteredIds.has(m.id)),
    }))
    .filter((group) => group.matches.length > 0);
}

/**
 * Adapta MatchListItem para o shape MatchWithId esperado pelo MatchCard.
 *
 * MatchCard usa internamente: id, kickoffAt, stage, round, groupId, venue,
 * status, homeScore, awayScore (para GroupLabel e CenterColumn).
 * homeTeamId/awayTeamId não são consumidos na renderização do card —
 * o card recebe as seleções já resolvidas via homeTeam/awayTeam props.
 * Passamos strings vazias apenas para satisfazer o tipo estrito (nonEmptyString
 * valida no parse, não em runtime após construção).
 */
function toMatchWithId(item: MatchListItem): MatchWithId {
  return {
    id: item.id,
    kickoffAt: item.kickoffAt,
    stage: item.stage,
    round: item.round,
    groupId: item.groupId,
    venue: item.venue,
    status: item.status,
    homeScore: item.homeScore,
    awayScore: item.awayScore,
    // Não usados pelo card na renderização — seleções chegam via homeTeam/awayTeam:
    homeTeamId: item.id, // placeholder — card não consome este campo
    awayTeamId: item.id, // placeholder — card não consome este campo
  };
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function MatchList() {
  // Estado local de busca e filtros rápidos
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<Stage | undefined>(undefined);
  const [selectedPredictionStatus, setSelectedPredictionStatus] = useState<
    MatchPredictionStatus | undefined
  >(undefined);

  // Controle do sheet de filtros avançados (TASK-05)
  const [filtersOpen, setFiltersOpen] = useState(false);

  // View-model do compositor (TASK-02)
  const { groups, flatList, isLoading, isError, refetch } = useMatchesList();

  // ---------------------------------------------------------------------------
  // Pipeline de filtro client-side
  // ---------------------------------------------------------------------------

  // 1. Busca por nome de seleção
  const afterSearch = searchItemsByName(flatList, searchQuery);

  // 2. Filtro de fase (Stage)
  const afterStage =
    selectedStage === undefined
      ? afterSearch
      : afterSearch.filter((item) => item.stage === selectedStage);

  // 3. Filtro de status de palpite
  const filteredList =
    selectedPredictionStatus === undefined
      ? afterStage
      : afterStage.filter((item) => item.predictionStatus === selectedPredictionStatus);

  // 4. Re-agrupa preservando labels pt-BR dos grupos originais
  const filteredIds = new Set(filteredList.map((item) => item.id));
  const filteredGroups = regroupFilteredItems(filteredIds, groups);

  // Flag auxiliar para empty-state com ou sem filtros ativos
  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedStage !== undefined ||
    selectedPredictionStatus !== undefined;

  // filtersCount: número de filtros avançados (sheet TASK-05 — por ora sempre 0)
  const filtersCount = 0;

  // ---------------------------------------------------------------------------
  // Renderização
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4 pb-20 md:pb-4">
      {/* Header: título + busca + chips de filtro */}
      <MatchListHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedStage={selectedStage}
        onStageChange={setSelectedStage}
        selectedPredictionStatus={selectedPredictionStatus}
        onPredictionStatusChange={setSelectedPredictionStatus}
        onFiltersOpen={() => setFiltersOpen(true)}
        filtersCount={filtersCount}
      />

      {/* Estado: carregando */}
      {isLoading && <MatchListSkeleton count={5} />}

      {/* Estado: erro */}
      {isError && !isLoading && <MatchesErrorState onRetry={refetch} />}

      {/* Estado: lista vazia */}
      {!isLoading && !isError && filteredGroups.length === 0 && (
        <MatchesEmptyState
          message="Nenhum jogo encontrado"
          subtitle={hasActiveFilters ? "Tente limpar os filtros" : undefined}
        />
      )}

      {/* Lista agrupada por dia */}
      {!isLoading && !isError && filteredGroups.length > 0 && (
        <div className="flex flex-col gap-6" aria-label="Jogos agrupados por dia">
          {filteredGroups.map((group) => (
            <DaySection key={group.date} group={group} />
          ))}
        </div>
      )}

      {/* TODO TASK-05: MatchFiltersSheet */}
      {/* filtersOpen={filtersOpen} onClose={() => setFiltersOpen(false)} */}
      {/* O sheet será montado aqui pela TASK-05. filtersOpen já está wired. */}
      {filtersOpen && null /* placeholder: previne warning de variável não usada */}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente: DaySection
// ---------------------------------------------------------------------------

interface DaySectionProps {
  group: MatchListItemDaySection;
}

function DaySection({ group }: DaySectionProps) {
  return (
    <section aria-labelledby={`section-${group.date}`}>
      <h2
        id={`section-${group.date}`}
        className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3"
      >
        {group.label}
      </h2>
      <div className="flex flex-col gap-4">
        {group.matches.map((item) => (
          <MatchCard
            key={item.id}
            match={toMatchWithId(item)}
            homeTeam={item.homeTeam}
            awayTeam={item.awayTeam}
            predictionStatus={item.predictionStatus}
            detailHref={`/matches/${item.id}`}
          />
        ))}
      </div>
    </section>
  );
}
