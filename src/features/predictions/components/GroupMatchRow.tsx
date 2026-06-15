/**
 * GroupMatchRow — uma linha de jogo da tela de palpite em massa do grupo
 * (TASK-09, PRD03-03).
 *
 * Layout: [bandeira + nome mandante] · [CompactScoreInput] "x" [CompactScoreInput]
 * · [nome + bandeira visitante]. Navegação TAB natural (mandante → visitante).
 *
 * Contrato: ai/spec/palpites-massa-task-09.md §7 · ai/screen/palpites-massa-task-09.md §5
 *
 * Tema: tokens apenas (`bg-card`, `border-border`, `text-foreground`,
 * `text-muted-foreground`). Herda o verde dentro de `.palpites-theme`.
 */

import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ResolvedTeam } from "@/features/matches/lib/matchesHelpers";

import { CompactScoreInput } from "./CompactScoreInput";

export interface GroupMatchRowProps {
  homeTeam: ResolvedTeam;
  awayTeam: ResolvedTeam;
  homeScore: number | null;
  awayScore: number | null;
  /** Jogo bloqueado por kickoff — inputs desabilitados + marcador "Encerrado". */
  locked: boolean;
  onHomeChange: (value: number | null) => void;
  onAwayChange: (value: number | null) => void;
  className?: string;
}

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
      className="h-4 w-6 shrink-0 rounded-sm object-cover border border-border"
    />
  );
}

export function GroupMatchRow({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  locked,
  onHomeChange,
  onAwayChange,
  className,
}: GroupMatchRowProps) {
  return (
    <div
      className={cn(
        "flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-card p-3",
        className,
      )}
    >
      {/* Mandante */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        {locked ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Lock size={12} aria-hidden="true" />
            Encerrado
          </span>
        ) : null}
        <span className="truncate text-sm font-medium text-foreground">
          {homeTeam.name}
        </span>
        <TeamFlag team={homeTeam} />
      </div>

      {/* Placar */}
      <div className="flex shrink-0 items-center gap-2">
        <CompactScoreInput
          label={`Gols ${homeTeam.name}`}
          value={homeScore}
          onChange={onHomeChange}
          locked={locked}
        />
        <span aria-hidden="true" className="text-sm text-muted-foreground">
          x
        </span>
        <CompactScoreInput
          label={`Gols ${awayTeam.name}`}
          value={awayScore}
          onChange={onAwayChange}
          locked={locked}
        />
      </div>

      {/* Visitante */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <TeamFlag team={awayTeam} />
        <span className="truncate text-sm font-medium text-foreground">
          {awayTeam.name}
        </span>
      </div>
    </div>
  );
}
