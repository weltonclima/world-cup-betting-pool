import { Archive } from "lucide-react";

/** Estado vazio da landing do Histórico (pool sem campeonatos arquivados, TASK-15). */
export function HistoryEmptyState() {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center"
    >
      <Archive size={40} aria-hidden="true" className="text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">
        Nenhum campeonato no histórico
      </p>
      <p className="text-xs text-muted-foreground">
        Quando um campeonato terminar, ele aparece aqui com o ranking final
        congelado.
      </p>
    </div>
  );
}
