"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { LoadingScreen } from "@/components/layout/LoadingScreen";

/**
 * Página raiz — redireciona para a home interna via client-side router.
 * Necessário em static export (output: 'export'), que não suporta redirect()
 * de servidor (Server Component). O AuthGuard na rota /home cuida da
 * verificação de autenticação: usuário não autenticado é redirecionado para /login.
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // replace em vez de push: evita que a rota raiz "/" fique no histórico do browser.
    router.replace("/home");
  }, [router]);

  // Exibe a tela de carregamento enquanto o redirect client-side acontece,
  // evitando flash de tela em branco.
  return <LoadingScreen />;
}
