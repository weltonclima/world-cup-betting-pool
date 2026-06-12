import type { ReactNode } from "react";

import { CompetitionTabs } from "@/features/worldcup/components";

/**
 * Layout compartilhado da área Jogos (TASK-06).
 *
 * Server Component intencional: sem "use client".
 * Aplica-se a /matches, /matches/grupos, /matches/eliminatorias e /matches/[id].
 * AuthGuard + AppShell já são fornecidos pelo layout pai (app)/layout.tsx — não remontar.
 *
 * O <CompetitionTabs /> (client) auto-oculta nas rotas de detalhe (/matches/[id]).
 */
export default function MatchesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <CompetitionTabs />
      <div>{children}</div>
    </div>
  );
}
