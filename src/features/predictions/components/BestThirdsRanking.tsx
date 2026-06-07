/**
 * BestThirdsRanking — Ranking dos Melhores Terceiros (TASK-12, PRD03-06).
 *
 * Componente APRESENTACIONAL e puro: recebe o ranking já calculado
 * (buildThirdsRanking → rankBestThirds da TASK-02), um resolvedor de time e o
 * estado de completude dos grupos por props. Sem hooks de dados — a orquestração
 * acontece no page.tsx. VISUAL e NÃO pontuada (A2): nada é persistido.
 *
 * Exibe os 8 melhores 3ºs ranqueados 1–8 (bandeira + nome + Grupo + Pts/SG/GP) e
 * o CTA "Gerar 16 Avos", habilitado APENAS quando os 12 grupos estão completos
 * (A6). Tabela acessível (scope/caption); status por ícone+texto (cor
 * não-exclusiva).
 *
 * Contrato: ai/spec/palpites-massa-task-12.md · ai/screen/palpites-massa-task-12.md
 *
 * Tema: tokens apenas (`text-win`, `bg-win-bg`, `bg-muted`, `text-foreground`).
 * Herda o verde dentro de `.palpites-theme` (container da rota). Neutro fora.
 */

import Link from "next/link";
import { CheckCircle2, Lock, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  rankBestThirds,
  computeGroupStandings,
  type GroupStandingEntry,
  type AllGroupStandings,
} from "@/features/predictions/lib";
import type { MatchWithId, Prediction } from "@/types";
import type { ResolvedTeam } from "@/features/matches/lib/matchesHelpers";

// ── Tipos exportados ────────────────────────────────────────────────────────

/** Linha do ranking de terceiros (1-based, 1 = melhor terceiro). */
export interface ThirdRankingEntry {
  rank: number;
  entry: GroupStandingEntry;
  groupId: string;
}

/** Resultado de buildThirdsRanking: ranking + completude dos grupos. */
export interface ThirdsRankingResult {
  thirds: ThirdRankingEntry[];
  completedGroupsCount: number;
  totalGroupsCount: number;
  allGroupsComplete: boolean;
}

// ── Helper puro (testável sem React) ──────────────────────────────────────────

/**
 * Deriva o ranking dos 8 melhores terceiros e a completude dos grupos a partir
 * das partidas de fase de grupos e dos palpites do usuário.
 *
 * - Agrupa as partidas com `stage === "grupos"` e `groupId` definido.
 * - Para cada grupo, computa `computeGroupStandings` (TASK-02) e mantém um mapa
 *   teamId → groupId (o groupId de origem do terceiro, perdido por rankBestThirds).
 * - Ranqueia os terceiros via `rankBestThirds` (critério FIFA — TASK-02).
 * - Um grupo é "completo" quando todos os seus jogos têm palpite.
 *
 * Função pura — sem React, sem Firebase.
 */
export function buildThirdsRanking(
  matches: MatchWithId[],
  predictions: Prediction[],
): ThirdsRankingResult {
  const filledMatchIds = new Set<string>(predictions.map((p) => p.matchId));

  // Agrupa as partidas de grupo por groupId.
  const matchesByGroup = new Map<string, MatchWithId[]>();
  for (const match of matches) {
    if (match.stage !== "grupos") continue;
    const groupId = match.groupId;
    if (!groupId) continue;
    const existing = matchesByGroup.get(groupId);
    if (existing) existing.push(match);
    else matchesByGroup.set(groupId, [match]);
  }

  const allStandings: AllGroupStandings = {};
  const teamToGroup = new Map<string, string>();
  let completedGroupsCount = 0;

  for (const [groupId, groupMatches] of matchesByGroup) {
    const standings = computeGroupStandings(groupMatches, predictions);
    allStandings[groupId] = standings;

    for (const entry of standings) {
      teamToGroup.set(entry.teamId, groupId);
    }

    const total = groupMatches.length;
    const filled = groupMatches.reduce(
      (acc, m) => acc + (filledMatchIds.has(m.id) ? 1 : 0),
      0,
    );
    if (total > 0 && filled === total) completedGroupsCount += 1;
  }

  const totalGroupsCount = matchesByGroup.size;
  const allGroupsComplete =
    totalGroupsCount > 0 && completedGroupsCount === totalGroupsCount;

  const ranked = rankBestThirds(allStandings);
  const thirds: ThirdRankingEntry[] = ranked.map((entry, index) => ({
    rank: index + 1,
    entry,
    groupId: teamToGroup.get(entry.teamId) ?? "",
  }));

  return { thirds, completedGroupsCount, totalGroupsCount, allGroupsComplete };
}

// ── Helpers de formatação ──────────────────────────────────────────────────────

/** Formata o saldo de gols com sinal explícito ("+4" / "0" / "-2"). */
function formatSigned(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

// ── Bandeira ──────────────────────────────────────────────────────────────────

function TeamFlag({ team }: { team: ResolvedTeam }) {
  if (!team.flagUrl) return null;
  return (
    <img
      src={team.flagUrl}
      alt=""
      aria-hidden="true"
      width={24}
      height={16}
      loading="lazy"
      decoding="async"
      className="h-4 w-6 shrink-0 rounded-sm object-cover"
    />
  );
}

// ── Estados ────────────────────────────────────────────────────────────────────

function RankingSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Carregando ranking dos melhores terceiros</span>
      <div className="flex flex-col gap-2" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="h-10 rounded-md bg-muted animate-pulse motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}

function RankingError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p className="text-sm text-destructive">
        Não foi possível carregar o ranking dos terceiros.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          buttonVariants({ variant: "outline", size: "lg" }),
          "min-h-[44px]",
        )}
      >
        Tentar novamente
      </button>
    </div>
  );
}

// ── Componente ────────────────────────────────────────────────────────────────

export interface BestThirdsRankingProps {
  /** Ranking 1..N dos melhores terceiros (de buildThirdsRanking). */
  thirds: ThirdRankingEntry[];
  /** Resolve nome + flagUrl de um teamId. */
  resolveTeamName: (teamId: string) => ResolvedTeam;
  /** true → libera o CTA "Gerar 16 Avos". */
  allGroupsComplete: boolean;
  /** Grupos completos (para a contagem do CTA bloqueado). */
  completedGroupsCount: number;
  /** Total de grupos detectados. */
  totalGroupsCount: number;
  /** Destino do CTA quando habilitado. */
  bracketHref: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function BestThirdsRanking({
  thirds,
  resolveTeamName,
  allGroupsComplete,
  completedGroupsCount,
  totalGroupsCount,
  bracketHref,
  isLoading,
  isError,
  onRetry,
}: BestThirdsRankingProps) {
  return (
    <section
      aria-labelledby="best-thirds-heading"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h1
          id="best-thirds-heading"
          className="text-2xl font-semibold text-foreground"
        >
          Melhores Terceiros
        </h1>
        <p className="text-sm text-muted-foreground">
          Os 8 melhores terceiros colocados avançam para os 16 avos de final.
        </p>
      </div>

      {isError ? (
        <RankingError onRetry={onRetry} />
      ) : isLoading ? (
        <RankingSkeleton />
      ) : thirds.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Preencha os jogos dos grupos para ver o ranking dos melhores terceiros.
        </p>
      ) : (
        <>
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Ranking dos melhores terceiros colocados
            </caption>
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th scope="col" className="py-2 pr-2 text-left font-medium">
                  Pos
                </th>
                <th scope="col" className="py-2 pr-2 text-left font-medium">
                  Seleção
                </th>
                <th scope="col" className="py-2 px-2 text-left font-medium">
                  Grupo
                </th>
                <th scope="col" className="py-2 px-2 text-right font-medium">
                  Pts
                </th>
                <th scope="col" className="py-2 px-2 text-right font-medium">
                  <abbr title="Saldo de gols">SG</abbr>
                </th>
                <th scope="col" className="py-2 pl-2 text-right font-medium">
                  <abbr title="Gols pró">GP</abbr>
                </th>
              </tr>
            </thead>
            <tbody>
              {thirds.map(({ rank, entry, groupId }) => {
                const team = resolveTeamName(entry.teamId);
                return (
                  <tr key={entry.teamId} className="border-b border-border">
                    <td className="py-2 pr-2">
                      <span
                        aria-label={`${rank}º melhor terceiro`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-win-bg text-xs font-bold text-win"
                      >
                        {rank}
                      </span>
                    </td>
                    <td className="py-2 pr-2">
                      <span className="flex items-center gap-2">
                        <TeamFlag team={team} />
                        <span className="truncate text-foreground">
                          {team.name}
                        </span>
                      </span>
                    </td>
                    <td className="py-2 px-2 text-left text-xs text-muted-foreground">
                      {groupId ? `Grupo ${groupId}` : "—"}
                    </td>
                    <td className="py-2 px-2 text-right font-semibold tabular-nums text-foreground">
                      {entry.points}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-foreground">
                      {formatSigned(entry.goalDifference)}
                    </td>
                    <td className="py-2 pl-2 text-right tabular-nums text-foreground">
                      {entry.goalsFor}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card p-2">
            <CheckCircle2
              size={16}
              aria-hidden="true"
              className="shrink-0 text-win"
            />
            <span className="text-sm text-foreground">
              Os 8 melhores terceiros avançam para os 16 avos.
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {allGroupsComplete ? (
              <Link
                href={bracketHref}
                aria-label="Gerar a chave dos 16 avos de final"
                className={cn(
                  buttonVariants({ variant: "default", size: "lg" }),
                  "min-h-[44px] w-full md:w-auto md:self-start",
                )}
              >
                <Trophy size={20} aria-hidden="true" />
                Gerar 16 Avos
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  aria-label="Gerar 16 Avos — complete os 12 grupos primeiro"
                  className={cn(
                    buttonVariants({ variant: "default", size: "lg" }),
                    "min-h-[44px] w-full md:w-auto md:self-start",
                  )}
                >
                  <Lock size={20} aria-hidden="true" />
                  Gerar 16 Avos
                </button>
                <p className="text-xs text-muted-foreground">
                  Complete os 12 grupos para gerar a chave — {completedGroupsCount}{" "}
                  de {totalGroupsCount} grupos prontos.
                </p>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
