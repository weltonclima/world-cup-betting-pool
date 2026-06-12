"use client";

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Cabeçalho das telas de Grupos (PRD09-01/03/05): botão voltar + título à esquerda
 * e subtítulo opcional, espelhando o layout dos PNGs (título alinhado ao conteúdo,
 * não centralizado). Voltar usa `router.back()`.
 */
export function GroupSubHeader({
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
      <div className="flex flex-col">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {subtitle ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </header>
  );
}
