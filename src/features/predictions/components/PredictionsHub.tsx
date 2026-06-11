/**
 * PredictionsHub — tela inicial do fluxo de palpites em massa (TASK-07, PRD03-01).
 *
 * Componente APRESENTACIONAL e puro: recebe progresso global + fases já
 * derivadas (status/bloqueio A6) por props. Sem hooks de dados, sem useAuth —
 * toda a derivação acontece no page.tsx. Testável em isolamento.
 *
 * Estados: vazio (PRD03-13), em andamento (PRD03-14), enviado/completo
 * (PRD03-15), fase bloqueada por card (PRD03-16/A6), loading e error.
 *
 * Contrato: ai/spec/palpites-massa-task-07.md · ai/screen/palpites-massa-task-07.md
 *
 * Tema: tokens apenas — herda o verde dentro de `.palpites-theme` (aplicado pelo
 * container da rota). Neutro fora do escopo.
 */

import Link from "next/link";
import { Trophy, Zap, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { Stage } from "@/types";

import { ProgressBar } from "./ProgressBar";
import { PhaseCard } from "./PhaseCard";
import type { PhaseStatus } from "./PhaseCard";

/** Métricas de uma fase, antes da resolução de status/bloqueio. */
export interface HubPhaseInput {
  stage: Stage;
  title: string;
  href: string;
  /** Total de partidas da fase. */
  gamesCount: number;
  /** Palpites já preenchidos na fase. */
  filledCount: number;
}

/** Fase já com status e bloqueio (A6) resolvidos, pronta para render. */
export interface PhaseHubItem extends HubPhaseInput {
  pendingCount: number;
  status: PhaseStatus;
}

export interface PredictionsHubProps {
  /** Palpites preenchidos no total. */
  filled: number;
  /** Total de partidas (esperado 104). */
  total: number;
  /** Fases na ordem de exibição, com status/bloqueio resolvidos. */
  phases: PhaseHubItem[];
  /** Destino do CTA "Completar Copa" / "Ir para Fase de Grupos". */
  completeHref: string;
  /** true quando todas as fases com jogos estão concluídas. */
  isComplete: boolean;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

/**
 * Resolve status de cada fase e aplica o bloqueio de fase futura (A6):
 * uma fase posterior fica `bloqueado` enquanto a fase imediatamente anterior
 * não estiver `concluido`. A primeira fase nunca bloqueia. Fases com 0 jogos
 * contam como NÃO concluídas (não destravam a seguinte).
 *
 * Função pura — testável sem React.
 */
export function buildHubPhases(inputs: HubPhaseInput[]): PhaseHubItem[] {
  const result: PhaseHubItem[] = [];
  let previousConcluded = true; // a primeira fase está sempre "desbloqueada"

  for (const input of inputs) {
    const pendingCount = Math.max(input.gamesCount - input.filledCount, 0);
    const derivedConcluded =
      input.gamesCount > 0 && pendingCount === 0;

    let status: PhaseStatus;
    if (!previousConcluded) {
      status = "bloqueado";
    } else if (derivedConcluded) {
      status = "concluido";
    } else if (input.filledCount > 0) {
      status = "andamento";
    } else {
      status = "nao-iniciado";
    }

    result.push({ ...input, pendingCount, status });
    previousConcluded = derivedConcluded;
  }

  return result;
}

function HubSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">Carregando palpites</span>
      <div className="h-2 w-full rounded-full bg-muted" aria-hidden="true" />
      <div className="flex flex-col gap-3" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 w-full rounded-xl bg-muted animate-pulse motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}

function HubError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p className="text-sm text-destructive">
        Não foi possível carregar seus palpites.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-[44px]")}
      >
        Tentar novamente
      </button>
    </div>
  );
}

export function PredictionsHub({
  filled,
  total,
  phases,
  completeHref,
  isComplete,
  isLoading,
  isError,
  onRetry,
}: PredictionsHubProps) {
  const isEmpty = filled === 0;

  let ctaLabel: string;
  if (isComplete) {
    ctaLabel = "Ver Resumo Final";
  } else if (isEmpty) {
    ctaLabel = "Ir para Fase de Grupos";
  } else {
    ctaLabel = "Completar Copa";
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Título oculto: removido do visual, mantido p/ leitores de tela (a11y). */}
      <h1 className="sr-only">Meus Palpites</h1>

      {isError ? (
        <HubError onRetry={onRetry} />
      ) : isLoading ? (
        <HubSkeleton />
      ) : (
        <>
          {/* Card de progresso global / banner de conclusão */}
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            {isComplete ? (
              <div className="flex flex-col items-center gap-1 text-center">
                <Trophy size={24} aria-hidden="true" className="text-primary" />
                <p className="text-lg font-semibold text-foreground">
                  Copa completa!
                </p>
                <p className="text-sm text-muted-foreground">
                  Todos os seus {total} palpites foram enviados.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Você já enviou {filled} de {total} palpites.
              </p>
            )}
            <ProgressBar value={filled} total={total} />
          </section>

          {/* Bloco de incentivo do estado vazio */}
          {isEmpty ? (
            <div className="flex flex-col items-center gap-1 py-4 text-center">
              <Trophy
                size={24}
                aria-hidden="true"
                className="text-muted-foreground"
              />
              <p className="text-lg font-semibold text-foreground">
                Ainda não há palpites
              </p>
              <p className="text-sm text-muted-foreground">
                Escolha uma fase para começar.
              </p>
            </div>
          ) : null}

          {/* Lista de cards de fase */}
          <div className="flex flex-col gap-3">
            {phases.map((phase) => (
              <PhaseCard
                key={phase.stage}
                title={phase.title}
                gamesCount={phase.gamesCount}
                pendingCount={phase.pendingCount}
                status={phase.status}
                href={phase.href}
                icon={Trophy}
              />
            ))}
          </div>

          {/* CTA primário */}
          <Link
            href={completeHref}
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "min-h-[44px] w-full md:w-auto md:self-start",
            )}
          >
            {isComplete ? (
              <ChevronRight size={20} aria-hidden="true" />
            ) : (
              <Zap size={20} aria-hidden="true" />
            )}
            {ctaLabel}
          </Link>
        </>
      )}
    </div>
  );
}
