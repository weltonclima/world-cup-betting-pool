"use client";

import { useState } from "react";
import Link from "next/link";
import { Crown } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePoolRanking } from "@/features/rankings";
import { paginate } from "@/features/rankings/lib";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RankingEntry } from "@/types";

import { RankingSkeleton } from "./RankingSkeleton";
import { RankingEmptyState } from "./RankingEmptyState";
import { RankingErrorState } from "./RankingErrorState";

const PAGE_SIZE = 20;

/** Iniciais p/ fallback de avatar (sem foto no schema). */
function initials(entry: RankingEntry): string {
  const base = entry.name ?? entry.nickname;
  return base
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

function accuracyLabel(entry: RankingEntry): string {
  return entry.accuracy === undefined ? "—" : `${entry.accuracy}%`;
}

/** Tela 01 — Ranking do pool do usuário (PRD-05 TASK-08, fechado por pool PRD-09). */
export function GeneralRanking() {
  const auth = useAuth();
  const groupId = auth.profile?.groupId;
  const currentUid = auth.firebaseUser?.uid;
  const { data, isLoading, isError, refetch } = usePoolRanking(groupId);
  const [page, setPage] = useState(1);

  // Usuário sem pool não pertence a ranking nenhum (e nunca aparece em outro).
  if (!groupId)
    return (
      <RankingEmptyState
        message="Você ainda não está em um grupo"
        subtitle="Entre ou crie um grupo para ver o ranking dos participantes."
      />
    );
  if (isLoading) return <RankingSkeleton />;
  if (isError) return <RankingErrorState onRetry={() => void refetch()} />;
  if (!data || data.entries.length === 0) return <RankingEmptyState />;

  const entries = data.entries;
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  const { items, page: current, totalPages } = paginate(rest, page, PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <RankingPodium top3={podium} currentUid={currentUid} />

      <ol className="flex flex-col gap-2">
        {items.map((entry) => (
          <RankingRow
            key={entry.uid}
            entry={entry}
            isCurrentUser={entry.uid === currentUid}
          />
        ))}
      </ol>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => setPage(current - 1)}
            disabled={current <= 1}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            Página {current} de {totalPages}
          </span>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => setPage(current + 1)}
            disabled={current >= totalPages}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Pódio ─────────────────────────
function RankingPodium({
  top3,
  currentUid,
}: {
  top3: RankingEntry[];
  currentUid: string | undefined;
}) {
  // DOM em ordem de ranking (1º,2º,3º) p/ leitura; ordem visual 2-1-3 via `order`.
  const visualOrder = ["order-2", "order-1", "order-3"]; // índice 0=1º,1=2º,2=3º
  return (
    <ul className="flex items-end justify-center gap-3">
      {top3.map((entry, i) => {
        const isFirst = i === 0;
        const you = entry.uid === currentUid;
        return (
          <li key={entry.uid} className={cn("flex-1", visualOrder[i])}>
            <Link
              href={`/rankings/profile/${entry.uid}`}
              aria-label={`${entry.position}º lugar: ${entry.name ?? entry.nickname}, ${entry.points} pontos${you ? " (você)" : ""}`}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isFirst
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-accent",
              )}
            >
              {isFirst && (
                <Crown size={20} aria-hidden="true" className="shrink-0" />
              )}
              <Avatar className={isFirst ? "h-14 w-14" : "h-12 w-12"}>
                <AvatarFallback>{initials(entry)}</AvatarFallback>
              </Avatar>
              <span className="max-w-full truncate text-sm font-medium">
                {entry.name ?? entry.nickname}
              </span>
              <span className="text-lg font-bold tabular-nums">
                {entry.points} pts
              </span>
              {you && (
                <Badge className="bg-primary text-primary-foreground">
                  Você
                </Badge>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// ───────────────────────── Linha da lista ─────────────────────────
function RankingRow({
  entry,
  isCurrentUser,
}: {
  entry: RankingEntry;
  isCurrentUser: boolean;
}) {
  return (
    <li>
      <Link
        href={`/rankings/profile/${entry.uid}`}
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-lg border border-border p-3 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isCurrentUser ? "bg-primary/10" : "bg-card hover:bg-accent",
        )}
      >
        <span className="w-8 shrink-0 text-center text-muted-foreground tabular-nums">
          {entry.position}
        </span>
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback>{initials(entry)}</AvatarFallback>
        </Avatar>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2 truncate font-medium text-foreground">
            {entry.name ?? entry.nickname}
            {isCurrentUser && (
              <Badge className="bg-primary text-primary-foreground">Você</Badge>
            )}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {entry.nickname}
          </span>
        </span>
        <span className="shrink-0 text-right font-bold tabular-nums">
          {entry.points}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            pts
          </span>
        </span>
        <span className="w-12 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
          {accuracyLabel(entry)}
        </span>
      </Link>
    </li>
  );
}
