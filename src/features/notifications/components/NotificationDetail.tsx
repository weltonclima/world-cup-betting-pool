"use client";

import { type JSX } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check } from "lucide-react";

import {
  RankingErrorState,
  RankingSkeleton,
} from "@/features/rankings/components";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { useNotification, useMarkAsRead } from "../hooks";
import {
  NOTIFICATION_META,
  actionFor,
  fullDateTime,
} from "../lib/notificationMeta";

/**
 * Tela 02 — Detalhe da Notificação (PRD08-02).
 *
 * NOTA: o mock mostra ícone de lixeira (excluir) e um bloco "Sua posição #8→#4".
 * Ambos foram OMITIDOS no V1: (1) as Firestore Rules negam `delete` em
 * `notifications` (D-A1 — append-only por dono); (2) o bloco de posição é dado
 * rico específico de ranking que o modelo (`title`/`message`) não armazena.
 */
export function NotificationDetail({ id }: { id: string }): JSX.Element {
  const router = useRouter();
  const query = useNotification(id);
  const markAsRead = useMarkAsRead();

  return (
    <div className="flex flex-col gap-4">
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
        <h1 className="text-lg font-semibold text-foreground">Notificação</h1>
      </header>

      {query.isLoading ? (
        <RankingSkeleton rows={3} />
      ) : query.isError ? (
        <RankingErrorState
          message="Erro ao carregar a notificação"
          onRetry={() => void query.refetch()}
        />
      ) : !query.data ? (
        <p className="px-4 py-12 text-center text-sm text-muted-foreground">
          Notificação não encontrada.
        </p>
      ) : (
        (() => {
          const n = query.data;
          const meta = NOTIFICATION_META[n.type];
          const Icon = meta.icon;
          const action = actionFor(n.type);
          return (
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon size={36} aria-hidden="true" />
              </span>
              <Badge className="bg-primary text-primary-foreground">
                {meta.label}
              </Badge>

              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-semibold text-foreground">
                  {n.title}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {fullDateTime(n.createdAt)}
                </p>
              </div>

              <p className="w-full rounded-lg border border-border bg-card p-4 text-left text-sm text-foreground">
                {n.message}
              </p>

              <div className="flex w-full flex-col gap-3">
                {action ? (
                  <Link
                    href={action.href}
                    className={cn(buttonVariants(), "h-12 w-full")}
                  >
                    {action.label}
                  </Link>
                ) : null}
                {!n.isRead ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full gap-2"
                    disabled={markAsRead.isPending}
                    onClick={() => markAsRead.mutate(n.id)}
                  >
                    <Check size={18} aria-hidden="true" />
                    Marcar como lida
                  </Button>
                ) : null}
              </div>

              <p className="text-xs text-muted-foreground">ID: {n.id}</p>
            </div>
          );
        })()
      )}
    </div>
  );
}
