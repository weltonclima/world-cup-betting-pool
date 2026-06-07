"use client";

/**
 * MatchCardSkeleton / MatchListSkeleton — skeletons de carregamento (TASK-03).
 * Apresentacionais: sem props de dados, apenas animação de carregamento.
 */

// ---------------------------------------------------------------------------
// MatchCardSkeleton — skeleton de um único card de jogo
// ---------------------------------------------------------------------------

/**
 * Skeleton para um MatchCard enquanto os dados carregam.
 * Replica o layout do card real (grupo, times+horário, estádio, badge).
 */
export function MatchCardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando jogo"
      className="rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col gap-3"
    >
      {/* Grupo */}
      <div
        aria-hidden="true"
        className="h-3 w-24 mx-auto rounded bg-muted animate-pulse motion-reduce:animate-none"
      />

      {/* Times + horário */}
      <div className="flex items-center justify-between gap-2 py-1">
        {/* Mandante */}
        <div aria-hidden="true" className="flex flex-col items-center gap-1">
          <div className="w-10 h-7 rounded-sm bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="h-3 w-14 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        </div>

        {/* Horário/placar */}
        <div aria-hidden="true" className="flex flex-col items-center gap-1 flex-1">
          <div className="h-8 w-16 mx-auto rounded bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="h-3 w-20 mx-auto rounded bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="h-3 w-28 mx-auto rounded bg-muted animate-pulse motion-reduce:animate-none" />
        </div>

        {/* Visitante */}
        <div aria-hidden="true" className="flex flex-col items-center gap-1">
          <div className="w-10 h-7 rounded-sm bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="h-3 w-14 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        </div>
      </div>

      {/* Badge de status */}
      <div className="border-t border-border pt-3">
        <div
          aria-hidden="true"
          className="h-6 w-32 rounded-md bg-muted animate-pulse motion-reduce:animate-none"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MatchListSkeleton — lista de N skeletons com cabeçalho de seção
// ---------------------------------------------------------------------------

export interface MatchListSkeletonProps {
  /** Número de cards skeleton a renderizar. Default: 3. */
  count?: number;
}

/**
 * Skeleton para a lista completa de jogos (seção de dia + N cards).
 */
export function MatchListSkeleton({ count = 3 }: MatchListSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando jogos"
      className="flex flex-col gap-4"
    >
      {/* Cabeçalho de seção skeleton (label de dia) */}
      <div
        aria-hidden="true"
        className="h-5 w-32 rounded bg-muted animate-pulse motion-reduce:animate-none"
      />

      {/* Cards */}
      <div className="flex flex-col gap-4">
        {Array.from({ length: count }, (_, i) => (
          <MatchCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
