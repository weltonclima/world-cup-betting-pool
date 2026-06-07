"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  WIZARD_TOTAL_STEPS,
  nextStepHref,
  prevStepHref,
  resolveWizardStep,
  stepLabel,
} from "../lib/predictionsWizardSteps";

/** Chave de localStorage do modo "Completar Copa" por usuário. */
function wizardKey(uid: string): string {
  return `palpites-wizard-${uid}`;
}

export interface PredictionsWizardState {
  /** Índice 0-based da etapa atual, ou null se fora do fluxo do wizard. */
  stepIndex: number | null;
  /** Total de etapas do wizard. */
  totalSteps: number;
  /** Rótulo curto da etapa atual, ou null. */
  stepLabel: string | null;
  /** Href da etapa anterior (undefined na primeira / fora). */
  prevHref: string | undefined;
  /** Href da próxima etapa (undefined na última / fora). */
  nextHref: string | undefined;
  /** Modo "Completar Copa" ativo (persistido em localStorage). */
  active: boolean;
  /** Desativa o modo guiado (remove a flag). */
  exit: () => void;
}

/**
 * Hook da casca do wizard de palpites em massa (TASK-16).
 *
 * URL-driven: deriva a etapa atual do pathname (resolveWizardStep) e os destinos
 * de Anterior/Próximo da sequência canônica (WIZARD_STEPS). Persiste o modo
 * "Completar Copa" em localStorage por usuário; o modo é ativado quando a rota
 * recebe `?wizard=1` (o CTA do Hub), e permanece ativo entre navegações/reloads
 * até o usuário sair (exit).
 *
 * SSR-safe: começa com `active=false` e lê o localStorage após o mount.
 *
 * @param uid - UID do usuário autenticado (chaveia o storage). "" desativa a persistência.
 */
export function usePredictionsWizard(uid: string): PredictionsWizardState {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);

  // Ativação via ?wizard=1 (CTA do Hub) → persiste a flag.
  const wizardParam = searchParams.get("wizard");

  useEffect(() => {
    if (typeof window === "undefined" || uid === "") return;
    if (wizardParam === "1") {
      try {
        localStorage.setItem(wizardKey(uid), "1");
      } catch {
        // localStorage indisponível — modo só na sessão atual.
      }
      setActive(true);
      return;
    }
    // Sem param: lê o estado persistido.
    try {
      setActive(localStorage.getItem(wizardKey(uid)) === "1");
    } catch {
      setActive(false);
    }
  }, [uid, wizardParam]);

  const exit = useCallback(() => {
    setActive(false);
    if (typeof window === "undefined" || uid === "") return;
    try {
      localStorage.removeItem(wizardKey(uid));
    } catch {
      // ignora
    }
  }, [uid]);

  const stepIndex = useMemo(
    () => resolveWizardStep(pathname),
    [pathname],
  );

  return {
    stepIndex,
    totalSteps: WIZARD_TOTAL_STEPS,
    stepLabel: stepLabel(pathname),
    prevHref: prevStepHref(pathname),
    nextHref: nextStepHref(pathname),
    active,
    exit,
  };
}
