"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import { isSuperAdminRole } from "@/schemas/shared";

import { LoadingScreen } from "./LoadingScreen";

interface AdminGuardProps {
  children: ReactNode;
}

/**
 * Guarda de papel para o painel administrativo (PRD-01.2, A3 — camada 2 da
 * defesa em profundidade). Roda DENTRO do AuthGuard (`(app)/layout.tsx`), que já
 * garante autenticado + approved; aqui só decidimos sobre `role`.
 *
 * Espelha o AuthGuard: trata `loading` ANTES de decidir (sem flash de conteúdo).
 *
 * Estados:
 * - loading → <LoadingScreen />
 * - role === "admin" → renderiza children
 * - role !== "admin" (user | null) → router.replace("/home") + null (não vaza painel)
 */
export function AdminGuard({ children }: AdminGuardProps) {
  const { loading, role } = useAuth();
  const router = useRouter();

  // Dupla-compat (R4): privilégio global = `admin` (legado) OU `super_admin`
  // (canônico PRD-09). `isSuperAdminRole` é a fonte única dessa equivalência.
  const allowed = role !== null && isSuperAdminRole(role);

  useEffect(() => {
    if (loading) return;
    if (!allowed) {
      // replace (não push): não deixa /admin no histórico do não-admin.
      router.replace("/home");
    }
  }, [loading, allowed, router]);

  if (loading) {
    return <LoadingScreen />;
  }

  // Sem privilégio — renderiza null enquanto o redirect acontece (sem vazar painel).
  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
