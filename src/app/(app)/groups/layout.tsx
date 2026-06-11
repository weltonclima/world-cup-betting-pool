import type { ReactNode } from "react";

import { SuperAdminGuard } from "@/components/layout/SuperAdminGuard";

/**
 * Layout da seção Grupos (PRD-09). Aplica o tema verde escopo `.grupos-theme`
 * (MASTER §2.4 — mesmo verde validado AA) às telas de /groups (criar, buscar,
 * detalhe). AppShell/AuthGuard são herdados de `(app)/layout.tsx`.
 *
 * Acesso restrito a super_admin (SuperAdminGuard): no modelo de papéis vigente o
 * super_admin cria/edita/vê TODOS os grupos. group_admin gere o próprio grupo por
 * /group/*; participante entra apenas por link de convite (/invite/[code]) e não
 * tem visão de grupo. Demais papéis → redirect /home sem pintar o conteúdo.
 */
export default function GruposLayout({ children }: { children: ReactNode }) {
  return (
    <SuperAdminGuard>
      <div className="grupos-theme flex flex-col gap-4 pb-20 md:pb-4">
        {children}
      </div>
    </SuperAdminGuard>
  );
}
