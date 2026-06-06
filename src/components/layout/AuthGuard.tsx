"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";

import { BlockedScreen } from "./BlockedScreen";
import { LoadingScreen } from "./LoadingScreen";

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * Guarda de autenticação para rotas protegidas (app).
 * Implementa a máquina de estados de roteamento baseada no status do usuário.
 *
 * Estados:
 * - loading → <LoadingScreen />
 * - firebaseUser === null → redireciona /login
 * - status === "pending" → redireciona /pending
 * - status === "blocked" → <BlockedScreen />
 * - status === "approved" → renderiza children
 * - status === null (erro de perfil) → <BlockedScreen /> (fallback seguro)
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { loading, firebaseUser, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Aguarda o estado de auth ser resolvido antes de redirecionar.
    if (loading) return;

    if (!firebaseUser) {
      router.push("/login");
      return;
    }

    if (status === "pending") {
      router.push("/pending");
    }
  }, [loading, firebaseUser, status, router]);

  // Enquanto carrega, exibe tela de loading.
  if (loading) {
    return <LoadingScreen />;
  }

  // Usuário não autenticado — renderiza null enquanto o redirect acontece.
  if (!firebaseUser) {
    return null;
  }

  // Usuário com acesso bloqueado ou erro de perfil.
  if (status === "blocked" || status === null) {
    return <BlockedScreen />;
  }

  // Usuário pendente — renderiza null enquanto o redirect acontece.
  if (status === "pending") {
    return null;
  }

  // Usuário aprovado — exibe o conteúdo protegido.
  return <>{children}</>;
}
