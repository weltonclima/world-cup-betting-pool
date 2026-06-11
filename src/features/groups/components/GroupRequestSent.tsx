"use client";

import type { JSX } from "react";
import Link from "next/link";
import { CheckCircle2, MailCheck } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Confirmação pós-criação de grupo (PRD-09, TASK-08 — tela PRD09-02).
 *
 * O grupo nasce `pending` e aguarda aprovação do Super Admin (global). CTA único
 * "Ir para meus grupos" (singular ajustado, decisão A7) → leva à busca/lista.
 * Convite de amigos (A9) está fora de escopo; o card só informa.
 */
export function GroupRequestSent(): JSX.Element {
  return (
    <section
      aria-labelledby="request-sent-title"
      className="flex flex-col items-center gap-6 px-2 py-6 text-center"
    >
      <span
        aria-hidden="true"
        className="relative flex size-24 items-center justify-center rounded-full bg-primary/10"
      >
        <MailCheck size={44} className="text-primary" />
        <CheckCircle2
          size={28}
          className="absolute right-1 bottom-1 rounded-full bg-background text-primary"
        />
      </span>

      <div className="flex flex-col gap-2">
        <h1 id="request-sent-title" className="text-xl font-bold text-foreground">
          Solicitação enviada!
        </h1>
        <p className="text-sm text-muted-foreground">
          Seu grupo foi criado com sucesso e está aguardando aprovação do
          administrador global.
        </p>
      </div>

      <div className="w-full rounded-xl border border-border bg-muted/40 p-4 text-left">
        <p className="mb-3 text-sm font-semibold text-primary">
          O que acontece agora?
        </p>
        <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>O Super Admin irá analisar sua solicitação.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>Você será notificado quando o grupo for aprovado.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>
              Enquanto isso, você pode convidar amigos para participar.
            </span>
          </li>
        </ul>
      </div>

      <Link
        href="/grupos"
        className={cn(buttonVariants({ variant: "default" }), "h-12 w-full")}
      >
        Ir para meus grupos
      </Link>
    </section>
  );
}
