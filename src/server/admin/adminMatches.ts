import "server-only";

import { fetchAllTeams } from "@/server/copaData";
import { getEffectiveMatches } from "@/server/copaData/matchSource";
import type { MatchWithId } from "@/types/matches";

/**
 * Leitura read-only da lista de partidas para a tela Jogos da Copa (PRD11-07,
 * TASK-11/07-GET). Lê das partidas EFETIVAS (`getEffectiveMatches` — openfootball
 * ao vivo com overrides manuais aplicados), refletindo edições do super_admin e o
 * último sync. Resolve o display de cada seleção (nome pt-BR + bandeira) via
 * `fetchAllTeams`.
 *
 * Filtros server-side (B4 — 3 filtros do PNG): groupId, stage, status. "Seleção"
 * fica como busca client opcional (não bloqueante).
 */

export interface MatchTeamView {
  id: string;
  name: string;
  flagUrl: string | null;
}

export interface AdminMatchView {
  id: string;
  home: MatchTeamView;
  away: MatchTeamView;
  kickoffAt: string;
  stage: MatchWithId["stage"];
  round: number | null;
  groupId: string | null;
  venue: { name: string; city: string } | null;
  status: MatchWithId["status"];
  homeScore: number | null;
  awayScore: number | null;
  isManualOverride: boolean;
}

export interface AdminMatchesFilters {
  groupId?: string | undefined;
  stage?: MatchWithId["stage"] | undefined;
  status?: MatchWithId["status"] | undefined;
}

function teamView(
  id: string,
  registry: Map<string, { name: string; flagUrl: string | null }>,
): MatchTeamView {
  const entry = registry.get(id);
  return {
    id,
    name: entry?.name ?? id,
    flagUrl: entry?.flagUrl ?? null,
  };
}

export async function listAdminMatches(
  filters: AdminMatchesFilters = {},
): Promise<AdminMatchView[]> {
  const [matches, teams] = await Promise.all([
    getEffectiveMatches(),
    fetchAllTeams(),
  ]);

  const registry = new Map<string, { name: string; flagUrl: string | null }>();
  for (const t of teams) {
    registry.set(t.id, { name: t.name, flagUrl: t.flagUrl ?? null });
  }

  const filtered = matches.filter((m) => {
    if (filters.groupId && (m.groupId ?? null) !== filters.groupId) return false;
    if (filters.stage && m.stage !== filters.stage) return false;
    if (filters.status && m.status !== filters.status) return false;
    return true;
  });

  filtered.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));

  return filtered.map((m) => ({
    id: m.id,
    home: teamView(m.homeTeamId, registry),
    away: teamView(m.awayTeamId, registry),
    kickoffAt: m.kickoffAt,
    stage: m.stage,
    round: m.round ?? null,
    groupId: m.groupId ?? null,
    venue: m.venue ?? null,
    status: m.status,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    isManualOverride: m.isManualOverride ?? false,
  }));
}
