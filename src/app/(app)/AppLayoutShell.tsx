"use client";

import { Suspense, type ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { ActiveChampionshipProvider } from "@/features/championships";
import { BiometricActivationPrompt } from "@/features/passkeys";
import { ThemeSync } from "@/features/profile/components";
import { PoolThemeVars } from "@/features/groupAdmin/components/PoolThemeVars";
import { InstallPrompt } from "@/features/push/components/InstallPrompt";
import { PushOptInPrompt } from "@/features/push/components/PushOptInPrompt";

interface AppLayoutShellProps {
  children: ReactNode;
}

/**
 * Casca client da área autenticada. Extraída do layout para que o layout em si
 * possa ser um Server Component (ler o cookie `pool-primary` sem forçar todas as
 * rotas de auth a dynamic — TASK-03 M1). Envolve o conteúdo com AuthGuard
 * (verifica autenticação) e AppShell (estrutura visual).
 */
export function AppLayoutShell({ children }: AppLayoutShellProps) {
  return (
    <AuthGuard>
      {/* Hidrata o tema salvo no perfil (cross-device) em toda a área autenticada. */}
      <ThemeSync />
      {/* Sincroniza a cor do grupo (tema por pool, TASK-03) nas CSS vars. */}
      <PoolThemeVars />
      <BiometricActivationPrompt />
      <AppShell>
        {/* Banner de instalação do PWA (web-push-pwa TASK-06) — dispensável,
            auto-gated (some em standalone/sem suporte/dispensado). */}
        <InstallPrompt className="mb-4" />
        {/* Soft-ask pró-ativo de push (push-optin) — aparece pra quem não ligou
            o push; "Agora não" adia 24h, some ao ligar/negar. */}
        <PushOptInPrompt className="mb-4" />
        {/* Provider do campeonato ativo (multi-championship TASK-09). Montado UMA
            vez aqui (não por feature). Lê `?championship=` via useSearchParams →
            precisa de <Suspense> (exigência do Next 15). */}
        <Suspense fallback={children}>
          <ActiveChampionshipProvider>{children}</ActiveChampionshipProvider>
        </Suspense>
      </AppShell>
    </AuthGuard>
  );
}
