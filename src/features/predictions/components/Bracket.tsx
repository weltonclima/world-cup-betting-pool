/**
 * Bracket — chave eliminatória interativa de uma fase (TASK-13, PRD03-07..11).
 *
 * Apresentacional e puro: recebe os confrontos de uma fase (saída de
 * buildBracketFromFixtures), os placares atuais e handlers por props. Renderiza
 * uma lista de BracketMatchup com layout responsivo (pilha vertical no mobile →
 * colunas no desktop). Sem hooks de dados — a orquestração (draft, batch,
 * resolução de slots) acontece na tela (KnockoutPhaseScreen, TASK-14).
 *
 * Contrato: ai/spec/palpites-massa-task-13.md · ai/screen/palpites-massa-task-13.md
 *
 * Tema: tokens apenas — herda o verde dentro de `.palpites-theme` (container da rota).
 */

import { cn } from "@/lib/utils";
import type { ResolvedTeam } from "@/features/matches/lib/matchesHelpers";
import type { BracketMatchup as BracketMatchupData } from "@/features/predictions/lib";

import { BracketMatchup } from "./BracketMatchup";

/** Placar atual por confronto (matchId → {home, away}); valores podem ser null. */
export type BracketScores = Record<
  string,
  { home: number | null; away: number | null } | undefined
>;

export interface BracketProps {
  /** Confrontos da fase, na ordem de exibição (já ordenados por buildBracketFromFixtures). */
  matchups: BracketMatchupData[];
  /** Placares atuais por matchId. */
  scores: BracketScores;
  /** matchIds bloqueados por kickoff (inputs desabilitados). */
  lockedMatchIds: ReadonlySet<string>;
  /** Resolve teamId real → nome/bandeira. */
  resolveTeamName: (teamId: string) => ResolvedTeam;
  /** Emitido a cada alteração de placar de um confronto. */
  onScoreChange: (
    matchId: string,
    home: number | null,
    away: number | null,
  ) => void;
  /** Título opcional da chave (ex.: "16 avos de final"). */
  title?: string;
  className?: string;
}

export function Bracket({
  matchups,
  scores,
  lockedMatchIds,
  resolveTeamName,
  onScoreChange,
  title,
  className,
}: BracketProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {title ? (
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      ) : null}

      <ul
        role="list"
        className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4"
      >
        {matchups.map((matchup) => {
          const score = scores[matchup.matchId];
          return (
            <li key={matchup.matchId} role="listitem">
              <BracketMatchup
                matchup={matchup}
                homeScore={score?.home ?? null}
                awayScore={score?.away ?? null}
                locked={lockedMatchIds.has(matchup.matchId)}
                resolveTeamName={resolveTeamName}
                onScoreChange={onScoreChange}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
