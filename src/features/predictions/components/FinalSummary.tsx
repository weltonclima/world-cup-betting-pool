"use client";

/**
 * FinalSummary — tela Resumo Final + estado Enviado (TASK-15, PRD03-12 / PRD03-15).
 *
 * Componente APRESENTACIONAL e puro: recebe os finalistas já derivados (campeão /
 * vice / 3º / 4º), a contagem global e callbacks por props. A derivação e o
 * data-fetching ficam no page.tsx (`/predictions/resumo`).
 *
 * - PRD03-12: cards de finalistas + contagem + CTA "Confirmar e Enviar".
 * - PRD03-15: estado "Enviado" (A5 — derivado da existência das predictions;
 *   sem flag nova) quando filled === total.
 *
 * Tema: tokens apenas — herda o verde dentro de `.palpites-theme` (aplicado pelo
 * container da rota). Neutro fora do escopo.
 *
 * Contrato: ai/spec/palpites-massa-task-15.md · ai/screen/palpites-massa-task-15.md
 */

import Link from "next/link";
import {
  AlertCircle,
  Crown,
  Medal,
  Award,
  PartyPopper,
  Send,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { buildTeamMap, resolveTeam } from "@/features/matches/lib/matchesHelpers";
import type { MatchWithId, TeamWithId } from "@/types";

import { ProgressBar } from "./ProgressBar";
import { deriveWinner } from "../lib/standings";
import { humanizePlaceholder, isPlaceholderId } from "../lib/bracket";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Slot de um finalista no resumo (campeão / vice / 3º / 4º). */
export interface FinalistSlot {
  /** Papel: "Campeão" | "Vice-Campeão" | "3º Lugar" | "4º Lugar". */
  role: string;
  /** Nome do time resolvido, placeholder humanizado, ou null (sem definição). */
  teamName: string | null;
  flagUrl: string | undefined;
}

export interface FinalSummaryProps {
  /** Finalistas na ordem [campeão, vice, 3º, 4º]. */
  finalists: Finalists;
  /** Palpites preenchidos no total. */
  filled: number;
  /** Total de partidas (esperado 104). */
  total: number;
  /** filled === total && total > 0 → estado Enviado (PRD03-15). */
  isComplete: boolean;
  /** Há rascunho local enviável (CTA habilitado). */
  hasPending: boolean;
  /** Destino do CTA secundário "Voltar ao Hub". */
  hubHref: string;
  isLoading: boolean;
  isError: boolean;
  isSaving: boolean;
  onConfirm: () => void;
  onRetry: () => void;
}

// ---------------------------------------------------------------------------
// Derivação pura (testável sem React)
// ---------------------------------------------------------------------------

/** Placar atual de um confronto, por matchId. */
export type ScoresByMatchId = Record<string, { home: number; away: number }>;

/** Tupla fixa [campeão, vice, 3º, 4º]. */
export type Finalists = [FinalistSlot, FinalistSlot, FinalistSlot, FinalistSlot];

/** Resolve o rótulo de um teamId derivado (nome real, placeholder humanizado, ou null). */
function resolveSlotLabel(
  teamId: string | null,
  teamMap: Map<string, TeamWithId>,
): { teamName: string | null; flagUrl: string | undefined } {
  if (teamId === null) return { teamName: null, flagUrl: undefined };
  if (isPlaceholderId(teamId)) {
    return { teamName: humanizePlaceholder(teamId), flagUrl: undefined };
  }
  const resolved = resolveTeam(teamId, teamMap);
  return { teamName: resolved.name, flagUrl: resolved.flagUrl };
}

/**
 * Deriva os 4 finalistas (campeão/vice/3º/4º) dos fixtures de `final` e `terceiro`,
 * a partir do placar previsto pelo usuário (draft com prioridade sobre salvo — já
 * resolvido pelo chamador em `scores`). Empate ou ausência de placar → slot null.
 *
 * @param matches - Todas as partidas (a função filtra final/terceiro internamente).
 * @param scores  - Placar atual por matchId.
 * @param teams   - Lista de teams para resolução de nome/bandeira.
 * @returns [campeão, vice, 3º, 4º] como FinalistSlot[].
 */
export function deriveFinalists(
  matches: MatchWithId[],
  scores: ScoresByMatchId,
  teams: TeamWithId[],
): Finalists {
  const teamMap = buildTeamMap(teams);
  const finalMatch = matches.find((m) => m.stage === "final");
  const thirdMatch = matches.find((m) => m.stage === "terceiro");

  let championId: string | null = null;
  let viceId: string | null = null;
  if (finalMatch) {
    const s = scores[finalMatch.id];
    if (s) {
      const w = deriveWinner(
        finalMatch.homeTeamId,
        finalMatch.awayTeamId,
        s.home,
        s.away,
      );
      championId = w.winnerId;
      viceId = w.loserId;
    }
  }

  let thirdId: string | null = null;
  let fourthId: string | null = null;
  if (thirdMatch) {
    const s = scores[thirdMatch.id];
    if (s) {
      const w = deriveWinner(
        thirdMatch.homeTeamId,
        thirdMatch.awayTeamId,
        s.home,
        s.away,
      );
      thirdId = w.winnerId;
      fourthId = w.loserId;
    }
  }

  const toSlot = (role: string, id: string | null): FinalistSlot => {
    const { teamName, flagUrl } = resolveSlotLabel(id, teamMap);
    return { role, teamName, flagUrl };
  };

  return [
    toSlot("Campeão", championId),
    toSlot("Vice-Campeão", viceId),
    toSlot("3º Lugar", thirdId),
    toSlot("4º Lugar", fourthId),
  ];
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function SummarySkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">Carregando resumo</span>
      <div className="h-2 w-full rounded-full bg-muted" aria-hidden="true" />
      <div className="flex flex-col gap-3" aria-hidden="true">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-24 w-full rounded-xl bg-muted animate-pulse motion-reduce:animate-none"
          />
        ))}
        <div className="grid grid-cols-2 gap-3" aria-hidden="true">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-20 w-full rounded-xl bg-muted animate-pulse motion-reduce:animate-none"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p className="inline-flex items-center gap-2 text-sm text-destructive">
        <AlertCircle size={18} aria-hidden="true" />
        Não foi possível carregar o resumo.
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

function FinalistCard({
  slot,
  icon: Icon,
  compact = false,
}: {
  slot: FinalistSlot;
  icon: LucideIcon;
  compact?: boolean;
}) {
  const label = slot.teamName ?? "A definir";
  return (
    <article
      aria-label={`${slot.role}: ${label}`}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-border bg-card shadow-sm",
        compact ? "p-3" : "p-4",
      )}
    >
      <Icon size={compact ? 20 : 24} aria-hidden="true" className="text-primary" />
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {slot.role}
      </span>
      {slot.flagUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- bandeira de CDN externa
        <img
          src={slot.flagUrl}
          alt=""
          aria-hidden="true"
          width={48}
          height={32}
          loading="lazy"
          decoding="async"
          className="h-8 w-12 rounded-sm object-cover"
        />
      ) : null}
      <span
        className={cn(
          compact ? "text-sm" : "text-lg",
          "font-bold",
          slot.teamName ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </article>
  );
}

function SubmittedState({
  total,
  hubHref,
}: {
  total: number;
  hubHref: string;
}) {
  return (
    <section
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-4 py-6 text-center"
    >
      <div className="flex items-center gap-2">
        <PartyPopper size={24} aria-hidden="true" className="text-primary" />
        <Trophy size={48} aria-hidden="true" className="text-primary" />
        <PartyPopper size={24} aria-hidden="true" className="text-primary" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold text-foreground">Palpites enviados!</p>
        <p className="text-sm text-muted-foreground">
          Todos os seus {total} palpites foram enviados com sucesso.
        </p>
      </div>
      <div className="w-full rounded-xl border border-border bg-card p-4 shadow-sm">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Total de Palpites
        </p>
        <ProgressBar value={total} total={total} />
      </div>
      <Link
        href={hubHref}
        className={cn(
          buttonVariants({ variant: "outline", size: "lg" }),
          "min-h-[44px] w-full md:w-auto",
        )}
      >
        Voltar ao Hub
      </Link>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function FinalSummary({
  finalists,
  filled,
  total,
  isComplete,
  hasPending,
  hubHref,
  isLoading,
  isError,
  isSaving,
  onConfirm,
  onRetry,
}: FinalSummaryProps) {
  const [champion, vice, third, fourth] = finalists;

  let ctaLabel = "Confirmar e Enviar";
  if (isSaving) ctaLabel = "Enviando…";
  else if (!hasPending) ctaLabel = "Tudo enviado";

  return (
    <section className="flex flex-col gap-4 px-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Resumo Final</h1>
        <p className="text-sm text-muted-foreground">
          Confira o resumo dos seus palpites da Copa.
        </p>
      </header>

      {isError ? (
        <SummaryError onRetry={onRetry} />
      ) : isLoading ? (
        <SummarySkeleton />
      ) : isComplete ? (
        <SubmittedState total={total} hubHref={hubHref} />
      ) : (
        <>
          {champion ? <FinalistCard slot={champion} icon={Crown} /> : null}
          {vice ? <FinalistCard slot={vice} icon={Medal} /> : null}

          <div className="grid grid-cols-2 gap-3">
            {third ? <FinalistCard slot={third} icon={Award} compact /> : null}
            {fourth ? <FinalistCard slot={fourth} icon={Award} compact /> : null}
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Palpites preenchidos
            </p>
            <ProgressBar value={filled} total={total} />
          </div>

          <Button
            type="button"
            size="lg"
            onClick={onConfirm}
            disabled={isSaving || !hasPending}
            className="min-h-[44px] w-full md:w-auto md:self-start"
          >
            <Send size={20} aria-hidden="true" />
            {ctaLabel}
          </Button>
        </>
      )}
    </section>
  );
}
