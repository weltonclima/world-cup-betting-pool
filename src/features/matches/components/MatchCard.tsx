"use client";

/**
 * MatchCard — card de jogo da feature Jogos (TASK-03).
 * Componente presentacional puro: recebe props resolvidas, sem hooks/fetch.
 * 3 variantes determinadas por predictionStatus + match.status:
 *   - enviado   → horário + badge verde + chevron (link navegável)
 *   - pendente  → horário + badge âmbar + chevron (link navegável)
 *   - bloqueado + finished → placar + badge cinza + seção resultado
 *
 * Contrato visual: ai/screen/jogos-task-03.md
 * Fonte de verdade: PRD03-04, PRD03-05, PRD03-06
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { MatchPredictionStatus, ResolvedTeam } from "@/features/matches/lib/matchesHelpers";
import type { MatchWithId } from "@/types";

import { GameStatusBadge } from "./GameStatusBadge";
import { MatchStatusBadge } from "./MatchStatusBadge";

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface MatchCardProps {
  /** Dados da partida (schema validado). */
  match: MatchWithId;
  /** Seleção mandante resolvida (nome + flagUrl). */
  homeTeam: ResolvedTeam;
  /** Seleção visitante resolvida (nome + flagUrl). */
  awayTeam: ResolvedTeam;
  /** Status do palpite do usuário para esta partida. */
  predictionStatus: MatchPredictionStatus;
  /** Palpite do usuário (se enviou um). null/undefined → sem palpite. */
  userPrediction?: { homeScore: number; awayScore: number } | null;
  /** href para a tela de detalhe do jogo. */
  detailHref: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Subcomponente: TeamFlag (bandeira + fallback de iniciais)
// ---------------------------------------------------------------------------

function TeamFlag({ team }: { team: ResolvedTeam }) {
  if (team.flagUrl) {
    return (
      <img
        src={team.flagUrl}
        alt={team.name}
        width={40}
        height={28}
        loading="lazy"
        decoding="async"
        className="w-10 h-7 rounded-sm object-contain"
      />
    );
  }

  // Fallback: iniciais (até 3 letras) quando flagUrl não disponível
  const initials = team.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return (
    <span
      aria-label={team.name}
      className="w-10 h-7 flex items-center justify-center rounded-sm bg-muted text-xs font-bold text-muted-foreground"
    >
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente: TeamColumn (bandeira + nome)
// ---------------------------------------------------------------------------

function TeamColumn({ team }: { team: ResolvedTeam; align?: "left" | "right" }) {
  return (
    // flex-1 min-w-0: as duas colunas de time dividem a largura e PODEM encolher
    // (sem min-w-0 o flex item não encolhe abaixo do conteúdo → estoura no mobile).
    <div className="flex flex-1 min-w-0 flex-col items-center gap-1">
      <TeamFlag team={team} />
      <span className="w-full truncate text-center text-xs font-medium text-foreground">
        {team.name}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente: GroupLabel (rótulo de grupo/rodada)
// ---------------------------------------------------------------------------

function GroupLabel({ match }: { match: MatchWithId }) {
  const parts: string[] = [];

  if (match.groupId) {
    parts.push(match.groupId);
  } else {
    // Fases de mata-mata: usar a fase em pt-BR
    const STAGE_LABEL: Record<string, string> = {
      grupos: "Fase de Grupos",
      "dezesseis-avos": "Dezesseis Avos de Final",
      oitavas: "Oitavas de Final",
      quartas: "Quartas de Final",
      semifinal: "Semifinal",
      terceiro: "Disputa do 3º Lugar",
      final: "Final",
    };
    parts.push(STAGE_LABEL[match.stage] ?? match.stage);
  }

  if (match.round != null) {
    parts.push(`Rodada ${match.round}`);
  }

  return (
    <p className="text-xs text-muted-foreground text-center mb-1">
      {parts.join(" · ")}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente: CenterColumn (horário ou placar)
// ---------------------------------------------------------------------------

function CenterColumn({ match }: { match: MatchWithId }) {
  const kickoffDate = new Date(match.kickoffAt);
  const timeStr = format(kickoffDate, "HH:mm", { locale: ptBR });
  const dateStr = format(kickoffDate, "dd/MM/yyyy", { locale: ptBR });

  const isFinished =
    match.status === "finished" &&
    match.homeScore !== null &&
    match.awayScore !== null;

  return (
    // Largura fixa (shrink-0): o centro não cresce nem força overflow; o estádio
    // quebra linha (break-words) em vez de empurrar a largura do card.
    <div className="flex w-24 shrink-0 flex-col items-center gap-0.5 px-1">
      {isFinished ? (
        // Variante encerrado: exibe placar em destaque
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold text-foreground">{match.homeScore}</span>
          <span className="text-lg font-bold text-muted-foreground">x</span>
          <span className="text-3xl font-bold text-foreground">{match.awayScore}</span>
        </div>
      ) : (
        // Variante agendado/ao vivo: exibe horário
        <span className="text-2xl font-bold text-foreground">{timeStr}</span>
      )}

      <span className="text-xs text-muted-foreground">{dateStr}</span>

      {match.venue && (
        <span className="text-center text-[10px] leading-tight text-muted-foreground break-words">
          {match.venue.name} · {match.venue.city}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente: CardFooter (badge + chevron ou status encerrado)
// ---------------------------------------------------------------------------

function CardFooter({
  predictionStatus,
  matchStatus,
  userPrediction,
  showChevron,
}: {
  predictionStatus: MatchPredictionStatus;
  matchStatus: MatchWithId["status"];
  userPrediction?: { homeScore: number; awayScore: number } | null;
  showChevron: boolean;
}) {
  const isFinished = matchStatus === "finished";

  return (
    <>
      {/* Divider */}
      <div className="border-t border-border mt-3 pt-3">
        {isFinished ? (
          // Jogo encerrado: GameStatusBadge centralizado sem chevron
          <div className="flex justify-center">
            <GameStatusBadge status={matchStatus} />
          </div>
        ) : (
          // Jogo aberto: MatchStatusBadge + chevron
          <div className="flex items-center justify-between">
            <MatchStatusBadge status={predictionStatus} />
            {showChevron && (
              <ChevronRight size={16} className="text-muted-foreground" aria-hidden="true" />
            )}
          </div>
        )}
      </div>

      {/* Seção extra para jogo encerrado */}
      {isFinished && (
        <div className="mt-2 space-y-1">
          {/* Palpite do usuário ou bloqueado */}
          {userPrediction != null ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Resultado Final</span>
              <span className="text-xs font-bold text-foreground">
                {userPrediction.homeScore} x {userPrediction.awayScore}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              <MatchStatusBadge status="bloqueado" />
              <p className="text-xs text-muted-foreground">
                Palpites não disponíveis para jogos encerrados.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Componente principal: MatchCard
// ---------------------------------------------------------------------------

/**
 * Card de jogo — 3 variantes visuais controladas por predictionStatus + match.status.
 *
 * O card inteiro é um link navegável (Next.js Link) para a tela de detalhe,
 * exceto na variante "Jogo Encerrado" onde a navegação vai para estatísticas.
 */
export function MatchCard({
  match,
  homeTeam,
  awayTeam,
  predictionStatus,
  userPrediction,
  detailHref,
  className,
}: MatchCardProps) {
  const isFinished = match.status === "finished";
  // Chevron visível apenas para jogos não-encerrados (abertos para palpite ou pendentes)
  const showChevron = !isFinished;

  const ariaLabel = `${homeTeam.name} vs ${awayTeam.name}`;

  return (
    <Link
      href={detailHref}
      className={cn(
        "block rounded-xl border border-border bg-card shadow-sm p-4",
        "hover:bg-accent transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "min-h-[44px]",
        className,
      )}
      aria-label={ariaLabel}
    >
      <article>
        {/* Grupo / Rodada */}
        <GroupLabel match={match} />

        {/* Bloco central: times + horário/placar */}
        <div className="flex items-start justify-between gap-2 py-2">
          <TeamColumn team={homeTeam} />
          <CenterColumn match={match} />
          <TeamColumn team={awayTeam} />
        </div>

        {/* Rodapé: badge de status + seção extra para encerrado */}
        <CardFooter
          predictionStatus={predictionStatus}
          matchStatus={match.status}
          userPrediction={userPrediction}
          showChevron={showChevron}
        />
      </article>
    </Link>
  );
}
