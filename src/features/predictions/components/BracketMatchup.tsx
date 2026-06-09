/**
 * BracketMatchup — cartão de um confronto de mata-mata (TASK-13, PRD03-07..11).
 *
 * Apresentacional e puro: recebe o confronto (saída de buildBracketFromFixtures),
 * os placares atuais e handlers por props. Renderiza dois lados (mandante em cima,
 * visitante embaixo), cada um com bandeira/rótulo + CompactScoreInput. O vencedor é
 * DERIVADO do placar (deriveWinner — A1); empate em eliminatória não avança e exibe
 * hint inline (não bloqueia digitação nem o save).
 *
 * Slots com placeholder (D-OF4: "2A", "W74", "3ABC") exibem rótulo humano via
 * humanizePlaceholder; slots resolvidos resolvem nome/bandeira via resolveTeamName.
 *
 * Contrato: ai/spec/palpites-massa-task-13.md · ai/screen/palpites-massa-task-13.md
 *
 * Tema: tokens apenas (`bg-card`, `text-foreground`, `text-win`, `text-muted-foreground`).
 * Herda o verde dentro de `.palpites-theme` (container da rota TASK-14).
 */

import { Crown, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ResolvedTeam } from "@/features/matches/lib/matchesHelpers";
import {
  deriveWinner,
  humanizePlaceholder,
  isPlaceholderId,
  type BracketMatchup as BracketMatchupData,
  type BracketSlot,
} from "@/features/predictions/lib";

import { CompactScoreInput } from "./CompactScoreInput";

export interface BracketMatchupProps {
  /** Confronto da chave (matchId real + slots home/away). */
  matchup: BracketMatchupData;
  /** Placar do mandante (null = vazio). */
  homeScore: number | null;
  /** Placar do visitante (null = vazio). */
  awayScore: number | null;
  /** Jogo bloqueado por kickoff — inputs desabilitados. */
  locked: boolean;
  /** Resolve teamId real → nome/bandeira. Placeholders não passam por aqui. */
  resolveTeamName: (teamId: string) => ResolvedTeam;
  /** Emitido a cada alteração de placar. */
  onScoreChange: (
    matchId: string,
    home: number | null,
    away: number | null,
  ) => void;
  className?: string;
}

interface SlotLabel {
  name: string;
  flagUrl: string | undefined;
}

/** Resolve o rótulo de um slot: rótulo humano se placeholder, time real caso contrário. */
function resolveSlotLabel(
  slot: BracketSlot,
  resolveTeamName: (teamId: string) => ResolvedTeam,
): SlotLabel {
  if (isPlaceholderId(slot.teamId)) {
    return { name: humanizePlaceholder(slot.teamId), flagUrl: undefined };
  }
  const team = resolveTeamName(slot.teamId);
  return { name: team.name, flagUrl: team.flagUrl };
}

function SlotFlag({ flagUrl }: { flagUrl: string | undefined }) {
  if (!flagUrl) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flagUrl}
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

export function BracketMatchup({
  matchup,
  homeScore,
  awayScore,
  locked,
  resolveTeamName,
  onScoreChange,
  className,
}: BracketMatchupProps) {
  const home = resolveSlotLabel(matchup.home, resolveTeamName);
  const away = resolveSlotLabel(matchup.away, resolveTeamName);

  const bothFilled = homeScore !== null && awayScore !== null;
  const result = bothFilled
    ? deriveWinner(matchup.home.teamId, matchup.away.teamId, homeScore, awayScore)
    : null;
  const isDraw = result?.isDraw ?? false;
  const homeWins = result !== null && result.winnerId === matchup.home.teamId;
  const awayWins = result !== null && result.winnerId === matchup.away.teamId;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm",
        className,
      )}
    >
      {locked ? (
        <span className="inline-flex items-center gap-1 self-end text-xs text-muted-foreground">
          <Lock size={12} aria-hidden="true" />
          Encerrado
        </span>
      ) : null}

      {/* Mandante */}
      <div className="flex min-h-[44px] items-center gap-2">
        <SlotFlag flagUrl={home.flagUrl} />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            homeWins ? "font-semibold text-win" : "text-foreground",
          )}
        >
          {home.name}
          {homeWins ? (
            <>
              <Crown size={14} aria-hidden="true" className="ml-1 inline" />
              <span className="sr-only"> — vence</span>
            </>
          ) : null}
        </span>
        <CompactScoreInput
          label={`Gols ${home.name}`}
          value={homeScore}
          locked={locked}
          onChange={(v) => onScoreChange(matchup.matchId, v, awayScore)}
        />
      </div>

      <span aria-hidden="true" className="text-center text-xs text-muted-foreground">
        x
      </span>

      {/* Visitante */}
      <div className="flex min-h-[44px] items-center gap-2">
        <SlotFlag flagUrl={away.flagUrl} />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            awayWins ? "font-semibold text-win" : "text-foreground",
          )}
        >
          {away.name}
          {awayWins ? (
            <>
              <Crown size={14} aria-hidden="true" className="ml-1 inline" />
              <span className="sr-only"> — vence</span>
            </>
          ) : null}
        </span>
        <CompactScoreInput
          label={`Gols ${away.name}`}
          value={awayScore}
          locked={locked}
          onChange={(v) => onScoreChange(matchup.matchId, homeScore, v)}
        />
      </div>

      {isDraw ? (
        <p role="status" className="text-xs text-muted-foreground">
          Empate não avança — ajuste o placar para definir o vencedor.
        </p>
      ) : null}
    </div>
  );
}
