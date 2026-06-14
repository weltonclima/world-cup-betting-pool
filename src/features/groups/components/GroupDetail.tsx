"use client";

import type { JSX } from "react";
import {
  AlertCircle,
  CalendarDays,
  CircleCheck,
  Hash,
  LineChart,
  User,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InviteValue, inviteUrl } from "@/components/invite/InviteValue";
import { useGroupDetail } from "@/features/groups/hooks";
import { useAdminGroupInvite } from "@/features/superAdmin/hooks";
import type { Invite } from "@/types/invites";
import type { Pool, PoolStatus } from "@/types/pools";

import { GroupSubHeader } from "./GroupSubHeader";

/** Rótulo + variante de badge por status do pool (PRD09-05 mostra "Ativo"). */
const STATUS_META: Record<
  PoolStatus,
  { label: string; variant: "default" | "muted" | "destructive" }
> = {
  active: { label: "Ativo", variant: "default" },
  pending: { label: "Pendente", variant: "muted" },
  blocked: { label: "Bloqueado", variant: "destructive" },
};

/** Dias restantes (inteiro, mín. 0) até `expiresAt` de um convite. */
function inviteValidityDays(invite: Invite): number {
  const ms = new Date(invite.expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** Formata o ISO de criação em data pt-BR (dd/mm/aaaa), à prova de valor inválido. */
function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/**
 * Detalhes do Grupo (PRD-09, TASK-09 — tela PRD09-05).
 *
 * Cabeçalho com foto/nome/slug + badge de status; descrição; e linhas de
 * administrador, nº de participantes, data de criação e status. Estados:
 * loading=skeleton, erro=alerta+retry (`useGroupDetail`).
 */
export function GroupDetail({ id }: { id: string }): JSX.Element {
  const { data, isLoading, isError, refetch } = useGroupDetail(id);

  return (
    <div className="flex flex-col gap-5">
      <GroupSubHeader title="Detalhes do Grupo" />

      {isError ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-xl border border-border p-6 text-center"
        >
          <AlertCircle size={28} className="text-destructive" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar o grupo. Tente novamente.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            className="min-h-[44px]"
          >
            Tentar Novamente
          </Button>
        </div>
      ) : isLoading || !data ? (
        <GroupDetailSkeleton />
      ) : (
        <GroupDetailContent pool={data.pool} memberCount={data.memberCount} />
      )}
    </div>
  );
}

function GroupDetailContent({
  pool,
  memberCount,
}: {
  pool: Pool;
  memberCount: number;
}): JSX.Element {
  const status = STATUS_META[pool.status];

  return (
    <div className="flex flex-col gap-4">
      {/* Cartão de cabeçalho: foto + nome + slug + badge */}
      <div className="flex items-center gap-3 rounded-xl border border-border p-4">
        <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
          {pool.photoBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pool.photoBase64} alt="" className="size-full object-cover" />
          ) : (
            <Users size={24} className="text-muted-foreground" aria-hidden="true" />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="truncate text-base font-bold text-foreground">
            {pool.name}
          </h2>
          <p className="truncate text-xs text-muted-foreground">{pool.slug}</p>
          <Badge variant={status.variant} className="mt-0.5">
            {status.label}
          </Badge>
        </div>
      </div>

      {/* Descrição (opcional) */}
      {pool.description ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">Descrição</h3>
          <p className="text-sm text-muted-foreground">{pool.description}</p>
        </div>
      ) : null}

      {/* Metadados */}
      <dl className="flex flex-col rounded-xl border border-border">
        <DetailRow
          icon={<User size={18} aria-hidden="true" />}
          label="Administrador"
          value={pool.adminId}
        />
        <DetailRow
          icon={<Users size={18} aria-hidden="true" />}
          label="Membros"
          value={`${memberCount} ${memberCount === 1 ? "participante" : "participantes"}`}
        />
        <DetailRow
          icon={<CalendarDays size={18} aria-hidden="true" />}
          label="Criado em"
          value={formatCreatedAt(pool.createdAt)}
        />
        <DetailRow
          icon={<CircleCheck size={18} aria-hidden="true" />}
          label="Status"
          value={status.label}
          valueClassName={pool.status === "active" ? "text-primary" : undefined}
          last
        />
      </dl>

      {/* Convite ativo do grupo (super_admin — a rota /groups é SuperAdminGuard). */}
      <InviteSection poolId={pool.id} />
    </div>
  );
}

/**
 * Seção do convite ATIVO do grupo: link copiável/compartilhável (reuso de
 * `InviteValue`) + código, validade restante e usos. Lê via `useAdminGroupInvite`
 * (gate super_admin no servidor). Estados: loading=skeleton, erro=retry,
 * vazio=mensagem (geração fica na lista de Grupos Ativos, esta tela é só-leitura).
 */
function InviteSection({ poolId }: { poolId: string }): JSX.Element {
  const { data: invite, isLoading, isError, refetch } =
    useAdminGroupInvite(poolId);

  if (isError) {
    return (
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Convite</h3>
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar o convite.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            className="min-h-[44px]"
          >
            Tentar Novamente
          </Button>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Convite</h3>
        <div
          aria-hidden="true"
          className="h-28 rounded-xl border border-border bg-muted animate-pulse motion-reduce:animate-none"
        />
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <InviteValue
        title="Link de convite"
        description="Compartilhe o link abaixo para convidar novos participantes."
        value={invite ? inviteUrl(invite.code) : ""}
        shareLabel="Compartilhar link"
        empty={!invite}
        emptyMessage="Nenhum convite ativo neste grupo."
      />

      {invite ? (
        <dl className="flex flex-col rounded-xl border border-border">
          <DetailRow
            icon={<Hash size={18} aria-hidden="true" />}
            label="Código"
            value={invite.code}
          />
          <DetailRow
            icon={<CalendarDays size={18} aria-hidden="true" />}
            label="Validade"
            value={`${inviteValidityDays(invite)} dias`}
          />
          <DetailRow
            icon={<LineChart size={18} aria-hidden="true" />}
            label="Usos"
            value={`${invite.usedCount}/${invite.maxUses}`}
            last
          />
        </dl>
      ) : null}
    </div>
  );
}

/** Linha de metadado: ícone + rótulo à esquerda, valor à direita. */
function DetailRow({
  icon,
  label,
  value,
  valueClassName,
  last = false,
}: {
  icon: JSX.Element;
  label: string;
  value: string;
  valueClassName?: string;
  last?: boolean;
}): JSX.Element {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-3.5 ${
        last ? "" : "border-b border-border"
      }`}
    >
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </dt>
      <dd
        className={`truncate text-right text-sm font-medium text-foreground ${valueClassName ?? ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

/** Skeleton da tela de detalhe. */
function GroupDetailSkeleton(): JSX.Element {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-xl border border-border p-4">
        <div className="size-14 shrink-0 rounded-xl bg-muted animate-pulse motion-reduce:animate-none" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-4 w-2/5 rounded bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="h-3 w-1/4 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        </div>
      </div>
      <div className="flex flex-col rounded-xl border border-border">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 px-4 py-3.5"
          >
            <div className="h-3.5 w-1/4 rounded bg-muted animate-pulse motion-reduce:animate-none" />
            <div className="h-3.5 w-1/3 rounded bg-muted animate-pulse motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </div>
  );
}
