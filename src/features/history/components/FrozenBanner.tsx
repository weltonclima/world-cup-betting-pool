import { Lock } from "lucide-react";

/**
 * Aviso de conteúdo congelado no topo do detalhe do Histórico (TASK-15).
 * `role="note"` — informativo, distinto de disabled (`read-only-distinction`):
 * não reduz opacidade nem bloqueia leitura, só comunica o read-only.
 */
export function FrozenBanner() {
  return (
    <div
      role="note"
      className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
    >
      <Lock size={16} aria-hidden="true" className="shrink-0" />
      Campeonato encerrado — ranking, jogos e estatísticas congelados.
    </div>
  );
}
