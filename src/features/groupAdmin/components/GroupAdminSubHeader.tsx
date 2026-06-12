"use client";

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Cabeçalho das telas de Administração de Grupo (PRD10-01..06): botão voltar +
 * título à esquerda (espelha `GroupSubHeader` da PRD-09 — título alinhado ao
 * conteúdo, não centralizado). Voltar usa `router.back()`.
 */
export function GroupAdminSubHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}): JSX.Element {
  const router = useRouter();

  return (
    <header className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Voltar"
        onClick={() => router.back()}
        className="size-11 shrink-0"
      >
        <ChevronLeft size={22} aria-hidden="true" />
      </Button>
      <div className="flex min-w-0 flex-col">
        <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
        {subtitle ? (
          <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </header>
  );
}
