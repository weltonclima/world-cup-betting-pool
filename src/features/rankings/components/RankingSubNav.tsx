"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Itens fixos da navegação da seção Ranking (PRD-05, TASK-07). */
const ITEMS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/rankings", label: "Geral" },
  { href: "/rankings/fase", label: "Fases" },
  { href: "/rankings/eu", label: "Meu Ranking" },
  { href: "/rankings/estatisticas", label: "Estatísticas" },
];

/**
 * Sub-navegação (segmented) entre as telas de ranking. Rota ativa destacada por
 * cor + peso + borda inferior (cor não é o único indicador). Sticky abaixo do header.
 */
export function RankingSubNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação de ranking"
      className="sticky top-14 z-40 -mx-4 overflow-x-auto border-b border-border bg-background/95 px-4 backdrop-blur-sm"
    >
      <ul className="flex min-w-max gap-1">
        {ITEMS.map((item) => {
          const active =
            item.href === "/rankings"
              ? pathname === "/rankings"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center border-b-2 px-4 text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  active
                    ? "border-primary font-semibold text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
