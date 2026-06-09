"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { listPredictionsByUid } from "@/services/predictions";
import { listMatches } from "@/services/matches";
import { listAllTeams } from "@/services/teams";
import { useAuth } from "@/hooks/useAuth";

import {
  derivePredictionEntry,
  type PredictionHistoryEntry,
} from "../lib/predictionHistory";

/** Time resolvido para exibição (nome/código/bandeira). */
export interface TeamDisplay {
  name: string;
  code: string;
  flagUrl?: string;
}

/** Entrada de histórico com os times já resolvidos para a UI. */
export interface PredictionHistoryRow extends PredictionHistoryEntry {
  homeTeam: TeamDisplay | null;
  awayTeam: TeamDisplay | null;
}

/**
 * Histórico de palpites do usuário (PRD06-03). Junta `predictions` (Firestore)
 * com `matches` e `teams` (Route Handlers) client-side e deriva acerto/pontos
 * pela regra binária (lib `predictionHistory`). Ordena por data desc.
 */
export function usePredictionHistory(): UseQueryResult<PredictionHistoryRow[]> {
  const uid = useAuth().profile?.uid;

  return useQuery({
    queryKey: ["prediction-history", uid ?? "anon"],
    enabled: Boolean(uid),
    queryFn: async () => {
      const [predictions, matches, teams] = await Promise.all([
        listPredictionsByUid(uid as string),
        listMatches(),
        listAllTeams(),
      ]);

      const matchById = new Map(matches.map((m) => [m.id, m]));
      const teamById = new Map(teams.map((t) => [t.id, t]));
      const toDisplay = (id: string): TeamDisplay | null => {
        const t = teamById.get(id);
        return t ? { name: t.name, code: t.code, flagUrl: t.flagUrl } : null;
      };

      return predictions
        .map((p) => {
          const match = matchById.get(p.matchId);
          if (!match) return null;
          const entry = derivePredictionEntry(p, match);
          const row: PredictionHistoryRow = {
            ...entry,
            homeTeam: toDisplay(entry.homeTeamId),
            awayTeam: toDisplay(entry.awayTeamId),
          };
          return row;
        })
        .filter((row): row is PredictionHistoryRow => row !== null)
        .sort((a, b) => b.kickoffAt.localeCompare(a.kickoffAt));
    },
  });
}
