"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import { BlockedScreen } from "@/components/layout/BlockedScreen";
import { LoadingScreen } from "@/components/layout/LoadingScreen";

interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * Layout das rotas públicas de autenticação.
 * Implementa a guarda inversa: redireciona usuários já autenticados e aprovados para /home.
 *
 * Estados:
 * - loading → <LoadingScreen />
 * - status === "approved" → redireciona /home
 * - autenticado sem perfil válido (blocked/null) → <BlockedScreen /> (fallback seguro)
 * - demais casos → renderiza children (login, pending, etc.)
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  const { loading, firebaseUser, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Aguarda o estado de auth ser resolvido antes de redirecionar.
    if (loading) return;

    // Usuário já autenticado e aprovado não deve ver a tela de login.
    if (firebaseUser && status === "approved") {
      router.push("/home");
    }
  }, [loading, firebaseUser, status, router]);

  // Enquanto carrega, exibe tela de loading.
  if (loading) {
    return <LoadingScreen />;
  }

  // Usuário autenticado sem perfil aprovado/pendente (blocked ou perfil ausente/corrompido)
  // não deve ver as telas de auth normais — fallback seguro consistente com o AuthGuard.
  if (firebaseUser && status !== "approved" && status !== "pending") {
    return <BlockedScreen />;
  }

  // Usuário aprovado — renderiza null enquanto o redirect acontece.
  if (firebaseUser && status === "approved") {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {children}
    </div>
  );
}
