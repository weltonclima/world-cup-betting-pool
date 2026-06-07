"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import { BlockedScreen } from "@/components/layout/BlockedScreen";
import { LoadingScreen } from "@/components/layout/LoadingScreen";

interface AuthLayoutProps {
  children: ReactNode;
}

/** Rota da tela "Aguardando Aprovação" (vive no próprio grupo (auth)). */
const PENDING_ROUTE = "/pending";

/**
 * Layout das rotas públicas de autenticação.
 * Implementa a guarda inversa: ejeta usuários autenticados das telas de auth
 * para o destino correto conforme o status.
 *
 * Estados:
 * - loading → <LoadingScreen />
 * - status === "approved" → redireciona /home
 * - status === "pending" fora de /pending → redireciona /pending
 * - autenticado sem perfil válido (blocked/null) → <BlockedScreen /> (fallback seguro)
 * - demais casos → renderiza children (login, signup, /pending, etc.)
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  const { loading, firebaseUser, status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // O usuário pendente DEVE ver a tela /pending; só redirecionamos quando ele
  // está em outra rota de auth (ex.: caiu no /login ou acabou de se cadastrar).
  const onPendingRoute = pathname === PENDING_ROUTE;
  const pendingNeedsRedirect =
    !!firebaseUser && status === "pending" && !onPendingRoute;

  useEffect(() => {
    // Aguarda o estado de auth ser resolvido antes de redirecionar.
    if (loading) return;

    // Usuário já autenticado e aprovado não deve ver as telas de auth.
    if (firebaseUser && status === "approved") {
      router.push("/home");
      return;
    }

    // Usuário pendente em rota de auth que não a /pending → tela de aprovação.
    if (pendingNeedsRedirect) {
      router.push(PENDING_ROUTE);
    }
  }, [loading, firebaseUser, status, pendingNeedsRedirect, router]);

  // Enquanto carrega, exibe tela de loading.
  if (loading) {
    return <LoadingScreen />;
  }

  // Usuário autenticado sem perfil aprovado/pendente (blocked ou perfil ausente/corrompido)
  // não deve ver as telas de auth normais — fallback seguro consistente com o AuthGuard.
  if (firebaseUser && status !== "approved" && status !== "pending") {
    return <BlockedScreen />;
  }

  // Aprovado ou pendente-em-redirect — renderiza null enquanto o redirect acontece.
  if ((firebaseUser && status === "approved") || pendingNeedsRedirect) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {children}
    </div>
  );
}
