"use client";

/**
 * MatchDetail — componente principal da tela de detalhe do jogo (TASK-06).
 *
 * Recebe o `id` da partida, chama `useMatchDetail` e renderiza:
 *   - loading  → skeleton de detalhe
 *   - error    → MatchesErrorState (onRetry=refetch)
 *   - 404      → empty state ("Jogo não encontrado") com link de volta
 *   - sucesso  → layout completo: teams + detalhes + status + ações
 *
 * Contrato visual: ai/screen/jogos-task-06.md
 * Fonte de verdade: PRD03-02-Detalhe-Jogo.png
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CalendarX,
  Clock,
  MapPin,
} from "lucide-react";
import Link from "next/link";

import type { MatchPredictionStatus, ResolvedTeam } from "@/features/matches/lib/matchesHelpers";
import { useMatchDetail } from "@/features/matches/hooks/useMatchDetail";
import { usePredictions } from "@/features/predictions/hooks";
import { useAuth } from "@/hooks/useAuth";
import type { Stage } from "@/types";

import { GameStatusBadge } from "./GameStatusBadge";
import { MatchDetailActions } from "./MatchDetailActions";
import { MatchesErrorState } from "./MatchesErrorState";
import { MatchStatusBadge } from "./MatchStatusBadge";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MatchDetailProps {
  /** Id da partida extraído do parâmetro de rota `[id]`. */
  id: string;
}

// ---------------------------------------------------------------------------
// Helpers locais
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<Stage, string> = {
  grupos: "Fase de Grupos",
  oitavas: "Oitavas de Final",
  quartas: "Quartas de Final",
  semifinal: "Semifinal",
  terceiro: "Disputa do 3º Lugar",
  final: "Final",
};

function deriveSubtitle(stage: Stage, groupId: string | null | undefined): string {
  const stageLabel = STAGE_LABELS[stage] ?? stage;
  return groupId ? `${stageLabel} · ${groupId}` : stageLabel;
}

const PREDICTION_MESSAGE: Record<MatchPredictionStatus, string> = {
  enviado: "Seu palpite foi enviado com sucesso.",
  pendente: "Você ainda não enviou um palpite para este jogo.",
  bloqueado: "Os palpites para este jogo estão bloqueados.",
};

// ---------------------------------------------------------------------------
// Subcomponente: TeamFlag
// ---------------------------------------------------------------------------

function TeamFlag({ team, size = "md" }: { team: ResolvedTeam; size?: "md" | "lg" }) {
  const sizeClass = size === "lg"
    ? "w-20 h-14 md:w-24 md:h-16"
    : "w-16 h-12";

  if (team.flagUrl) {
    return (
      <img
        src={team.flagUrl}
        alt={team.name}
        width={80}
        height={56}
        loading="lazy"
        decoding="async"
        className={`${sizeClass} rounded object-contain`}
      />
    );
  }

  const initials = team.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return (
    <span
      aria-label={team.name}
      className={`${sizeClass} flex items-center justify-center rounded bg-muted text-sm font-bold text-muted-foreground`}
    >
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente: BackButton
// ---------------------------------------------------------------------------

function BackButton() {
  return (
    <Link
      href="/matches"
      aria-label="Voltar para lista de jogos"
      className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-0 py-1"
    >
      <ArrowLeft size={18} aria-hidden="true" />
      <span>Voltar</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente: SectionHeading
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-foreground">{children}</h2>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente: Skeleton de detalhe
// ---------------------------------------------------------------------------

function MatchDetailSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando detalhes do jogo"
      className="flex flex-col gap-4"
    >
      {/* Subtítulo */}
      <div
        aria-hidden="true"
        className="h-4 w-40 rounded bg-muted animate-pulse motion-reduce:animate-none"
      />

      {/* Bloco de times */}
      <div className="rounded-xl border border-border bg-card p-6 flex justify-around items-center gap-4">
        <div aria-hidden="true" className="flex flex-col items-center gap-2">
          <div className="w-20 h-14 rounded bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="h-4 w-20 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        </div>
        <div
          aria-hidden="true"
          className="h-8 w-8 rounded bg-muted animate-pulse motion-reduce:animate-none"
        />
        <div aria-hidden="true" className="flex flex-col items-center gap-2">
          <div className="w-20 h-14 rounded bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="h-4 w-20 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        </div>
      </div>

      {/* Bloco de detalhes */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            className="h-4 w-full rounded bg-muted animate-pulse motion-reduce:animate-none"
          />
        ))}
      </div>

      {/* Bloco de status */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
        <div
          aria-hidden="true"
          className="h-6 w-24 rounded bg-muted animate-pulse motion-reduce:animate-none"
        />
        <div
          aria-hidden="true"
          className="h-6 w-32 rounded bg-muted animate-pulse motion-reduce:animate-none"
        />
      </div>

      {/* Bloco de ações */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            className="h-10 w-full rounded-lg bg-muted animate-pulse motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente: Estado 404
// ---------------------------------------------------------------------------

function MatchNotFoundState() {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center py-16 gap-4 text-center px-4"
    >
      <CalendarX
        size={48}
        aria-hidden="true"
        className="text-muted-foreground"
      />
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold text-foreground">Jogo não encontrado</p>
        <p className="text-sm text-muted-foreground">
          Não foi possível encontrar este jogo.
        </p>
      </div>
      <Link
        href="/matches"
        className="inline-flex items-center gap-2 min-h-[44px] px-6 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar para Jogos
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente: Linha de detalhe (ícone + label + valor)
// ---------------------------------------------------------------------------

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * MatchDetail — composição principal da tela de detalhe.
 *
 * Gerencia os 3 estados (loading / error / 404) e renderiza o conteúdo
 * completo quando os dados estão disponíveis.
 */
export function MatchDetail({ id }: MatchDetailProps) {
  const { match, isLoading, isError, refetch } = useMatchDetail(id);

  // uid + palpite do usuário — mesmo query key em cache (sem request extra)
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;
  const { data: predictions } = usePredictions(uid);
  const existingPrediction = predictions?.find((p) => p.matchId === id);

  // Estado: loading
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-4 py-4 pb-20 max-w-2xl mx-auto">
        {/* Escape route visível mesmo durante o carregamento */}
        <BackButton />
        <MatchDetailSkeleton />
      </div>
    );
  }

  // Estado: error
  if (isError) {
    return (
      <div className="px-4 py-4 max-w-2xl mx-auto">
        <BackButton />
        <div className="mt-4">
          <MatchesErrorState
            onRetry={refetch}
            message="Erro ao carregar detalhes do jogo"
          />
        </div>
      </div>
    );
  }

  // Estado: 404
  if (match === null) {
    return (
      <div className="px-4 py-4 max-w-2xl mx-auto">
        <BackButton />
        <div className="mt-4">
          <MatchNotFoundState />
        </div>
      </div>
    );
  }

  // Estado: sucesso — renderiza tela completa
  const kickoffDate = new Date(match.kickoffAt);
  const dateStr = format(kickoffDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const timeStr = format(kickoffDate, "HH:mm", { locale: ptBR });
  const subtitle = deriveSubtitle(match.stage, match.groupId);
  const predictionMessage = PREDICTION_MESSAGE[match.predictionStatus];

  return (
    <div className="flex flex-col gap-4 px-4 py-4 pb-20 max-w-2xl mx-auto md:pb-4">

      {/* Botão de volta */}
      <BackButton />

      {/* Título da página (h1 — topo da hierarquia de heading) */}
      <h1 className="text-xl font-bold text-foreground">Detalhes do Jogo</h1>

      {/* Subtítulo contextual: fase + grupo */}
      <p className="text-sm text-muted-foreground">{subtitle}</p>

      {/* Bloco: times e bandeiras */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-6">
        <div className="flex items-center justify-around gap-4">
          {/* Mandante */}
          <div className="flex flex-col items-center gap-2">
            <TeamFlag team={match.homeTeam} size="lg" />
            <span className="text-sm font-medium text-foreground text-center max-w-24">
              {match.homeTeam.name}
            </span>
          </div>

          {/* Separador */}
          <span
            className="text-2xl font-bold text-muted-foreground"
            aria-label="versus"
          >
            {match.status === "finished" &&
            match.homeScore !== null &&
            match.awayScore !== null
              ? `${match.homeScore} × ${match.awayScore}`
              : "×"}
          </span>

          {/* Visitante */}
          <div className="flex flex-col items-center gap-2">
            <TeamFlag team={match.awayTeam} size="lg" />
            <span className="text-sm font-medium text-foreground text-center max-w-24">
              {match.awayTeam.name}
            </span>
          </div>
        </div>
      </div>

      {/* Bloco: detalhes do jogo (desktop: grid 2 colunas) */}
      <div className="md:grid md:grid-cols-2 md:gap-6">

        {/* Card de info */}
        <div className="rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col gap-3">
          <SectionHeading>Informações</SectionHeading>
          <DetailRow
            icon={<Calendar size={16} aria-hidden="true" />}
            label="Data"
            value={dateStr}
          />
          <DetailRow
            icon={<Clock size={16} aria-hidden="true" />}
            label="Hora"
            value={timeStr}
          />
          {match.venue && (
            <>
              <DetailRow
                icon={<Building2 size={16} aria-hidden="true" />}
                label="Estádio"
                value={match.venue.name}
              />
              <DetailRow
                icon={<MapPin size={16} aria-hidden="true" />}
                label="Cidade"
                value={match.venue.city}
              />
            </>
          )}
        </div>

        {/* Card de status + ações */}
        <div className="rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col gap-4 mt-4 md:mt-0">

          {/* Status do jogo */}
          <div className="flex flex-col gap-2">
            <SectionHeading>Status do Jogo</SectionHeading>
            <GameStatusBadge status={match.status} />
          </div>

          {/* Divisor */}
          <div className="border-t border-border" />

          {/* Status do palpite */}
          <div className="flex flex-col gap-2">
            <SectionHeading>Status do Palpite</SectionHeading>
            <MatchStatusBadge status={match.predictionStatus} />
            <p className="text-xs text-muted-foreground">{predictionMessage}</p>
          </div>

          {/* Meu Palpite (só quando há palpite registrado) */}
          {existingPrediction && (
            <>
              <div className="border-t border-border" />
              <div className="flex flex-col gap-2">
                <SectionHeading>Meu Palpite</SectionHeading>
                <div
                  className="flex items-center justify-center gap-6 py-2"
                  role="img"
                  aria-label={`Seu palpite: ${match.homeTeam.name} ${existingPrediction.homeScore} a ${existingPrediction.awayScore} ${match.awayTeam.name}`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground font-medium truncate max-w-20 text-center">
                      {match.homeTeam.name}
                    </span>
                    <span className="text-4xl font-bold text-foreground tabular-nums">
                      {existingPrediction.homeScore}
                    </span>
                  </div>
                  <span
                    className="text-xl font-bold text-muted-foreground"
                    aria-hidden="true"
                  >
                    ×
                  </span>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground font-medium truncate max-w-20 text-center">
                      {match.awayTeam.name}
                    </span>
                    <span className="text-4xl font-bold text-foreground tabular-nums">
                      {existingPrediction.awayScore}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Divisor */}
          <div className="border-t border-border" />

          {/* Ações */}
          <div className="flex flex-col gap-3">
            <SectionHeading>Ações</SectionHeading>
            <MatchDetailActions
              predictionStatus={match.predictionStatus}
              matchStatus={match.status}
              matchId={id}
            />
          </div>

        </div>
      </div>

    </div>
  );
}
