"use client";

/**
 * Layout das rotas do fluxo de palpites em massa (/predictions/*) — TASK-16.
 *
 * Aplica o tema `.palpites-theme` (shell verde — MASTER §2.4-palpites) no wrapper
 * e monta a barra do wizard ("⚡ Completar Copa") uma única vez sobre todas as
 * etapas. A barra é URL-driven (usePredictionsWizard) e só aparece quando o modo
 * guiado está ativo e o pathname pertence ao wizard.
 *
 * As páginas individuais mantêm seu próprio container `.palpites-theme` (idempotente)
 * e seu `pb-20` para não serem cobertas pela barra fixa.
 */

import type { ReactNode } from "react";

import { useAuth } from "@/hooks/useAuth";
import { usePredictionsWizard } from "@/features/predictions/hooks";
import { PredictionsWizard } from "@/features/predictions/components";

interface PredictionsLayoutProps {
  children: ReactNode;
}

export default function PredictionsLayout({ children }: PredictionsLayoutProps) {
  const { firebaseUser } = useAuth();
  const wizard = usePredictionsWizard(firebaseUser?.uid ?? "");

  return (
    <div className="palpites-theme">
      {children}
      <PredictionsWizard
        stepIndex={wizard.stepIndex}
        totalSteps={wizard.totalSteps}
        stepLabel={wizard.stepLabel}
        prevHref={wizard.prevHref}
        nextHref={wizard.nextHref}
        active={wizard.active}
        onExit={wizard.exit}
      />
    </div>
  );
}
