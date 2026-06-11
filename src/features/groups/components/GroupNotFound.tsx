"use client";

import type { JSX } from "react";
import Link from "next/link";
import { CheckCircle2, Search, SearchX, UserPlus } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Estado vazio da busca de grupos (PRD-09, TASK-09 — tela PRD09-04).
 *
 * Exibido quando a busca não retorna grupos ativos. Ações: "Tentar novamente"
 * (re-executa a busca) e "Criar novo grupo" (→ TASK-08). `role="status"` anuncia
 * o estado a leitores de tela.
 */
export function GroupNotFound({ onRetry }: { onRetry: () => void }): JSX.Element {
  return (
    <section
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-6 px-2 py-6 text-center"
    >
      <span
        aria-hidden="true"
        className="flex size-28 items-center justify-center rounded-full bg-muted"
      >
        <SearchX size={48} className="text-muted-foreground" />
      </span>

      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-foreground">
          Grupo não encontrado
        </h2>
        <p className="text-sm text-muted-foreground">
          Não conseguimos encontrar um grupo com as informações informadas.
        </p>
      </div>

      <div className="w-full rounded-xl border border-border bg-muted/40 p-4 text-left">
        <p className="mb-3 text-sm font-semibold text-primary">
          O que você pode fazer?
        </p>
        <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>Verifique se o nome ou o slug está correto.</span>
          </li>
          <li className="flex items-start gap-2">
            <Search
              size={18}
              className="mt-0.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>Tente buscar novamente.</span>
          </li>
          <li className="flex items-start gap-2">
            <UserPlus
              size={18}
              className="mt-0.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>Se você é o administrador, crie o grupo agora mesmo.</span>
          </li>
        </ul>
      </div>

      <div className="flex w-full flex-col gap-3">
        <Button type="button" onClick={onRetry} className="h-12 w-full">
          Tentar novamente
        </Button>
        <Link
          href="/grupos/criar"
          className={cn(
            buttonVariants({ variant: "link" }),
            "h-11 w-full text-primary",
          )}
        >
          Criar novo grupo
        </Link>
      </div>
    </section>
  );
}
