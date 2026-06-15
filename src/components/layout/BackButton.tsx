"use client";

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Botão "Voltar" reutilizável para sub-telas (drill-down) que não fazem parte
 * de uma sub-navegação por abas. Volta no histórico via `router.back()`,
 * alinhado ao padrão de ProfileSubHeader/GroupSubHeader (ghost + ChevronLeft).
 *
 * Telas alcançadas por abas persistentes (CompetitionTabs, RankingSubNav) NÃO
 * usam este botão — a própria barra de abas é o caminho de volta.
 */
export function BackButton({
  label = "Voltar",
  className,
}: {
  label?: string;
  className?: string;
}): JSX.Element {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={() => router.back()}
      className={cn("size-11 shrink-0 self-start", className)}
    >
      <ChevronLeft size={22} aria-hidden="true" />
    </Button>
  );
}
