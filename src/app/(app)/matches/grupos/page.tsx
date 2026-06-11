/**
 * Página /matches/grupos — Grupos (TASK-07 implementará o conteúdo real).
 *
 * Server Component intencional: sem "use client".
 * AuthGuard + AppShell + CompetitionTabs já fornecidos pelos layouts pai.
 * Placeholder navegável e deep-linkável; rota estática tem precedência sobre /matches/[id].
 */
export default function GruposPage() {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <h1 className="sr-only">Grupos</h1>
      <p className="text-muted-foreground text-sm">Em breve</p>
    </div>
  );
}
