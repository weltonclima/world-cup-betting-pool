/**
 * Página /matches/grupos — Tela de Grupos (TASK-07).
 *
 * Server Component intencional: sem "use client".
 * AuthGuard + AppShell + CompetitionTabs fornecidos pelos layouts pai.
 * Conteúdo interativo delegado ao GroupsView ("use client").
 */

import { GroupsView } from "@/features/worldcup/components";

export default function GruposPage() {
  return (
    <>
      {/* Título acessível (sr-only) — visível apenas para leitores de tela */}
      <h1 className="sr-only">Grupos</h1>

      {/* Conteúdo interativo: seletor de grupo + tabela + legenda */}
      <GroupsView />
    </>
  );
}
