"use client";

import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { BiometricActivationPrompt } from "@/features/passkeys";
import { InstallPrompt } from "@/features/push/components/InstallPrompt";

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
      <AppShell>
        {/* Banner de instalação do PWA (web-push-pwa TASK-06) — dispensável,
            auto-gated (some em standalone/sem suporte/dispensado). */}
        <InstallPrompt className="mb-4" />
        {children}
      </AppShell>
    </AuthGuard>
  );
}
