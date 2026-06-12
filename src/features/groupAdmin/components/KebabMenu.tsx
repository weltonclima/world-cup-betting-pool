"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface KebabAction {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
}

/**
 * Menu kebab (⋮) acessível e leve (sem dependência de dropdown externo, ausente
 * no registry). Abre por clique; fecha por Esc, clique fora ou seleção. Itens são
 * `<button role="menuitem">`. Usado na lista de aprovados (PRD10-03).
 *
 * Acessibilidade (WAI-ARIA menu button): ao abrir move o foco para o primeiro
 * item habilitado; ↑/↓ navegam (roving) entre os habilitados, Home/End vão ao
 * primeiro/último; Esc/Tab fecham; ao fechar o foco RETORNA ao gatilho.
 */
export function KebabMenu({
  label,
  actions,
}: {
  label: string;
  actions: KebabAction[];
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Distingue fechar-por-foco-de-volta (Esc/seleção/Tab) de fechar-por-clique-fora,
  // onde devolver o foco ao gatilho seria intrusivo.
  const returnFocusRef = useRef(false);

  const enabledIndexes = actions
    .map((a, i) => (a.disabled ? -1 : i))
    .filter((i) => i >= 0);

  const close = useCallback((returnFocus: boolean) => {
    returnFocusRef.current = returnFocus;
    setOpen(false);
  }, []);

  const focusItem = useCallback((index: number) => {
    itemRefs.current[index]?.focus();
  }, []);

  // Foco ao abrir → primeiro item habilitado. Ao fechar via teclado/seleção,
  // devolve ao gatilho (returnFocusRef).
  useEffect(() => {
    if (open) {
      const first = enabledIndexes[0];
      if (first !== undefined) focusItem(first);
    } else if (returnFocusRef.current) {
      returnFocusRef.current = false;
      triggerRef.current?.focus();
    }
    // enabledIndexes recomputado a cada render; depender de `open` basta para o
    // efeito de abertura/fechamento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, focusItem]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent): void {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [open, close]);

  function onMenuKeyDown(e: ReactKeyboardEvent<HTMLDivElement>): void {
    if (enabledIndexes.length === 0) {
      if (e.key === "Escape" || e.key === "Tab") close(true);
      return;
    }
    const active = document.activeElement;
    const currentPos = itemRefs.current.findIndex((el) => el === active);
    const currentEnabledPos = enabledIndexes.indexOf(currentPos);

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const next =
          enabledIndexes[(currentEnabledPos + 1) % enabledIndexes.length]!;
        focusItem(next);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev =
          enabledIndexes[
            (currentEnabledPos - 1 + enabledIndexes.length) %
              enabledIndexes.length
          ]!;
        focusItem(prev);
        break;
      }
      case "Home": {
        e.preventDefault();
        focusItem(enabledIndexes[0]!);
        break;
      }
      case "End": {
        e.preventDefault();
        focusItem(enabledIndexes[enabledIndexes.length - 1]!);
        break;
      }
      case "Escape": {
        e.preventDefault();
        close(true);
        break;
      }
      case "Tab": {
        // Tab sai do menu: fecha sem prender o foco (deixa o fluxo natural seguir).
        close(false);
        break;
      }
      default:
        break;
    }
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          returnFocusRef.current = false;
          setOpen((v) => !v);
        }}
        className="size-11"
      >
        <MoreVertical size={18} aria-hidden="true" />
      </Button>
      {open ? (
        <div
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className="absolute top-full right-0 z-20 mt-1 flex min-w-44 flex-col rounded-lg border border-border bg-card p-1 shadow-md"
        >
          {actions.map((action, index) => (
            <button
              key={action.label}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={action.disabled}
              onClick={() => {
                close(true);
                action.onSelect();
              }}
              className={`flex min-h-[44px] items-center gap-2 rounded-md px-3 text-left text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ${
                action.destructive ? "text-destructive" : "text-foreground"
              }`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
