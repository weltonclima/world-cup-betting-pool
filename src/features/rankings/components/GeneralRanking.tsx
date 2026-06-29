"use client";

import { useState } from "react";
import Link from "next/link";
import { Crown } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePoolRanking, usePoolRankingByScope } from "@/features/rankings";
import { paginate } from "@/features/rankings/lib";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
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

/** Decomposição dos acertos (default 0 p/ entries gravadas antes do campo). */
function hitCounts(entry: RankingEntry): { a: number; v: number; e: number } {
  return {
    a: entry.correct ?? 0, // placares exatos (10)
    v: entry.winner ?? 0, // acertou vencedor sem placar (5)
    e: entry.draw ?? 0, // acertou empate sem placar (5)
  };
}

/** Frase a11y da decomposição (lida por leitor de tela no lugar de "A.. V.. E.."). */
function hitLabel(entry: RankingEntry): string {
  const { a, v, e } = hitCounts(entry);
  return `${a} placares exatos, ${v} acertos de vencedor, ${e} acertos de empate`;
}

/**
 * Mostra a decomposição dos acertos como "A{n} V{n} E{n}" (1ª letra + valor) no
 * lugar do aproveitamento. Letra em destaque; cor herdada via `className` (p/
 * contraste no card primário do pódio).
 *
 * a11y: `role="img"` + aria-label dá a frase cheia ao leitor de tela. No pódio,
 * passar `decorative` (o `aria-label` do `<Link>` pai já inclui a mesma frase →
 * evita leitura dupla); na linha da lista é a única fonte, então fica anunciado.
 */
function HitBreakdown({
  entry,
  className,
  decorative = false,
}: {
  entry: RankingEntry;
  className?: string;
  decorative?: boolean;
}) {
  const { a, v, e } = hitCounts(entry);
  return (
    <span
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": hitLabel(entry) })}
      className={cn("inline-flex items-center gap-1.5 tabular-nums", className)}
    >
      <span aria-hidden="true">
        <span className="font-semibold">A</span>
        {a}
      </span>
      <span aria-hidden="true">
        <span className="font-semibold">V</span>
        {v}
      </span>
      <span aria-hidden="true">
        <span className="font-semibold">E</span>
        {e}
      </span>
    </span>
  );
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

/**
 * Estado mínimo de query consumido por `RankingView` (estruturalmente compatível
 * com `UseQueryResult<PoolRanking | Ranking | null>`). Tanto `PoolRanking` quanto
 * `Ranking` expõem `entries`, então o split-phase reusa a mesma view por escopo.
 */
interface RankingViewQuery {
  data: { entries: RankingEntry[] } | null | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
}

/**
 * Corpo reutilizável do ranking (pódio + lista paginada + estados). Cada instância
 * tem paginação própria (`useState` local) — no split-phase, Grupos e Eliminatórias
 * paginam de forma independente. Mensagem de vazio customizável por escopo.
 */
function RankingView({
  query,
  currentUid,
  emptyMessage,
  emptySubtitle,
}: {
  query: RankingViewQuery;
  currentUid: string | undefined;
  emptyMessage?: string;
  emptySubtitle?: string;
}) {
  const [page, setPage] = useState(1);

  if (query.isLoading) return <RankingSkeleton />;
  if (query.isError)
    return <RankingErrorState onRetry={() => void query.refetch()} />;
  if (!query.data || query.data.entries.length === 0)
    return <RankingEmptyState message={emptyMessage} subtitle={emptySubtitle} />;

  const entries = query.data.entries;
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

/** Tela 01 — Ranking do pool do usuário (PRD-05 TASK-08, fechado por pool PRD-09). */
export function GeneralRanking() {
  const auth = useAuth();
  const groupId = auth.profile?.groupId;
  const currentUid = auth.firebaseUser?.uid;
  const generalQuery = usePoolRanking(groupId);

  // Flag de exibição do pool (split-phase-ranking). Ausência/`false` = ramo OFF
  // (geral cumulativo, comportamento legado intocado). Só `true` ativa o split.
  const split = generalQuery.data?.splitPhaseRanking === true;

  // Hooks de escopo SEMPRE chamados (regras de hooks); `enabled` gateia o fetch —
  // no ramo OFF as 2 leituras não disparam (gating W2).
  const gruposQuery = usePoolRankingByScope("grupos", { enabled: split });
  const eliminatoriasQuery = usePoolRankingByScope("eliminatorias", {
    enabled: split,
  });

  // Usuário sem pool não pertence a ranking nenhum (e nunca aparece em outro).
  if (!groupId)
    return (
      <RankingEmptyState
        message="Você ainda não está em um grupo"
        subtitle="Entre ou crie um grupo para ver o ranking dos participantes."
      />
    );

  // O ranking geral também carrega a flag — aguardar antes de decidir o ramo.
  if (generalQuery.isLoading) return <RankingSkeleton />;
  if (generalQuery.isError)
    return <RankingErrorState onRetry={() => void generalQuery.refetch()} />;

  // Recalc reprocessa o pool inteiro (geral + escopos) — refazer todas as leituras
  // exibidas para refletir o resultado.
  const handleRecalcDone = () => {
    void generalQuery.refetch();
    if (split) {
      void gruposQuery.refetch();
      void eliminatoriasQuery.refetch();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Ação admin: reprocessa o ranking do pool (só group_admin/super_admin;
          retorna null p/ os demais — sem item flex, sem gap extra). */}
      <RecalcGroupRankingButton onDone={handleRecalcDone} />

      {split ? (
        <Tabs defaultValue="grupos">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTab value="grupos" className="min-h-11">
              Grupos
            </TabsTab>
            <TabsTab value="eliminatorias" className="min-h-11">
              Eliminatórias
            </TabsTab>
          </TabsList>

          <TabsPanel value="grupos" keepMounted>
            <RankingView query={gruposQuery} currentUid={currentUid} />
          </TabsPanel>

          <TabsPanel value="eliminatorias" keepMounted>
            <RankingView
              query={eliminatoriasQuery}
              currentUid={currentUid}
              emptyMessage="Fase eliminatória ainda não começou"
              emptySubtitle="Os pontos aparecem quando o mata-mata iniciar."
            />
          </TabsPanel>
        </Tabs>
      ) : (
        <RankingView query={generalQuery} currentUid={currentUid} />
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
              aria-label={`${entry.position}º lugar: ${name}, ${entry.points} pontos, ${hitLabel(entry)}${you ? " (você)" : ""}`}
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
              <HitBreakdown
                entry={entry}
                decorative
                className={cn(
                  "text-xs",
                  isFirst
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground",
                )}
              />
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
        <HitBreakdown
          entry={entry}
          className="shrink-0 text-xs text-muted-foreground"
        />
      </Link>
    </li>
  );
}
