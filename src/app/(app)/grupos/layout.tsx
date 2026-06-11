import type { ReactNode } from "react";

/**
 * Layout da seção Grupos (PRD-09). Aplica o tema verde escopo `.grupos-theme`
 * (MASTER §2.4 — mesmo verde validado AA) às telas de /grupos (criar, buscar,
 * detalhe). AppShell/AuthGuard são herdados de `(app)/layout.tsx`.
 */
export default function GruposLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grupos-theme flex flex-col gap-4 pb-20 md:pb-4">
      {children}
    </div>
  );
}
