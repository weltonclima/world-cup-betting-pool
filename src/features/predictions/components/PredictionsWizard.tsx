"use client";

/**
 * PredictionsWizard — barra de navegação do fluxo guiado "Completar Copa"
 * (TASK-16, PRD03-01..16).
 *
 * Componente APRESENTACIONAL e puro: recebe a etapa atual, total, rótulo e
 * destinos de Anterior/Próximo por props. A resolução URL-driven e a
 * persistência do modo ficam em usePredictionsWizard, conectado pelo layout
 * da rota `/predictions`.
 *
 * Só renderiza quando o modo "Completar Copa" está ativo E o pathname pertence
 * ao wizard (stepIndex !== null). Caso contrário, a navegação é livre via Hub.
 *
 * Tema: tokens apenas — herda o verde dentro de `.palpites-theme`.
 *
 * Contrato: ai/spec/palpites-massa-task-16.md · ai/screen/palpites-massa-task-16.md
 */

import Link from "next/link";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export interface PredictionsWizardProps {
  /** Índice 0-based da etapa atual; null = fora do wizard → não renderiza. */
  stepIndex: number | null;
  /** Total de etapas. */
  totalSteps: number;
  /** Rótulo curto da etapa atual. */
  stepLabel: string | null;
  /** Href da etapa anterior (undefined oculta o botão). */
  prevHref?: string;
  /** Href da próxima etapa (undefined oculta o botão). */
  nextHref?: string;
  /** Modo "Completar Copa" ativo. */
  active: boolean;
  /** Sai do modo guiado. */
  onExit: () => void;
}

export function PredictionsWizard({
  stepIndex,
  totalSteps,
  stepLabel,
  prevHref,
  nextHref,
  active,
  onExit,
}: PredictionsWizardProps) {
  // Sem barra fora do wizard ou com modo inativo.
  if (!active || stepIndex === null) return null;

  const stepNumber = stepIndex + 1;

  return (
    <nav
      aria-label="Navegação do fluxo de palpites"
      className="fixed bottom-16 left-0 right-0 z-40 border-t border-border bg-background/95 px-4 py-2 backdrop-blur-sm md:bottom-0"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
        {prevHref ? (
          <Link
            href={prevHref}
            aria-label="Etapa anterior"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "min-h-[44px]",
            )}
          >
            <ChevronLeft size={18} aria-hidden="true" />
            Anterior
          </Link>
        ) : (
          // Espaçador para manter o indicador centralizado na primeira etapa.
          <span aria-hidden="true" className="min-h-[44px] w-20" />
        )}

        <div className="flex flex-col items-center gap-0.5 text-center">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            <Zap size={14} aria-hidden="true" />
            Completar Copa
          </span>
          <span aria-live="polite" className="text-xs text-muted-foreground">
            Etapa {stepNumber} de {totalSteps}
            {stepLabel ? ` · ${stepLabel}` : ""}
          </span>
          <button
            type="button"
            onClick={onExit}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Sair do modo guiado
          </button>
        </div>

        {nextHref ? (
          <Link
            href={nextHref}
            aria-label="Próxima etapa"
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "min-h-[44px]",
            )}
          >
            Próximo
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        ) : (
          <span aria-hidden="true" className="min-h-[44px] w-20" />
        )}
      </div>
    </nav>
  );
}
