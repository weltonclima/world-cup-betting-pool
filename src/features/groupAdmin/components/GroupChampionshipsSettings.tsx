"use client";

import { useEffect, useMemo, useState, type JSX } from "react";
import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MAX_ENABLED_CHAMPIONSHIPS } from "@/schemas/pools";
import {
  getEnabledChampionships,
  getRankingMode,
  validateEnabledChampionships,
} from "@/lib/poolChampionships";
import {
  useChampionshipsCatalog,
  useGroupSettings,
  useUpdateGroupSettings,
} from "@/features/groupAdmin/hooks";
import type { ChampionshipPublic, ChampionshipType } from "@/types/championships";
import type { Pool, RankingMode } from "@/types/pools";

import { ErrorState } from "./GroupPendingUsers";

const RANKING_MODES: ReadonlyArray<{
  value: RankingMode;
  label: string;
  helper: string;
}> = [
  {
    value: "geral",
    label: "Geral",
    helper: "Um único ranking somando todos os campeonatos.",
  },
  {
    value: "por-campeonato",
    label: "Por campeonato",
    helper: "Um ranking separado para cada campeonato habilitado.",
  },
];

// Grupos de exibição por tipo (ordem do catálogo preservada dentro de cada um).
const TYPE_GROUPS: ReadonlyArray<{ type: ChampionshipType; label: string }> = [
  { type: "cup", label: "Copas e torneios" },
  { type: "league", label: "Ligas nacionais" },
];

const TYPE_BADGE: Record<ChampionshipType, string> = {
  cup: "Copa",
  league: "Liga",
};

/**
 * Seção "Campeonatos" (multi-championship TASK-08). Habilita/desabilita
 * campeonatos do catálogo para o pool e alterna o modo de ranking. Consome e
 * persiste via as configurações do grupo (TASK-07); defaults e validação de
 * domínio vêm de `@/lib/poolChampionships` (mesma regra do servidor — sem drift).
 */
export function GroupChampionshipsSettings(): JSX.Element {
  const { data: pool, isLoading, isError, refetch } = useGroupSettings();

  return (
    <section aria-labelledby="champ-section-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2
          id="champ-section-title"
          className="text-lg font-semibold text-foreground"
        >
          Campeonatos
        </h2>
        <p className="text-sm text-muted-foreground">
          Escolha quais campeonatos valem para o grupo e como o ranking é
          calculado.
        </p>
      </div>
      {isError && !isLoading ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading || !pool ? (
        <SectionSkeleton />
      ) : (
        <ChampionshipsFields pool={pool} />
      )}
    </section>
  );
}

function ChampionshipsFields({ pool }: { pool: Pool }): JSX.Element {
  const catalog = useChampionshipsCatalog();
  const update = useUpdateGroupSettings();

  const initialEnabled = useMemo(() => getEnabledChampionships(pool), [pool]);
  const initialMode = getRankingMode(pool);

  const [enabled, setEnabled] = useState<Set<string>>(
    () => new Set(initialEnabled),
  );
  const [mode, setMode] = useState<RankingMode>(initialMode);
  const [saved, setSaved] = useState(false);

  // Ressincroniza quando o pool muda por fora (refetch/invalidate pós-save).
  useEffect(() => {
    setEnabled(new Set(getEnabledChampionships(pool)));
    setMode(getRankingMode(pool));
  }, [pool]);

  const initialEnabledSet = useMemo(
    () => new Set(initialEnabled),
    [initialEnabled],
  );

  const enabledDirty =
    enabled.size !== initialEnabledSet.size ||
    [...enabled].some((id) => !initialEnabledSet.has(id));
  const dirty = enabledDirty || mode !== initialMode;

  const validation = validateEnabledChampionships([...enabled]);
  const atCap = enabled.size >= MAX_ENABLED_CHAMPIONSHIPS;

  function toggle(id: string, next: boolean): void {
    setSaved(false);
    setEnabled((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }

  function onSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!validation.ok || !dirty) {
      if (!dirty) setSaved(true);
      return;
    }

    const patch: Parameters<typeof update.mutate>[0] = {};
    if (enabledDirty) {
      // Serializa na ordem do catálogo (determinístico); só ids ∈ catálogo.
      const catalogIds = catalog.data?.map((c) => c.id) ?? [...enabled];
      patch.enabledChampionships = catalogIds.filter((id) => enabled.has(id));
    }
    if (mode !== initialMode) patch.rankingMode = mode;

    update.mutate(patch, { onSuccess: () => setSaved(true) });
  }

  const activeHelper =
    RANKING_MODES.find((m) => m.value === mode)?.helper ?? "";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {/* Modo de ranking (segmented / radiogroup à mão — sem primitiva radio) */}
      <div className="flex flex-col gap-2">
        <Label id="ranking-mode-label">Modo de ranking</Label>
        <div
          role="radiogroup"
          aria-labelledby="ranking-mode-label"
          className="grid grid-cols-2 gap-2"
        >
          {RANKING_MODES.map((m) => {
            const selected = mode === m.value;
            return (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                disabled={update.isPending}
                onClick={() => {
                  setMode(m.value);
                  setSaved(false);
                }}
                onKeyDown={(ev) => {
                  const isNext =
                    ev.key === "ArrowRight" || ev.key === "ArrowDown";
                  const isPrev =
                    ev.key === "ArrowLeft" || ev.key === "ArrowUp";
                  if (!isNext && !isPrev) return;
                  ev.preventDefault();
                  const idx = RANKING_MODES.findIndex((x) => x.value === mode);
                  const delta = isNext ? 1 : -1;
                  const target =
                    RANKING_MODES[
                      (idx + delta + RANKING_MODES.length) % RANKING_MODES.length
                    ];
                  if (!target) return;
                  setMode(target.value);
                  setSaved(false);
                }}
                className={cn(
                  "flex min-h-[44px] items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-transparent text-foreground hover:bg-muted",
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{activeHelper}</p>
      </div>

      {/* Campeonatos habilitados */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <Label>Campeonatos habilitados</Label>
          <span
            role="status"
            aria-live="polite"
            className="text-xs text-muted-foreground tabular-nums"
          >
            {enabled.size} de {MAX_ENABLED_CHAMPIONSHIPS}
          </span>
        </div>

        {catalog.isError && !catalog.isLoading ? (
          <ErrorState onRetry={() => void catalog.refetch()} />
        ) : catalog.isLoading || !catalog.data ? (
          <ListSkeleton />
        ) : catalog.data.length === 0 ? (
          <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
            Nenhum campeonato disponível.
          </p>
        ) : (
          <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
            {TYPE_GROUPS.map((group) => {
              const items = catalog.data.filter((c) => c.type === group.type);
              if (items.length === 0) return null;
              return (
                <div key={group.type} className="flex flex-col gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {items.map((c) => (
                      <ChampionshipRow
                        key={c.id}
                        championship={c}
                        checked={enabled.has(c.id)}
                        // Bloqueia habilitar além do teto (mantém save válido);
                        // itens já habilitados nunca são bloqueados.
                        disabled={
                          update.isPending || (atCap && !enabled.has(c.id))
                        }
                        onToggle={(v) => toggle(c.id, v)}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {!validation.ok ? (
          <p role="alert" className="text-xs text-destructive">
            {validation.reason}
          </p>
        ) : null}
      </div>

      {update.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {update.error.message}
        </p>
      ) : null}
      {saved && !dirty ? (
        <p role="status" className="text-sm text-success">
          Campeonatos salvos.
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={!dirty || !validation.ok || update.isPending}
        aria-busy={update.isPending}
        className="h-11 w-full"
      >
        {update.isPending ? (
          <LoaderCircle
            size={16}
            className="animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : null}
        Salvar campeonatos
      </Button>
    </form>
  );
}

function ChampionshipRow({
  championship,
  checked,
  disabled,
  onToggle,
}: {
  championship: ChampionshipPublic;
  checked: boolean;
  disabled: boolean;
  onToggle: (next: boolean) => void;
}): JSX.Element {
  const switchId = `champ-${championship.id}`;
  return (
    <li className="flex min-h-[44px] items-center justify-between gap-4 rounded-lg border border-border p-3">
      <div className="flex min-w-0 flex-col gap-1">
        <Label
          htmlFor={switchId}
          className="min-w-0 truncate font-medium"
          title={championship.name}
        >
          {championship.name}
        </Label>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground tabular-nums">
            {championship.season}
          </span>
          <Badge variant="outline">{TYPE_BADGE[championship.type]}</Badge>
          {championship.status === "archived" ? (
            <Badge variant="muted">Encerrado</Badge>
          ) : null}
        </div>
      </div>
      <Switch
        id={switchId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onToggle}
      />
    </li>
  );
}

function ListSkeleton(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-2 rounded-xl border border-border p-4"
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-14 rounded-lg bg-muted animate-pulse motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

function SectionSkeleton(): JSX.Element {
  return (
    <div aria-hidden="true" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="h-4 w-32 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        <div className="h-11 rounded-xl bg-muted animate-pulse motion-reduce:animate-none" />
      </div>
      <ListSkeleton />
    </div>
  );
}
