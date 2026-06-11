"use client";

/**
 * GroupSelector — seletor de grupo em chips horizontais roláveis (TASK-07).
 *
 * Renderiza um chip <button> por id de grupo.
 * Chip ativo: bg-primary text-primary-foreground, aria-pressed=true.
 * Chip inativo: bg-muted text-muted-foreground, aria-pressed=false.
 * Touch target ≥44px (h-11 mobile, sm:h-9).
 * Navegável por teclado com focus-visible ring.
 */

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface GroupSelectorProps {
  /** Lista de ids de grupos na ordem recebida da API (ex.: ["A","B","C"…]). */
  groups: string[];
  /** Id do grupo atualmente selecionado. */
  value: string;
  /** Callback invocado com o id do grupo clicado. */
  onChange: (groupId: string) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Classes de chip
// ---------------------------------------------------------------------------

/** Classes base comuns a todos os chips. */
const CHIP_BASE =
  "flex-none rounded-full h-11 sm:h-9 px-3 " +
  "inline-flex items-center justify-center text-xs sm:text-sm whitespace-nowrap " +
  "transition-colors duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** Classes adicionais para o chip ativo. */
const CHIP_ACTIVE = "bg-primary text-primary-foreground font-medium shadow-sm";

/** Classes adicionais para chips inativos. */
const CHIP_INACTIVE =
  "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground " +
  "active:scale-[0.98] motion-reduce:transform-none";

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Chips horizontais roláveis para seleção de grupo.
 * Scroll-x interno sem afetar o layout da página.
 */
export function GroupSelector({ groups, value, onChange, className }: GroupSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Seleção de grupo"
      className={cn("flex gap-2 overflow-x-auto pb-1 scrollbar-thin", className)}
    >
      {groups.map((groupId) => {
        const isActive = groupId === value;
        return (
          <button
            key={groupId}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(groupId)}
            className={cn(CHIP_BASE, isActive ? CHIP_ACTIVE : CHIP_INACTIVE)}
          >
            Grupo {groupId}
          </button>
        );
      })}
    </div>
  );
}
