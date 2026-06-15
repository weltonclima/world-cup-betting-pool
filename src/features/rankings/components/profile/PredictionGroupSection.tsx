"use client";

import { useState, type JSX } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PredictionSubBucket } from "@/features/rankings/lib";

import { PredictionMatchRow } from "./PredictionMatchRow";

const CORRECT_DISPLAY_STATUSES = new Set([
  "acertou",
  "acertou_vencedor",
  "acertou_empate",
]);

interface PredictionGroupSectionProps {
  subBucket: PredictionSubBucket;
  isSelf: boolean;
  defaultOpen?: boolean;
}

export function PredictionGroupSection({
  subBucket,
  isSelf,
  defaultOpen = false,
}: PredictionGroupSectionProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = `group-${subBucket.key}`;

  const correctCount = subBucket.items.filter((i) =>
    CORRECT_DISPLAY_STATUSES.has(i.displayStatus),
  ).length;
  const total = subBucket.items.length;

  const isEmpty = total === 0;

  return (
    <div className="border-b border-border/30 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={contentId}
        className={cn(
          "flex w-full items-center justify-between gap-2 px-3 py-2 text-left",
          "rounded-lg transition-colors duration-150",
          "hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          "motion-reduce:transition-none",
        )}
      >
        <span className="text-sm font-medium text-foreground">
          {subBucket.label}
          {!isEmpty && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({correctCount}/{total} ✓)
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn(
            "shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
            "motion-reduce:transition-none",
          )}
        />
      </button>

      {/* Accordion content */}
      <div
        id={contentId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          "motion-reduce:transition-none",
        )}
      >
        <div className="overflow-hidden min-h-0">
          <div className="px-3 pb-2">
            {isEmpty ? (
              <p className="py-2 text-xs text-muted-foreground">
                {isSelf
                  ? "Nenhum palpite neste grupo"
                  : "Jogos ainda não encerrados"}
              </p>
            ) : (
              subBucket.items.map((item) => (
                <PredictionMatchRow key={item.matchId} item={item} isSelf={isSelf} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
