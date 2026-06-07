/** Estado de carregamento da lista de usuários (placeholder animado). */
export function UserListSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando usuários"
      className="flex flex-col"
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
        >
          <div className="size-10 shrink-0 rounded-full bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="h-3 w-1/3 rounded bg-muted animate-pulse motion-reduce:animate-none" />
            <div className="h-2 w-1/2 rounded bg-muted animate-pulse motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}
