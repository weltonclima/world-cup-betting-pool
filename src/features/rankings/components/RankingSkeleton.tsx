/**
 * Skeleton de carregamento de ranking (PRD-05, TASK-07).
 * Linhas com avatar circular + barras. Respeita prefers-reduced-motion.
 */
export interface RankingSkeletonProps {
  rows?: number;
}

export function RankingSkeleton({ rows = 8 }: RankingSkeletonProps) {
  return (
    <div role="status" aria-label="Carregando ranking" className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
        >
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          </div>
          <div className="h-6 w-10 shrink-0 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
