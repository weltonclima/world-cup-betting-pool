"use client";

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Cabeçalho das telas administrativas (PRD-07): voltar + título centralizado. */
export function AdminSubHeader({ title }: { title: string }): JSX.Element {
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
