"use client";

/**
 * CompetitionTabs — segmented control de navegação entre as seções de Jogos.
 *
 * Renderiza as abas Partidas / Grupos / Eliminatórias apenas nas rotas-alvo;
 * retorna null na tela de detalhe de jogo (/matches/[id]) e em qualquer
 * rota não mapeada dentro de /matches.
 *
 * UI-spec: ai/ui-spec/grupos-eliminatorias-task-06.md
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Configuração das abas
// ---------------------------------------------------------------------------

const TABS = [
  { href: "/matches", label: "Partidas" },
  { href: "/matches/grupos", label: "Grupos" },
  { href: "/matches/eliminatorias", label: "Eliminatórias" },
] as const;

// ---------------------------------------------------------------------------
// Helpers de roteamento
// ---------------------------------------------------------------------------

/** Retorna true se o pathname corresponde a uma das rotas que exibe as abas. */
function isTabRoute(pathname: string): boolean {
  return (
    pathname === "/matches" ||
    pathname.startsWith("/matches/grupos") ||
    pathname.startsWith("/matches/eliminatorias")
  );
}

/** Retorna true se a aba é a ativa para o pathname fornecido. */
function isActive(tabHref: string, pathname: string): boolean {
  if (tabHref === "/matches") return pathname === "/matches";
  return pathname.startsWith(tabHref);
}

// ---------------------------------------------------------------------------
// Classes reutilizáveis de cada TabLink
// ---------------------------------------------------------------------------

/** Classes comuns a todos os links (ativo e inativo). */
const TAB_BASE =
  "flex-1 sm:flex-none text-center rounded-full h-11 sm:h-9 px-3 " +
  "inline-flex items-center justify-center text-xs sm:text-sm whitespace-nowrap " +
  "transition-colors duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** Classes adicionais para a aba ativa. */
const TAB_ACTIVE = "bg-primary text-primary-foreground shadow-sm font-medium";

/** Classes adicionais para abas inativas. */
const TAB_INACTIVE =
  "text-muted-foreground hover:bg-muted/60 hover:text-foreground " +
  "active:scale-[0.98] motion-reduce:transform-none";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CompetitionTabsProps {
  /** Classe CSS extra aplicada ao elemento <nav>. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Segmented control de navegação entre Partidas / Grupos / Eliminatórias.
 * Auto-oculta nas rotas de detalhe de jogo e em rotas não mapeadas.
 */
export function CompetitionTabs({ className }: CompetitionTabsProps) {
  const pathname = usePathname();

  // Oculto em /matches/[id] e qualquer sub-rota não mapeada
  if (!isTabRoute(pathname)) return null;

  return (
    <nav aria-label="Seções de Jogos" className={cn(className)}>
      {/* Trilho do segmented control */}
      <div className="bg-muted/50 rounded-full p-1 flex w-full sm:w-auto sm:inline-flex gap-1">
        {TABS.map((tab) => {
          const active = isActive(tab.href, pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(TAB_BASE, active ? TAB_ACTIVE : TAB_INACTIVE)}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
