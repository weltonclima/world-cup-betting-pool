"use client";

import type { ReactNode } from "react";

import { GroupAdminGuard } from "@/components/layout/GroupAdminGuard";

/**
 * Layout do segmento /grupo (Administração de Grupo, PRD-10). Aninha o
 * GroupAdminGuard (checagem de role group_admin/super_admin) — AppShell/AuthGuard
 * são herdados de `(app)/layout.tsx`. Cobre todas as sub-rotas por composição.
 */
export default function GrupoLayout({ children }: { children: ReactNode }) {
  return (
    <GroupAdminGuard>
      <div className="flex flex-col gap-4 pb-20 md:pb-4">{children}</div>
    </GroupAdminGuard>
  );
}
