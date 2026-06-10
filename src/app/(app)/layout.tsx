"use client";

import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { BiometricActivationPrompt } from "@/features/passkeys";

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * Layout das rotas internas protegidas.
 * Envolve o conteúdo com AuthGuard (verifica autenticação) e AppShell (estrutura visual).
 */
export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <AuthGuard>
      <BiometricActivationPrompt />
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
