"use client";

/**
 * CurrentStageBanner — badge discreto da fase ativa da Copa (PRD-16 / TASK-04).
 *
 * Presentational puro: recebe `stage` por prop (derivado em useHomeDashboard via
 * deriveCurrentStage). Oculto quando `stage === null` (degrada silenciosamente).
 * Contrato visual: ai/ui-spec/task-ranking-eliminatorias-04.md.
 */

import { CalendarClock } from "lucide-react";

import { STAGE_LABEL } from "@/features/matches/lib/stageLabels";
import type { Stage } from "@/types";

export function CurrentStageBanner({ stage }: { stage: Stage | null }) {
  if (stage === null) return null;

  return (
    <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
      <CalendarClock size={14} aria-hidden="true" />
      <span>
        <span className="text-muted-foreground">Copa em: </span>
        {STAGE_LABEL[stage]}
      </span>
    </div>
  );
}
