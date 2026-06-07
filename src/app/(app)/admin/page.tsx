/**
 * Painel administrativo (PRD-01.2). Placeholder mínimo — o conteúdo real
 * (tabs Pendentes/Aprovados/Bloqueados + lista + ações) é entregue na TASK-06.
 * O gating de acesso vive em `(app)/admin/layout.tsx` (AdminGuard).
 */
export default function AdminPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-foreground">
        Usuários Pendentes
      </h1>
      <p className="text-sm text-muted-foreground">
        Painel em construção — listagem e ações serão adicionadas na próxima
        tarefa.
      </p>
    </div>
  );
}
