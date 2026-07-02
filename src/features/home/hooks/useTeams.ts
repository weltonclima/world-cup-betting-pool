"use client";

/**
 * `useTeams` da Home — re-export do hook canônico da feature matches
 * (TASK-02 perf-hardening).
 *
 * ANTES: a Home tinha um `useTeams` próprio com query key `homeKeys.teams()`
 * (`["home","teams"]`), separado do `useTeams` de matches (`["matches","teams"]`).
 * Como `useMatchesList` (consumido pela Home) usa o de matches, `GET /api/teams`
 * era disparado 2× — keys distintas não deduplicam no React Query.
 *
 * AGORA: a Home delega para o hook de matches (key `matchesKeys.teams()`). Todos
 * os `useQuery` de teams passam a ser observers da MESMA query → 1 único fetch.
 * O call site externo (`GroupManualPredictions`, que importa deste barrel) herda
 * o cache compartilhado sem alteração.
 */
export { useTeams } from "@/features/matches/hooks/useTeams";
