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

import { useIsCupActive } from "@/features/championships";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Configuração das abas
// ---------------------------------------------------------------------------
// `cupOnly`: aba de fase de grupos FIFA / chaveamento — só existe em copas e
// torneios. Ligas de pontos corridos (TASK-10) escondem essas abas.
// `leagueOnly` (TASK-20): aba de classificação de pontos corridos — só existe
// em ligas. Copas/torneios escondem esta aba (usam Grupos/Eliminatórias).
// Um TAB nunca é cupOnly e leagueOnly ao mesmo tempo (mutuamente exclusivos).

const TABS = [
  { href: "/matches", label: "Partidas", cupOnly: false, leagueOnly: false },
  { href: "/matches/grupos", label: "Grupos", cupOnly: true, leagueOnly: false },
  { href: "/matches/eliminatorias", label: "Eliminatórias", cupOnly: true, leagueOnly: false },
  { href: "/matches/classificacao", label: "Classificação", cupOnly: false, leagueOnly: true },
] as const;

// ---------------------------------------------------------------------------
// Helpers de roteamento
// ---------------------------------------------------------------------------

/** Retorna true se o pathname corresponde a uma das rotas que exibe as abas. */
function isTabRoute(pathname: string): boolean {
  return (
    pathname === "/matches" ||
    pathname.startsWith("/matches/grupos") ||
    pathname.startsWith("/matches/eliminatorias") ||
    pathname.startsWith("/matches/classificacao")
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
// Espelha o FilterChip de MatchListHeader (chips compactos "Todas as fases /
// Fase de Grupos"): rounded-full, h-8, px-3, text-xs; ativo = preenchido
// (primary), inativo = outline. Sem trilho muted nem largura total.

/** Classes comuns a todos os links (ativo e inativo). */
const TAB_BASE =
  "inline-flex shrink-0 items-center justify-center rounded-full h-8 px-3 " +
  "border text-xs font-medium whitespace-nowrap " +
  "transition-colors duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** Classes adicionais para a aba ativa (variante default/preenchida). */
const TAB_ACTIVE = "bg-primary text-primary-foreground border-transparent hover:bg-primary/80";

/** Classes adicionais para abas inativas (variante outline). */
const TAB_INACTIVE =
  "border-border bg-background text-foreground hover:bg-muted hover:text-foreground";

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
  const isCup = useIsCupActive();

  // Oculto em /matches/[id] e qualquer sub-rota não mapeada
  if (!isTabRoute(pathname)) return null;

  // Gate cup/league (TASK-10 + TASK-20): copa esconde Classificação; liga esconde
  // Grupos/Eliminatórias. Abas removidas do DOM (não apenas `hidden`) para
  // preservar ordem de foco/leitura.
  const tabs = TABS.filter((tab) => (isCup ? !tab.leagueOnly : !tab.cupOnly));

  return (
    <nav aria-label="Seções de Jogos" className={cn(className)}>
      {/* Linha de chips compactos roláveis (espelha os filtros rápidos de Jogos) */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map((tab) => {
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
