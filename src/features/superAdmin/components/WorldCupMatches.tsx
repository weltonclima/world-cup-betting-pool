"use client";

import { useMemo, useState, type JSX } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useAdminMatches,
  useAdminGroups,
  useEditMatch,
} from "@/features/superAdmin/hooks";
import type { AdminMatchView, MatchFilters } from "@/services/superAdmin";

import { SuperAdminSubHeader, ListState } from "./shared";
import { EditMatchDialog } from "./EditMatchDialog";

// ─── Rótulos pt-BR ──────────────────────────────────────────────────────────

const STAGE_LABELS: Record<AdminMatchView["stage"], string> = {
  grupos: "Fase de Grupos",
  "dezesseis-avos": "16-avos",
  oitavas: "Oitavas",
  quartas: "Quartas",
  semifinal: "Semifinal",
  terceiro: "Disputa 3º lugar",
  final: "Final",
};

const STATUS_LABELS: Record<AdminMatchView["status"], string> = {
  scheduled: "Agendado",
  live: "Ao Vivo",
  finished: "Encerrado",
  postponed: "Adiado",
  canceled: "Cancelado",
};

function statusBadgeVariant(
  status: AdminMatchView["status"],
): "secondary" | "destructive" | "muted" | "default" {
  if (status === "live") return "default";
  if (status === "finished") return "secondary";
  if (status === "canceled" || status === "postponed") return "destructive";
  return "muted";
}

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todas as fases" },
  ...Object.entries(STAGE_LABELS).map(([value, label]) => ({ value, label })),
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todos os status" },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

// ─── Agrupamento por dia (Hoje/Amanhã/data) ───────────────────────────────────

interface DaySection {
  key: string;
  label: string;
  matches: AdminMatchView[];
}

function utcDateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function groupByDay(matches: AdminMatchView[], now: Date): DaySection[] {
  const nowKey = utcDateKey(now.toISOString());
  const tomorrowKey = utcDateKey(new Date(now.getTime() + 86_400_000).toISOString());

  const sorted = [...matches].sort(
    (a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
  );

  const map = new Map<string, AdminMatchView[]>();
  for (const m of sorted) {
    const key = utcDateKey(m.kickoffAt);
    const list = map.get(key);
    if (list) list.push(m);
    else map.set(key, [m]);
  }

  const sections: DaySection[] = [];
  for (const [key, list] of map.entries()) {
    let label: string;
    if (key === nowKey) label = "Hoje";
    else if (key === tomorrowKey) label = "Amanhã";
    else {
      const [y, mo, d] = key.split("-").map(Number);
      label = format(new Date(y!, mo! - 1, d!), "d 'de' MMMM 'de' yyyy", {
        locale: ptBR,
      });
    }
    sections.push({ key, label, matches: list });
  }
  return sections;
}

// ─── Tela ─────────────────────────────────────────────────────────────────────

/**
 * Jogos da Copa (PRD11-06). 3 filtros (grupo/fase/status, B4 server-side),
 * partidas agrupadas por dia (Hoje/Amanhã/data). Cada jogo abre o diálogo de
 * edição manual (overlay `isManualOverride`). Server reforça autorização e
 * coerência placar↔status. O sync openfootball foi descontinuado (PRD-13): a
 * fonte de dados agora é ESPN em tempo real.
 */
export function WorldCupMatches(): JSX.Element {
  const [group, setGroup] = useState("");
  const [stage, setStage] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<AdminMatchView | null>(null);

  const filters: MatchFilters = useMemo(
    () => ({
      ...(group ? { group } : {}),
      ...(stage ? { stage } : {}),
      ...(status ? { status } : {}),
    }),
    [group, stage, status],
  );

  const { data, isLoading, isError, refetch } = useAdminMatches(filters);
  const groupsQuery = useAdminGroups("active");
  const edit = useEditMatch();

  const groupOptions = useMemo(() => {
    const base = [{ value: "", label: "Todos os grupos" }];
    for (const g of groupsQuery.data ?? []) {
      base.push({ value: g.id, label: g.name });
    }
    return base;
  }, [groupsQuery.data]);

  const sections = useMemo(
    () => (data ? groupByDay(data, new Date()) : undefined),
    [data],
  );

  return (
    <div className="flex flex-col gap-4">
      <SuperAdminSubHeader title="Jogos da Copa" />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <FilterSelect
          label="Grupo"
          value={group}
          onChange={setGroup}
          options={groupOptions}
        />
        <FilterSelect
          label="Fase"
          value={stage}
          onChange={setStage}
          options={STAGE_OPTIONS}
        />
        <FilterSelect
          label="Status"
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS}
        />
      </div>

      <ListState
        isLoading={isLoading}
        isError={isError}
        data={sections}
        onRetry={() => void refetch()}
        emptyMessage="Nenhum jogo encontrado."
      >
        {(rows) => (
          <div className="flex flex-col gap-5">
            {rows.map((section) => (
              <section key={section.key} className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  {section.label}
                </h2>
                <ul className="flex flex-col gap-3">
                  {section.matches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      onEdit={() => {
                        edit.reset();
                        setEditing(match);
                      }}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </ListState>

      {editing ? (
        <EditMatchDialog
          open
          onOpenChange={(next) => {
            if (!next) setEditing(null);
          }}
          match={editing}
          pending={edit.isPending}
          errorMessage={edit.isError ? edit.error.message : null}
          onConfirm={(input) =>
            edit.mutate(
              { id: editing.id, input },
              { onSuccess: () => setEditing(null) },
            )
          }
        />
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}): JSX.Element {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function stageRoundLabel(match: AdminMatchView): string {
  const stage = STAGE_LABELS[match.stage];
  if (match.round !== null) return `${stage} · Rodada ${match.round}`;
  return stage;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function MatchCard({
  match,
  onEdit,
}: {
  match: AdminMatchView;
  onEdit: () => void;
}): JSX.Element {
  const finished = match.status === "finished" || match.status === "live";

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <p className="text-center text-xs text-muted-foreground">
        {stageRoundLabel(match)}
      </p>
      <div className="flex items-center gap-2">
        <TeamSide team={match.home} align="start" />
        <div className="flex shrink-0 flex-col items-center px-2">
          {finished && match.homeScore !== null && match.awayScore !== null ? (
            <span className="text-lg font-bold tabular-nums text-foreground">
              {match.homeScore} - {match.awayScore}
            </span>
          ) : (
            <span className="text-lg font-bold tabular-nums text-foreground">
              {formatTime(match.kickoffAt)}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDate(match.kickoffAt)}
          </span>
        </div>
        <TeamSide team={match.away} align="end" />
      </div>
      {match.venue ? (
        <p className="truncate text-center text-xs text-muted-foreground">
          {match.venue.name} · {match.venue.city}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={statusBadgeVariant(match.status)}>
            {STATUS_LABELS[match.status]}
          </Badge>
          {match.isManualOverride ? (
            <Badge variant="outline">Editado</Badge>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[44px] shrink-0"
          onClick={onEdit}
        >
          Editar
        </Button>
      </div>
    </li>
  );
}

function TeamSide({
  team,
  align,
}: {
  team: AdminMatchView["home"];
  align: "start" | "end";
}): JSX.Element {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 ${
        align === "end" ? "flex-row-reverse text-right" : ""
      }`}
    >
      {team.flagUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.flagUrl}
          alt=""
          className="size-7 shrink-0 rounded-sm object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="size-7 shrink-0 rounded-sm bg-muted"
        />
      )}
      <span className="truncate text-sm font-medium text-foreground">
        {team.name}
      </span>
    </div>
  );
}
