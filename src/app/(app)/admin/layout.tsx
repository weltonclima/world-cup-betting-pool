"use client";

import type { ReactNode } from "react";

import { AdminGuard } from "@/components/layout/AdminGuard";

/**
 * Layout do segmento /admin. Aninha apenas o AdminGuard (checagem de role) em
 * volta do conteúdo — AppShell/AuthGuard são herdados de `(app)/layout.tsx`.
 * Cobre /admin e qualquer sub-rota futura por composição do App Router.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGuard>
      <div className="admin-theme flex flex-col gap-4 pb-20 md:pb-4">
        {children}
      </div>
    </AdminGuard>
  );
}
