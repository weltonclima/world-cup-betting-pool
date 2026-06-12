"use client";

/**
 * Tela Resumo dos 12 Grupos — TASK-11 (PRD03-05).
 *
 * Componente APRESENTACIONAL: recebe o resumo já derivado (buildGroupsSummary)
 * + estados de loading/erro via props. O data-fetching e a derivação ficam na
 * página (`/predictions/groups-summary`).
 *
 * Lista os 12 grupos (A–L) com 1º/2º classificados previstos e o 3º marcado como
 * candidato a melhor terceiro; ✓ por grupo concluído. CTA "Ver Melhores
 * Terceiros" desabilitado enquanto houver grupo incompleto. VISUAL apenas (A2).
 *
 * Tema: herda o verde de `.palpites-theme` (aplicado pelo container da rota).
 * Não referencia cor diretamente — apenas tokens.
 */

import Link from "next/link";
import { AlertCircle, CheckCircle2, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";

import type {
  GroupSummaryItem,
  GroupSummaryTeam,
} from "./groupsSummaryData";

export interface GroupsSummaryProps {
  /** Grupos resumidos, ordenados A→L. */
  groups: GroupSummaryItem[];
  /** Todos os grupos concluídos. */
  allComplete: boolean;
  /** Número de grupos concluídos (para a contagem do CTA). */
  completeCount: number;
  /** Destino do CTA "Ver Melhores Terceiros" (etapa TASK-12). */
  continueHref: string;
  /** Estado de carregamento dos dados. */
  isLoading: boolean;
  /** Estado de erro dos dados. */
  isError: boolean;
  /** Callback de re-tentativa no estado de erro. */
  onRetry: () => void;
}

const TOTAL_GROUPS = 12;

export function GroupsSummary({
  groups,
  allComplete,
  completeCount,
  continueHref,
  isLoading,
  isError,
  onRetry,
}: GroupsSummaryProps) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">
          Resumo dos Grupos
        </h1>
        <p className="text-sm text-muted-foreground">
          Veja os classificados previstos de cada um dos 12 grupos.
        </p>
      </header>

      {isLoading ? (
        <GroupsSummarySkeleton />
      ) : isError ? (
        <GroupsSummaryError onRetry={onRetry} />
      ) : groups.length === 0 ? (
        <GroupsSummaryEmpty />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {groups.map((group) => (
              <li key={group.groupId}>
                <GroupSummaryCard group={group} />
              </li>
            ))}
          </ul>

          <ContinueCta
            allComplete={allComplete}
            completeCount={completeCount}
            continueHref={continueHref}
          />
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Card de grupo
// ---------------------------------------------------------------------------

function GroupSummaryCard({ group }: { group: GroupSummaryItem }) {
  const progressPercent =
    group.total > 0 ? Math.round((group.filled / group.total) * 100) : 0;

  return (
    <section
      aria-label={group.label}
      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          {group.label}
        </h2>
        {group.isComplete ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-win">
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>Concluído</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">em andamento</span>
        )}
      </div>

      {group.isComplete ? (
        <ul className="flex flex-col gap-1.5">
          <QualifierRow team={group.first} />
          <QualifierRow team={group.second} />
          <QualifierRow team={group.third} isThird />
        </ul>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {group.filled} / {group.total} jogos
          </span>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={group.total}
            aria-valuenow={group.filled}
            aria-label={`${group.label}: ${group.filled} de ${group.total} jogos`}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function QualifierRow({
  team,
  isThird = false,
}: {
  team?: GroupSummaryTeam;
  isThird?: boolean;
}) {
  if (!team) return null;
  const positionLabel = `${team.position}º`;
  return (
    <li className="flex items-center gap-2">
      <span className="w-6 shrink-0 text-xs font-medium text-muted-foreground">
        {positionLabel}
      </span>
      {team.flagUrl ? (
        // Bandeira decorativa — o nome textual ao lado é a informação.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.flagUrl}
          alt=""
          className="h-4 w-6 shrink-0 rounded-sm object-cover"
        />
      ) : null}
      <span className="text-sm text-foreground">{team.name}</span>
      {isThird ? (
        <span className="ml-auto rounded-sm bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">
          candidato a 3º
        </span>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// CTA
// ---------------------------------------------------------------------------

function ContinueCta({
  allComplete,
  completeCount,
  continueHref,
}: {
  allComplete: boolean;
  completeCount: number;
  continueHref: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {allComplete ? (
        <Button
          render={<Link href={continueHref} />}
          className="min-h-[44px] w-full"
        >
          Ver Melhores Terceiros
        </Button>
      ) : (
        <>
          <Button disabled aria-disabled="true" className="min-h-[44px] w-full">
            Ver Melhores Terceiros
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Conclua todos os 12 grupos para continuar — {completeCount} /{" "}
            {TOTAL_GROUPS} grupos concluídos
          </p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estados loading / error / empty
// ---------------------------------------------------------------------------

function GroupsSummarySkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando resumo dos grupos"
      className="flex flex-col gap-3"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-24 w-full rounded-xl border border-border bg-card shadow-sm motion-safe:animate-pulse"
        />
      ))}
    </div>
  );
}

function GroupsSummaryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center shadow-sm"
    >
      <AlertCircle size={24} className="text-destructive" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">
        Erro ao carregar o resumo dos grupos
      </p>
      <Button variant="outline" className="min-h-[44px]" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}

function GroupsSummaryEmpty() {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-6 text-center shadow-sm"
    >
      <ListChecks size={24} className="text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">
        Nenhum grupo encontrado
      </p>
      <p className="text-xs text-muted-foreground">
        Os grupos aparecerão aqui quando as partidas da fase de grupos estiverem
        disponíveis.
      </p>
    </div>
  );
}
