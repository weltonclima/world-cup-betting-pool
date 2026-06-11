"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import { isSuperAdminRole } from "@/schemas/shared";
import { LoadingScreen } from "./LoadingScreen";

/**
 * Role guard da área global do Super Admin (PRD-11 — camada client de
 * defense-in-depth). Roda DENTRO do AuthGuard (autenticado + approved garantidos).
 * Só decide por `role`.
 *
 * Acesso liberado para `super_admin` (dupla-compat legado `admin` via
 * `isSuperAdminRole`). Demais papéis → redirect /home sem pintar o conteúdo. A
 * segurança REAL é server-side (`authorizeGroupAdmin` em todas as rotas).
 */
export function SuperAdminGuard({ children }: { children: ReactNode }) {
  const { loading, role } = useAuth();
  const router = useRouter();

  const allowed = role !== null && isSuperAdminRole(role);

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
