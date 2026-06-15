"use client";

import { useState, type JSX } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  PredictionPhaseBucket,
  PredictionsCount,
} from "@/features/rankings/lib";

import { PredictionGroupSection } from "./PredictionGroupSection";

interface ProfilePredictionsListProps {
  buckets: PredictionPhaseBucket[];
  isSelf: boolean;
  openPhase: "grupos" | "eliminatoria";
  predictionsCount: PredictionsCount;
}

export function ProfilePredictionsList({
  buckets,
  isSelf,
  openPhase,
  predictionsCount,
}: ProfilePredictionsListProps): JSX.Element {
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const b of buckets) {
      initial[b.phase] = b.phase === openPhase;
    }
    return initial;
  });

  const togglePhase = (phase: string) => {
    setOpenPhases((prev) => ({ ...prev, [phase]: !prev[phase] }));
  };

  return (
    <section aria-labelledby="predictions-heading">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3
          id="predictions-heading"
          className="text-lg font-semibold text-foreground"
        >
          Histórico de Palpites
        </h3>
        <span
          className="text-sm tabular-nums text-muted-foreground"
          aria-label={`${predictionsCount.made} de ${predictionsCount.ofTotal} palpites feitos`}
        >
          {predictionsCount.made}/{predictionsCount.ofTotal}
        </span>
      </div>

      {!isSelf && (
        <p
          role="status"
          className="mb-3 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground"
        >
          Exibindo apenas jogos encerrados
        </p>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm">
        {buckets.map((bucket) => {
          const isOpen = openPhases[bucket.phase] ?? false;
          const phaseContentId = `phase-${bucket.phase}`;

          // Determine which sub-bucket should be open by default (one with live match)
          const liveSubBucketKey =
            bucket.subBuckets
              .filter((sb) => sb.items.some((i) => i.matchStatus === "live"))
              .pop()?.key ?? null;

          return (
            <div
              key={bucket.phase}
              className="border-b border-border last:border-0"
            >
              <button
                type="button"
                onClick={() => togglePhase(bucket.phase)}
                aria-expanded={isOpen}
                aria-controls={phaseContentId}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-4 py-3 text-left",
                  "transition-colors duration-150",
                  "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  isOpen && "bg-muted/30",
                  "motion-reduce:transition-none",
                )}
              >
                <span className="text-sm font-semibold text-foreground">
                  {bucket.label}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    ({bucket.correctCount}/{bucket.totalItems} ✓)
                  </span>
                </span>
                <ChevronDown
                  size={18}
                  aria-hidden="true"
                  className={cn(
                    "shrink-0 text-muted-foreground transition-transform duration-200",
                    isOpen && "rotate-180",
                    "motion-reduce:transition-none",
                  )}
                />
              </button>

              <div
                id={phaseContentId}
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  "motion-reduce:transition-none",
                )}
              >
                <div className="overflow-hidden min-h-0">
                  <div className="divide-y divide-border/20">
                    {bucket.subBuckets.map((subBucket) => (
                      <PredictionGroupSection
                        key={subBucket.key}
                        subBucket={subBucket}
                        isSelf={isSelf}
                        defaultOpen={subBucket.key === liveSubBucketKey}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
