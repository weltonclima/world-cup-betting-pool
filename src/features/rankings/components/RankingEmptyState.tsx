import { Users } from "lucide-react";

/** Estado vazio do ranking (PRD-05, TASK-07). */
export interface RankingEmptyStateProps {
  message?: string;
  subtitle?: string;
}

export function RankingEmptyState({
  message = "Nenhum participante encontrado",
  subtitle,
}: RankingEmptyStateProps) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center"
    >
      <Users size={40} aria-hidden="true" className="text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{message}</p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
