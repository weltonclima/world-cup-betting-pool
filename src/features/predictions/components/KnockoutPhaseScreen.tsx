/**
 * KnockoutPhaseScreen — tela de uma fase eliminatória (TASK-14, PRD03-07..11).
 *
 * Apresentacional e puro: recebe as seções de chave (1+ Bracket), placares,
 * estados, navegação e handlers por props. Sem hooks de dados — a orquestração
 * (matches, draft, batch, bloqueio A6) acontece no page.tsx. Testável em isolamento.
 *
 * A fase "final" passa DUAS seções (Final + Disputa de 3º lugar) — PRD03-11.
 * Estados: loading, error (retry), empty, bloqueado (A6), populated (saving).
 *
 * Contrato: ai/spec/palpites-massa-task-14.md · ai/screen/palpites-massa-task-14.md
 *
 * Tema: tokens apenas — herda o verde dentro de `.palpites-theme` (container da rota).
 */

import Link from "next/link";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { ResolvedTeam } from "@/features/matches/lib/matchesHelpers";
import type { BracketMatchup as BracketMatchupData } from "@/features/predictions/lib";

import { Bracket, type BracketScores } from "./Bracket";

/** Uma seção de chave dentro da tela (a final tem 2: final + 3º lugar). */
export interface KnockoutSection {
  /** Título da seção (ex.: "Disputa de 3º lugar"); omitido para a chave principal. */
  title?: string;
  matchups: BracketMatchupData[];
}

/** Link de navegação entre fases. */
export interface PhaseNavLink {
  href: string;
  label: string;
}

export interface KnockoutPhaseScreenProps {
  /** Rótulo da fase (ex.: "16 avos de final"). */
  phaseTitle: string;
  /** Seções de chave a renderizar (1 normalmente; 2 na final). */
  sections: KnockoutSection[];
  scores: BracketScores;
  lockedMatchIds: ReadonlySet<string>;
  resolveTeamName: (teamId: string) => ResolvedTeam;
  onScoreChange: (
    matchId: string,
    home: number | null,
    away: number | null,
  ) => void;
  onSave: () => void;
  onRetry: () => void;
  isLoading: boolean;
  isError: boolean;
  isSaving: boolean;
  /** true quando a fase está bloqueada por A6 (fase anterior incompleta). */
  isBlocked: boolean;
  /** true quando há ao menos um confronto não bloqueado com par completo. */
  hasSavable: boolean;
  /** Navegação para a fase anterior (undefined na primeira). */
  prev?: PhaseNavLink;
  /** Navegação para a próxima fase (undefined na última). */
  next?: PhaseNavLink;
}

function PhaseSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">Carregando jogos da fase</span>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="h-28 w-full rounded-xl bg-muted animate-pulse motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}

function PhaseError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p className="text-sm text-destructive">
        Não foi possível carregar os jogos desta fase.
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

function PhaseBlocked({ prev }: { prev?: PhaseNavLink }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <Lock size={24} aria-hidden="true" className="text-muted-foreground" />
      <p className="text-lg font-semibold text-foreground">Fase bloqueada</p>
      <p className="text-sm text-muted-foreground">
        {prev
          ? `Os jogos de ${prev.label} precisam terminar para liberar esta fase.`
          : "Os jogos da fase anterior precisam terminar para liberar esta fase."}
      </p>
      {prev ? (
        <Link
          href={prev.href}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "min-h-[44px]",
          )}
        >
          <ArrowLeft size={20} aria-hidden="true" />
          Ir para {prev.label}
        </Link>
      ) : null}
    </div>
  );
}

function PhaseNav({ prev, next }: { prev?: PhaseNavLink; next?: PhaseNavLink }) {
  if (!prev && !next) return null;
  return (
    <nav
      aria-label="Navegação entre fases"
      className="flex items-center justify-between gap-2"
    >
      {prev ? (
        <Link
          href={prev.href}
          className={cn(
            buttonVariants({ variant: "ghost", size: "lg" }),
            "min-h-[44px]",
          )}
        >
          <ArrowLeft size={20} aria-hidden="true" />
          {prev.label}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={next.href}
          className={cn(
            buttonVariants({ variant: "ghost", size: "lg" }),
            "min-h-[44px]",
          )}
        >
          {next.label}
          <ArrowRight size={20} aria-hidden="true" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function KnockoutPhaseScreen({
  phaseTitle,
  sections,
  scores,
  lockedMatchIds,
  resolveTeamName,
  onScoreChange,
  onSave,
  onRetry,
  isLoading,
  isError,
  isSaving,
  isBlocked,
  hasSavable,
  prev,
  next,
}: KnockoutPhaseScreenProps) {
  const isEmpty =
    sections.length === 0 ||
    sections.every((section) => section.matchups.length === 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">{phaseTitle}</h1>
        {!isBlocked ? (
          <p className="text-sm text-muted-foreground">
            Defina o placar de cada confronto. O vencedor é calculado pelo placar.
          </p>
        ) : null}
      </div>

      {isError ? (
        <PhaseError onRetry={onRetry} />
      ) : isBlocked ? (
        <PhaseBlocked prev={prev} />
      ) : isLoading ? (
        <PhaseSkeleton />
      ) : isEmpty ? (
        <div className="flex flex-col items-start gap-3 py-6">
          <p className="text-sm text-muted-foreground">
            Os jogos desta fase ainda não estão disponíveis.
          </p>
          <Link
            href="/predictions"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "min-h-[44px]",
            )}
          >
            Voltar ao início
          </Link>
        </div>
      ) : (
        <>
          {sections.map((section, index) => (
            <Bracket
              key={section.title ?? `section-${index}`}
              title={section.title}
              matchups={section.matchups}
              scores={scores}
              lockedMatchIds={lockedMatchIds}
              resolveTeamName={resolveTeamName}
              onScoreChange={onScoreChange}
            />
          ))}

          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || !hasSavable}
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "min-h-[44px] w-full md:w-auto md:self-end",
            )}
          >
            {isSaving ? "Salvando…" : "Salvar Fase"}
          </button>
        </>
      )}

      <PhaseNav prev={prev} next={next} />
    </div>
  );
}
