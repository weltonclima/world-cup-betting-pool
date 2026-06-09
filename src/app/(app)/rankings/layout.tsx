import type { ReactNode } from "react";

import { RankingSubNav } from "@/features/rankings/components";

/**
 * Layout da seção Ranking (PRD-05, TASK-07).
 * Aplica o tema verde escopo `.ranking-theme` (MASTER §2.4-ranking) e monta a
 * sub-navegação uma única vez sobre todas as telas da seção.
 */
export default function RankingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ranking-theme flex flex-col gap-4 pb-20 md:pb-4">
      <h1 className="text-2xl font-semibold text-foreground">Ranking</h1>
      <RankingSubNav />
      {children}
    </div>
  );
}
