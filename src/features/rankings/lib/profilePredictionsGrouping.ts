import { stageSchema } from "@/schemas/shared";
import type { PredictionDisplayStatus } from "@/features/predictions/lib";

import type { ProfilePredictionItem } from "./profileTypes";

export interface PredictionSubBucket {
  key: string;
  label: string;
  items: ProfilePredictionItem[];
}

export interface PredictionPhaseBucket {
  phase: "grupos" | "eliminatoria";
  label: string;
  subBuckets: PredictionSubBucket[];
  correctCount: number;
  totalItems: number;
}

const GROUP_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

const ELIM_ORDER = stageSchema.options.filter((s) => s !== "grupos");

const ELIM_LABELS: Record<string, string> = {
  "dezesseis-avos": "Dezesseis Avos de Final",
  oitavas: "Oitavas de Final",
  quartas: "Quartas de Final",
  semifinal: "Semifinal",
  terceiro: "Disputa 3º Lugar",
  final: "Final",
};

const CORRECT_STATUSES = new Set<PredictionDisplayStatus>([
  "acertou",
  "acertou_vencedor",
  "acertou_empate",
]);

function byKickoff(a: ProfilePredictionItem, b: ProfilePredictionItem): number {
  return a.kickoffAt < b.kickoffAt ? -1 : a.kickoffAt > b.kickoffAt ? 1 : 0;
}

export function groupProfilePredictions(items: ProfilePredictionItem[]): PredictionPhaseBucket[] {
  if (items.length === 0) return [];

  const grupoItems = items.filter((i) => i.stage === "grupos");
  const elimItems = items.filter((i) => i.stage !== "grupos");
  const buckets: PredictionPhaseBucket[] = [];

  if (grupoItems.length > 0) {
    const grouped = new Map<string, ProfilePredictionItem[]>();
    for (const item of grupoItems) {
      const key = item.groupId ?? "?";
      const arr = grouped.get(key) ?? [];
      arr.push(item);
      grouped.set(key, arr);
    }

    const allKeys = [...GROUP_KEYS];
    if (grouped.has("?")) allKeys.push("?");

    const subBuckets: PredictionSubBucket[] = allKeys.map((key) => ({
      key,
      label: key === "?" ? "Grupo ?" : `Grupo ${key}`,
      items: (grouped.get(key) ?? []).sort(byKickoff),
    }));

    const correctCount = grupoItems.filter((i) => CORRECT_STATUSES.has(i.displayStatus)).length;
    buckets.push({
      phase: "grupos",
      label: "Fase de Grupos",
      subBuckets,
      correctCount,
      totalItems: grupoItems.length,
    });
  }

  if (elimItems.length > 0) {
    const grouped = new Map<string, ProfilePredictionItem[]>();
    for (const item of elimItems) {
      const key = item.stage;
      const arr = grouped.get(key) ?? [];
      arr.push(item);
      grouped.set(key, arr);
    }

    const subBuckets: PredictionSubBucket[] = ELIM_ORDER.filter((stage) =>
      grouped.has(stage),
    ).map((stage) => ({
      key: stage,
      label: ELIM_LABELS[stage] ?? stage,
      items: (grouped.get(stage) ?? []).sort(byKickoff),
    }));

    const correctCount = elimItems.filter((i) => CORRECT_STATUSES.has(i.displayStatus)).length;
    buckets.push({
      phase: "eliminatoria",
      label: "Fase Eliminatória",
      subBuckets,
      correctCount,
      totalItems: elimItems.length,
    });
  }

  return buckets;
}
