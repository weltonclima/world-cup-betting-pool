/**
 * Página /matches/classificacao — Tela de Classificação de liga (TASK-20).
 *
 * Server Component intencional: sem "use client".
 * AuthGuard + AppShell + CompetitionTabs fornecidos pelos layouts pai.
 * Conteúdo interativo (gate cup/league + tabela) delegado ao LeagueTableView.
 */

import { LeagueTableView } from "@/features/worldcup/components";

export default function ClassificacaoPage() {
  return (
    <>
      {/* Título acessível (sr-only) — visível apenas para leitores de tela */}
      <h1 className="sr-only">Classificação</h1>

      {/* Conteúdo interativo: gate de liga + tabela de pontos corridos + legenda */}
      <LeagueTableView />
    </>
  );
}
