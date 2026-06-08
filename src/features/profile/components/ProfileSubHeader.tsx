"use client";

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Cabeçalho das sub-telas de Perfil (PRD06-02..06): botão voltar + título
 * centralizado. Voltar usa `router.back()` (histórico) com fallback para o hub.
 */
export function ProfileSubHeader({ title }: { title: string }): JSX.Element {
  const router = useRouter();

  return (
    <header className="relative flex h-12 items-center justify-center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Voltar"
        onClick={() => router.back()}
        className="absolute left-0 size-11"
      >
        <ChevronLeft size={22} aria-hidden="true" />
      </Button>
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
    </header>
  );
}
