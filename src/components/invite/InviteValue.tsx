"use client";

import { useState, type JSX } from "react";
import { Check, Copy, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Monta a URL pública do convite a partir do código (origin do browser). */
export function inviteUrl(code: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/invite/${code}`;
}

/**
 * Exibe um valor de convite (link ou código) somente-leitura com ações de
 * copiar (estado transitório `copied`) e compartilhar (Web Share API com
 * fallback para copiar). Reutilizável por group_admin e super_admin.
 */
export function InviteValue({
  title,
  description,
  value,
  shareLabel,
  empty,
  emptyMessage = "Nenhum convite ativo. Gere um novo link abaixo.",
}: {
  title: string;
  description: string;
  value: string;
  shareLabel: string;
  empty: boolean;
  /** Texto do estado vazio. Default assume um gerador logo abaixo. */
  emptyMessage?: string;
}): JSX.Element {
  const [copied, setCopied] = useState(false);

  async function onCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível — silencioso (o valor está visível para cópia manual).
    }
  }

  async function onShare(): Promise<void> {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ text: value });
        return;
      } catch {
        // cancelado/indisponível — cai no copiar.
      }
    }
    await onCopy();
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {empty ? (
        <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-border p-1 pl-3">
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
              {value}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Copiar"
              onClick={() => void onCopy()}
              className="size-11 shrink-0"
            >
              {copied ? (
                <Check size={18} className="text-emerald-600" aria-hidden="true" />
              ) : (
                <Copy size={18} aria-hidden="true" />
              )}
            </Button>
          </div>
          <Button
            type="button"
            onClick={() => void onShare()}
            className="h-11 w-full gap-2"
          >
            <Share2 size={18} aria-hidden="true" />
            {shareLabel}
          </Button>
        </>
      )}
    </section>
  );
}
