"use client";

import { useState, type JSX } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Settings } from "lucide-react";

import {
  RankingEmptyState,
  RankingErrorState,
  RankingSkeleton,
} from "@/features/rankings/components";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useNotifications } from "../hooks";
import {
  NotificationFilters,
  type NotificationFilter,
} from "./NotificationFilters";
import { NotificationItem } from "./NotificationItem";

/** Tela 01 — Central de Notificações (PRD08-01). */
export function NotificationList(): JSX.Element {
  const router = useRouter();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const query = useNotifications(filter === "all" ? undefined : filter);

  return (
    <div className="flex flex-col gap-4">
      {/* Header: voltar + título + preferências */}
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
        <h1 className="text-lg font-semibold text-foreground">Notificações</h1>
        <Link
          href="/notificacoes/preferencias"
          aria-label="Preferências de notificação"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "absolute right-0 size-11",
          )}
        >
          <Settings size={20} aria-hidden="true" />
        </Link>
      </header>

      <NotificationFilters value={filter} onChange={setFilter} />

      {query.isLoading ? (
        <RankingSkeleton rows={5} />
      ) : query.isError ? (
        <RankingErrorState
          message="Erro ao carregar notificações"
          onRetry={() => void query.refetch()}
        />
      ) : (query.data ?? []).length === 0 ? (
        <RankingEmptyState
          message="Nenhuma notificação encontrada"
          subtitle="Você será avisado por aqui sobre o bolão."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {(query.data ?? []).map((notification) => (
            <li key={notification.id}>
              <NotificationItem notification={notification} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
