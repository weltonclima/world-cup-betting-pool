"use client";

import type { ReactNode } from "react";

import { AdminGuard } from "@/components/layout/AdminGuard";

/**
 * Layout do segmento /admin. Aninha apenas o AdminGuard (checagem de role) em
 * volta do conteúdo — AppShell/AuthGuard são herdados de `(app)/layout.tsx`.
 * Cobre /admin e qualquer sub-rota futura por composição do App Router.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminGuard>{children}</AdminGuard>;
}
