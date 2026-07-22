"use client";

/**
 * ChampionshipSelector — seletor do campeonato ATIVO (multi-championship TASK-09).
 *
 * Segmented control acessível (radiogroup) montado acima das listas de Jogos /
 * Palpites e no topo da Home. Dirige `useActiveChampionship` (fonte da verdade =
 * `?championship=` na URL). Rótulos vêm do catálogo público (`useChampionshipsCatalog`),
 * filtrados ao conjunto habilitado do pool (ordem do catálogo).
 *
 * Auto-oculta quando o pool tem ≤ 1 campeonato (`isMultiChampionship === false`):
 * pools legados (só Copa) nunca veem o seletor — comportamento idêntico ao anterior.
 *
 * Idioma visual = `CompetitionTabs` (chips h-8/px-3, rounded-full, scroll horizontal),
 * NÃO o chip mais alto (44px) da tela de administração de campeonatos. A11y espelha
 * `GroupChampionshipsSettings`: role=radiogroup/radio, aria-checked, tabIndex roving,
 * setas com wraparound.
 */

import { useRef } from "react";

import { useChampionshipsCatalog } from "@/features/groupAdmin/hooks/useChampionshipsCatalog";
import { cn } from "@/lib/utils";

import { useActiveChampionship } from "../useActiveChampionship";

// ---------------------------------------------------------------------------
// Classes (espelham CompetitionTabs)
// ---------------------------------------------------------------------------

const CHIP_BASE =
  "inline-flex shrink-0 items-center justify-center rounded-full h-8 px-3 " +
  "border text-xs font-medium whitespace-nowrap " +
  "transition-colors duration-150 motion-reduce:transition-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const CHIP_ACTIVE =
  "bg-primary text-primary-foreground border-transparent hover:bg-primary/80";

const CHIP_INACTIVE =
  "border-border bg-background text-foreground hover:bg-muted hover:text-foreground";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChampionshipSelectorProps {
  /** Classe CSS extra aplicada ao elemento <nav>. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function ChampionshipSelector({
  className,
}: ChampionshipSelectorProps): React.JSX.Element | null {
  const { activeChampionshipId, enabledChampionships, isMultiChampionship, setActiveChampionship } =
    useActiveChampionship();
  const { data: catalog } = useChampionshipsCatalog();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Pool com ≤ 1 campeonato → sem seletor (comportamento legado).
  if (!isMultiChampionship) return null;

  // Rótulos do catálogo (id → name pt-BR); fallback = id se catálogo ainda não
  // carregou ou o id não estiver no catálogo público.
  const labelOf = (id: string): string =>
    catalog?.find((c) => c.id === id)?.name ?? id;

  const handleKeyDown = (ev: React.KeyboardEvent, idx: number): void => {
    let delta = 0;
    if (ev.key === "ArrowRight" || ev.key === "ArrowDown") delta = 1;
    else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") delta = -1;
    else return;

    ev.preventDefault();
    const len = enabledChampionships.length;
    const nextIdx = (idx + delta + len) % len;
    const nextId = enabledChampionships[nextIdx];
    if (!nextId) return;
    setActiveChampionship(nextId);
    buttonRefs.current[nextIdx]?.focus();
  };

  return (
    <nav aria-label="Campeonato ativo" className={cn(className)}>
      <div
        role="radiogroup"
        aria-label="Campeonato ativo"
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
      >
        {enabledChampionships.map((id, idx) => {
          const active = id === activeChampionshipId;
          return (
            <button
              key={id}
              ref={(el) => {
                buttonRefs.current[idx] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => setActiveChampionship(id)}
              onKeyDown={(ev) => handleKeyDown(ev, idx)}
              title={labelOf(id)}
              className={cn(CHIP_BASE, active ? CHIP_ACTIVE : CHIP_INACTIVE)}
            >
              <span className="max-w-[10rem] truncate">{labelOf(id)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
