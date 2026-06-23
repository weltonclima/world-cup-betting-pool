"use client";

import { useState, type JSX } from "react";
import Link from "next/link";
import { Crown, Medal, Network, Trophy, Users, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePoolRankingByScope, useGroupRanking } from "@/features/rankings";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import type { RankingEntry, RankingScope } from "@/types";

import { RankingSkeleton } from "./RankingSkeleton";
import { RankingEmptyState } from "./RankingEmptyState";
import { RankingErrorState } from "./RankingErrorState";

const PLACEHOLDER = "—";

/** Card de fase/agregado da aba "Por Fase". `featured` = card agregado em destaque. */
interface StageCardConfig {
  scope: Exclude<RankingScope, "geral">;
  label: string;
  Icon: LucideIcon;
  featured?: boolean;
}

/** Bloco "Fase de Grupos": apenas o card de grupos (seletor A–L vive na aba "Por Grupo"). */
const GROUP_STAGE_CARDS: ReadonlyArray<StageCardConfig> = [
  { scope: "grupos", label: "Fase de Grupos", Icon: Users },
];

/**
 * Bloco "Eliminatórias": card AGREGADO em destaque (soma todas as fases mata-mata,
 * incl. dezesseis-avos — D2) + cards de fase. SEM card de dezesseis-avos (não tem
 * scope de fase próprio; seus pontos entram só no agregado).
 */
const ELIMINATION_STAGE_CARDS: ReadonlyArray<StageCardConfig> = [
  { scope: "eliminatorias", label: "Eliminatórias", Icon: Crown, featured: true },
  { scope: "oitavas", label: "Oitavas de Final", Icon: Network },
  { scope: "quartas", label: "Quartas de Final", Icon: Trophy },
  { scope: "semifinal", label: "Semifinal", Icon: Medal },
  { scope: "final", label: "Final", Icon: Trophy },
];

/** Grupos da Copa 2026 (12 grupos, A–L) — constante dedicada (sem hardcode espalhado). */
const GROUP_IDS: readonly string[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

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
  return entry.accuracy === undefined ? PLACEHOLDER : `${entry.accuracy}%`;
}

/** Tela 03 — Ranking por Fase + Por Grupo (PRD-05, TASK-09). */
export function PhaseRanking(): JSX.Element {
  return (
    <Tabs defaultValue="fase">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTab value="fase" className="min-h-11">
          Por Fase
        </TabsTab>
        <TabsTab value="grupo" className="min-h-11">
          Por Grupo
        </TabsTab>
      </TabsList>

      <TabsPanel value="fase" keepMounted>
        <StageRankingCards />
      </TabsPanel>

      <TabsPanel value="grupo" keepMounted>
        <GroupRankingView />
      </TabsPanel>
    </Tabs>
  );
}

// ───────────────────────── Por Fase ─────────────────────────

/** Heading discreto de bloco (separador semântico entre Grupos e Eliminatórias). */
function BlockHeading({ id, children }: { id: string; children: string }): JSX.Element {
  return (
    <h2 id={id} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

function StageCardList({ cards }: { cards: ReadonlyArray<StageCardConfig> }): JSX.Element {
  return (
    <ul className="flex flex-col gap-3">
      {cards.map(({ scope, label, Icon, featured }) => (
        <StageRankingCard key={scope} scope={scope} label={label} Icon={Icon} featured={featured} />
      ))}
    </ul>
  );
}

function StageRankingCards(): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="block-grupos" className="flex flex-col gap-3">
        <BlockHeading id="block-grupos">Fase de Grupos</BlockHeading>
        <StageCardList cards={GROUP_STAGE_CARDS} />
      </section>

      <section aria-labelledby="block-eliminatorias" className="flex flex-col gap-3">
        <BlockHeading id="block-eliminatorias">Eliminatórias</BlockHeading>
        <StageCardList cards={ELIMINATION_STAGE_CARDS} />
      </section>
    </div>
  );
}

function MetricColumn({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-bold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function StageRankingCard({
  scope,
  label,
  Icon,
  featured = false,
}: {
  scope: Exclude<RankingScope, "geral">;
  label: string;
  Icon: LucideIcon;
  featured?: boolean;
}): JSX.Element {
  const { data, isLoading, isError, refetch } = usePoolRankingByScope(scope);
  const currentUid = useAuth().firebaseUser?.uid;

  const entry = data?.entries.find((e) => e.uid === currentUid);

  return (
    <li
      className={cn(
        "rounded-lg border p-4 shadow-sm",
        featured
          ? "border-primary/40 bg-primary/5 ring-1 ring-primary/15"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary",
            featured ? "bg-primary/15" : "bg-primary/10",
          )}
        >
          <Icon size={24} aria-hidden="true" />
        </span>
        <h3 className="text-base font-medium text-foreground">{label}</h3>
      </div>

      {featured && (
        <p className="mt-1 text-xs text-muted-foreground">Soma de todas as fases mata-mata</p>
      )}

      <div className="mt-4">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-8 w-12 animate-pulse rounded bg-muted motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-destructive">Erro ao carregar esta fase</p>
            <Button variant="outline" className="min-h-11" onClick={() => void refetch()}>
              Tentar Novamente
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            <MetricColumn label="Posição" value={entry ? `#${entry.position}` : PLACEHOLDER} />
            <MetricColumn label="Acertos" value={entry ? String(entry.points) : PLACEHOLDER} />
            <MetricColumn
              label="Aproveitamento"
              value={entry ? accuracyLabel(entry) : PLACEHOLDER}
            />
          </div>
        )}
      </div>
    </li>
  );
}

// ───────────────────────── Por Grupo ─────────────────────────

function GroupSelector({
  groups,
  value,
  onChange,
}: {
  groups: readonly string[];
  value: string;
  onChange: (groupId: string) => void;
}): JSX.Element {
  return (
    <div role="group" aria-label="Selecionar grupo" className="flex gap-2 overflow-x-auto pb-1">
      {groups.map((groupId) => {
        const selected = groupId === value;
        return (
          <button
            key={groupId}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(groupId)}
            className={cn(
              "min-h-11 shrink-0 rounded-full px-4 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "bg-primary font-semibold text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {groupId}
          </button>
        );
      })}
    </div>
  );
}

function GroupRankingView(): JSX.Element {
  const [group, setGroup] = useState<string>(GROUP_IDS[0] ?? "A");
  const { data, isLoading, isError, refetch } = useGroupRanking(group);
  const currentUid = useAuth().firebaseUser?.uid;

  return (
    <div className="flex flex-col gap-4">
      <GroupSelector groups={GROUP_IDS} value={group} onChange={setGroup} />

      {isLoading ? (
        <RankingSkeleton />
      ) : isError ? (
        <RankingErrorState onRetry={() => void refetch()} />
      ) : !data || data.entries.length === 0 ? (
        <RankingEmptyState message="Nenhum dado para este grupo" />
      ) : (
        <ol className="flex flex-col gap-2">
          {data.entries.map((entry) => (
            <RankingRow key={entry.uid} entry={entry} isCurrentUser={entry.uid === currentUid} />
          ))}
        </ol>
      )}
    </div>
  );
}

// ───────────────────────── Linha da lista (local) ─────────────────────────

function RankingRow({
  entry,
  isCurrentUser,
}: {
  entry: RankingEntry;
  isCurrentUser: boolean;
}): JSX.Element {
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
            {entry.name ?? entry.nickname}
            {isCurrentUser && <Badge className="bg-primary text-primary-foreground">Você</Badge>}
          </span>
          <span className="truncate text-xs text-muted-foreground">{entry.nickname}</span>
        </span>
        <span className="shrink-0 text-right font-bold tabular-nums">
          {entry.points}
          <span className="ml-1 text-xs font-normal text-muted-foreground">pts</span>
        </span>
        <span className="w-12 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
          {accuracyLabel(entry)}
        </span>
      </Link>
    </li>
  );
}
