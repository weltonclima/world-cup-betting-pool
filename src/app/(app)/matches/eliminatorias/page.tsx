/**
 * Página /matches/eliminatorias — Tela de Eliminatórias (TASK-08).
 *
 * Server Component intencional: sem "use client".
 * AuthGuard + AppShell + CompetitionTabs fornecidos pelos layouts pai.
 * Conteúdo interativo delegado ao BracketView ("use client").
 */

import { BracketView } from "@/features/worldcup/components";

export default function EliminatoriasPage() {
  return (
    <>
      {/* Título acessível (sr-only) — visível apenas para leitores de tela */}
      <h1 className="sr-only">Eliminatórias</h1>

      {/* Conteúdo interativo: fases empilhadas + cards de confronto */}
      <BracketView />
    </>
  );
}
