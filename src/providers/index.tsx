"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSessionRenewal } from "@/hooks/useSessionRenewal";

import { QueryProvider } from "./QueryProvider";
import { AuthProvider } from "./AuthProvider";

/**
 * Componente headless (TASK-02): mantém o session cookie renovado enquanto a
 * sessão Firebase do client estiver viva. Não renderiza UI. Fica dentro do
 * AuthProvider para viver no mesmo boundary client da sessão.
 */
function SessionRenewalManager(): null {
  useSessionRenewal();
  return null;
}

// Reexports úteis para consumidores e testes.
export { QueryProvider, makeQueryClient } from "./QueryProvider";
export {
  AuthProvider,
  AuthContext,
  type AuthContextValue,
  type AuthProfileError,
} from "./AuthProvider";

/**
 * Compõe os provedores globais da aplicação.
 * Ordem importa: ThemeProvider (mais externo) envolve toda a árvore client para
 * aplicar a classe `.dark` no <html> antes da hidratação; QueryProvider (externo)
 * > AuthProvider (interno), pois o auth pode, no futuro, usar React Query → a
 * query precisa estar acima. O <Toaster> (Sonner via wrapper Shadcn) é montado
 * dentro do boundary client e herda o tema via `useTheme` do next-themes.
 *
 * ThemeProvider (TASK-02): `attribute="class"` casa com o `@custom-variant dark`
 * do Tailwind v4 em globals.css; `defaultTheme="light"` preserva o comportamento
 * claro atual; `enableSystem` habilita o modo automático (segue o SO via
 * prefers-color-scheme); `disableTransitionOnChange` evita flash de transição na
 * troca. Requer `suppressHydrationWarning` no <html> (root layout).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <QueryProvider>
        <AuthProvider>
          <SessionRenewalManager />
          <TooltipProvider>
            {children}
            <Toaster richColors position="top-center" />
          </TooltipProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
