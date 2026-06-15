"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import { getOtherUserPredictions, listPredictionsByUid } from "@/services";
import { useMatches, useTeams } from "@/features/matches/hooks";
import { buildTeamMap, resolveTeam } from "@/features/matches/lib";
import { derivePredictionDisplayStatus } from "@/features/predictions/lib";
import type { MatchWithId, Prediction, TeamWithId } from "@/types";

import type { ProfilePredictionItem, ResolvedTeam } from "../lib";
import { rankingKeys } from "./rankingKeys";

/**
 * View-model de saída do compositor de palpites do perfil (PRD-14 / TASK-03).
 */
export interface ProfilePredictionsResult {
  items: ProfilePredictionItem[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Resolve a seleção no formato esperado por `ProfilePredictionItem` (rankings).
 *
 * O `resolveTeam` de matches retorna `{ name, flagUrl: string | undefined }` (sem id);
 * o tipo `ResolvedTeam` de rankings exige `{ id, name, flagUrl: string | null }`. Esta
 * função reconcilia: adiciona o id (o próprio teamId, fonte do join) e coage
 * `undefined → null` para o contrato de rankings.
 */
function toProfileTeam(teamId: string, teamMap: Map<string, TeamWithId>): ResolvedTeam {
  const team = resolveTeam(teamId, teamMap);
  return { id: teamId, name: team.name, flagUrl: team.flagUrl ?? null };
}

/**
 * Compositor de palpites para a tela de perfil de participante (PRD-14 / TASK-03).
 *
 * Bifurca a FONTE de palpites pelo contexto (`isSelf`) — esta é a barreira anti-cola
 * do lado do cliente:
 * - `isSelf === true`  → `listPredictionsByUid` (Client SDK, TODOS os jogos).
 * - `isSelf === false` → `getOtherUserPredictions` (Route Handler Admin SDK, SÓ
 *   jogos `status === "finished"`; o filtro é server-side — o hook confia no contrato).
 *
 * Orquestra a fonte condicional + `useMatches()` + `useTeams()` e produz
 * `ProfilePredictionItem[]` enriquecido (stage, groupId, actualScore, matchStatus,
 * displayStatus). A lógica de agrupamento/ordenação NÃO vive aqui — é de
 * `groupProfilePredictions` (TASK-01).
 *
 * Decisões:
 * - Query key separada por contexto (`"self"` vs `"other"`) — caches não colidem.
 * - Query de palpites desabilitada se `uid` ausente; matches/teams sempre ativos.
 * - Prediction com `matchId` órfão (sem match correspondente) é descartada.
 * - NÃO reusa `usePredictionsList` (acoplamento cross-feature) — só funções puras.
 *
 * @param uid    - UID do participante alvo (undefined → query desabilitada).
 * @param isSelf - true se o perfil é do próprio usuário autenticado.
 */
export function useProfilePredictions(
  uid: string | undefined,
  isSelf: boolean,
): ProfilePredictionsResult {
  const context: "self" | "other" = isSelf ? "self" : "other";

  // 1. Fonte de palpites condicional ao contexto
  const predictionsQuery = useQuery<Prediction[]>({
    queryKey: rankingKeys.profilePredictions(uid ?? "__none__", context),
    queryFn: () =>
      isSelf ? listPredictionsByUid(uid!) : getOtherUserPredictions(uid!),
    enabled: Boolean(uid),
  });

  // 2. Dados globais (sempre ativos, independentes de uid)
  const matchesQuery = useMatches();
  const teamsQuery = useTeams();

  // 3. Estado agregado
  const queries = [predictionsQuery, matchesQuery, teamsQuery];
  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);

  // 4. refetch estável (padrão useMatchesList)
  const refetch = useCallback(() => {
    void predictionsQuery.refetch();
    void matchesQuery.refetch();
    void teamsQuery.refetch();
  }, [predictionsQuery.refetch, matchesQuery.refetch, teamsQuery.refetch]);

  // 5. Join: predictions × matches × teams
  const predictions = predictionsQuery.data ?? [];
  const matches = matchesQuery.data ?? [];
  const teams = teamsQuery.data ?? [];

  const matchMap = new Map<string, MatchWithId>(matches.map((m) => [m.id, m]));
  const teamMap = buildTeamMap(teams);
  const now = new Date();

  const items: ProfilePredictionItem[] = predictions.flatMap((prediction) => {
    const match = matchMap.get(prediction.matchId);
    // Match órfão (removido via overlay) → descarta o palpite, não há contexto.
    if (!match) return [];

    const isFinished = match.status === "finished";
    const actualScore =
      isFinished && match.homeScore !== null && match.awayScore !== null
        ? { homeScore: match.homeScore, awayScore: match.awayScore }
        : null;

    return [
      {
        matchId: prediction.matchId,
        kickoffAt: match.kickoffAt,
        stage: match.stage,
        groupId: match.groupId ?? null,
        homeTeam: toProfileTeam(match.homeTeamId, teamMap),
        awayTeam: toProfileTeam(match.awayTeamId, teamMap),
        prediction: {
          homeScore: prediction.homeScore,
          awayScore: prediction.awayScore,
        },
        actualScore,
        matchStatus: match.status,
        displayStatus: derivePredictionDisplayStatus(prediction, match, now),
      },
    ];
  });

  return { items, isLoading, isError, refetch };
}
