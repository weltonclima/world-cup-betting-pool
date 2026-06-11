"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import { isGroupAdminRole, isSuperAdminRole } from "@/schemas/shared";

import { LoadingScreen } from "./LoadingScreen";

/**
 * Guarda de papel para a Administração de Grupo (PRD-10 — camada 2 da defesa em
 * profundidade; os Route Handlers `/api/group/*` revalidam server-side). Roda
 * DENTRO do AuthGuard (`(app)/layout.tsx`): autenticado + approved já garantidos;
 * aqui só decidimos sobre `role`.
 *
 * Acesso liberado para group_admin OU super_admin (legado `admin` é dual-compat
 * via `isSuperAdminRole`). Demais papéis são redirecionados para /home sem pintar
 * o conteúdo.
 */
export function GroupAdminGuard({ children }: { children: ReactNode }) {
  const { loading, role } = useAuth();
  const router = useRouter();

  const allowed =
    role !== null && (isGroupAdminRole(role) || isSuperAdminRole(role));

  useEffect(() => {
    if (loading) return;
    if (!allowed) {
      router.replace("/home");
    }
  }, [loading, allowed, router]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
