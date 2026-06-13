"use client";

import { useState } from "react";
import Link from "next/link";
import { Crown } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePoolRanking } from "@/features/rankings";
import { paginate } from "@/features/rankings/lib";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RankingEntry } from "@/types";

import { RankingSkeleton } from "./RankingSkeleton";
import { RankingEmptyState } from "./RankingEmptyState";
import { RankingErrorState } from "./RankingErrorState";
import { RecalcGroupRankingButton } from "./RecalcGroupRankingButton";

const PAGE_SIZE = 20;

/** Iniciais p/ fallback de avatar (quando sem foto ou imagem quebrada). */
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

/** Conectores de sobrenome ignorados na abreviação (preposições/artigos PT-BR). */
const SURNAME_CONNECTORS = new Set(["da", "de", "do", "das", "dos", "e"]);

/**
 * Nome de exibição compacto: primeiro nome por extenso + iniciais ("X.") das
 * palavras restantes do sobrenome, ignorando conectores ("da", "de", ...).
 * Ex.: "Maria Eduarda Santos" → "Maria E. S."; "Welton da Silva Lima" →
 * "Welton S. L.". Nome único (sem sobrenome) fica inalterado. O `aria-label`
 * mantém o nome completo — a abreviação é só visual.
 */
function displayName(entry: RankingEntry): string {
  const base = (entry.name ?? entry.nickname).trim();
  const [first = base, ...rest] = base.split(/\s+/);
  const surnameInitials = rest
    .filter((w) => !SURNAME_CONNECTORS.has(w.toLowerCase()))
    .map((w) => `${w.charAt(0).toUpperCase()}.`)
    .join(" ");
  return surnameInitials ? `${first} ${surnameInitials}` : first;
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
      {/* Ação admin: reprocessa o ranking do pool (só group_admin/super_admin;
          retorna null p/ os demais — sem item flex, sem gap extra). */}
      <RecalcGroupRankingButton onDone={() => void refetch()} />

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
// Medalha por slot do pódio (0=ouro,1=prata,2=bronze). Ouro/prata/bronze não
// existem no tema → cores diretas (convenção universal de pódio). O número textual
// ("1º") garante a11y independente de cor (color-not-only).
const MEDAL_CLASS = [
  "bg-amber-400 text-amber-950", // 1º
  "bg-zinc-300 text-zinc-800", // 2º
  "bg-orange-300 text-orange-900", // 3º
] as const;

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
    <ul className="flex items-end justify-center gap-2 sm:gap-3">
      {top3.map((entry, i) => {
        const isFirst = i === 0;
        const you = entry.uid === currentUid;
        const name = entry.name ?? entry.nickname;
        return (
          <li key={entry.uid} className={cn("min-w-0 flex-1", visualOrder[i])}>
            <Link
              href={`/rankings/profile/${entry.uid}`}
              aria-label={`${entry.position}º lugar: ${name}, ${entry.points} pontos, ${accuracyLabel(entry)} de aproveitamento${you ? " (você)" : ""}`}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 text-center sm:gap-2 sm:p-3",
                "transition-colors transition-transform duration-200 ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "motion-safe:active:scale-[0.98]",
                isFirst
                  ? "border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                  : "border-border bg-card hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {/* Indicador de posição: medalha + número (visível nos 3). */}
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                  MEDAL_CLASS[i],
                )}
              >
                {isFirst && <Crown size={12} className="shrink-0" />}
                {entry.position}º
              </span>
              <Avatar className={isFirst ? "h-14 w-14" : "h-12 w-12"}>
                <AvatarImage src={entry.avatarUrl} alt="" />
                <AvatarFallback>{initials(entry)}</AvatarFallback>
              </Avatar>
              <span className="max-w-full truncate text-xs font-medium sm:text-sm">
                {displayName(entry)}
              </span>
              <span className="text-base font-bold tabular-nums sm:text-lg">
                {entry.points} pts
              </span>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  isFirst
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground",
                )}
              >
                {accuracyLabel(entry)}
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
          <AvatarImage src={entry.avatarUrl} alt="" />
          <AvatarFallback>{initials(entry)}</AvatarFallback>
        </Avatar>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2 truncate font-medium text-foreground">
            {displayName(entry)}
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
