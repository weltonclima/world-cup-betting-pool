"use client";

import type { ReactNode } from "react";

import { BottomNav } from "./BottomNav";
import { Header } from "./Header";
import { SideNav } from "./SideNav";

interface AppShellProps {
  children: ReactNode;
}

/**
 * Contêiner principal do app interno.
 * Renderiza Header fixo, SideNav (desktop), BottomNav (mobile) e área de conteúdo.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Link de acessibilidade: pula para o conteúdo principal */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-primary focus:shadow-md"
      >
        Pular para o conteúdo principal
      </a>

      {/* Cabeçalho fixo */}
      <Header />

      {/* Área abaixo do header: SideNav + conteúdo */}
      <div className="flex flex-1 pt-14">
        {/* Navegação lateral — apenas desktop */}
        <SideNav />

        {/* Conteúdo principal */}
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 py-4 pb-20 md:pb-4"
        >
          <div className="mx-auto min-w-0 max-w-4xl">
            {children}
          </div>
        </main>
      </div>

      {/* Navegação inferior — apenas mobile */}
      <BottomNav />
    </div>
  );
}
