"use client";

import type { JSX } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

/**
 * Busca padrão das telas de moderação (PRD10-02/03/04): campo com ícone de lupa.
 * O funil decorativo da PNG foi removido — não havia painel de filtro por trás, e
 * um botão focável sem ação é falsa affordance (UI-review #2). A busca textual
 * cobre o caso de uso atual; reintroduzir quando houver painel real.
 */
export function GroupSearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}): JSX.Element {
  return (
    <div className="relative">
      <Search
        size={18}
        className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 pl-10"
      />
    </div>
  );
}
