"use client";

import type { JSX } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ChevronRight,
  Clock,
  Link2,
  Pencil,
  Settings,
  Shield,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  AVATAR_CLASSES,
  getAvatarVariant,
  getInitials,
} from "@/features/admin/components/userAvatar";
import { useGroupDashboard } from "@/features/groupAdmin/hooks";
import type { GroupDashboard as GroupDashboardData } from "@/services/group";

import { GroupAdminSubHeader } from "./GroupAdminSubHeader";
import { UserStatusBadge, formatDatePtBr } from "./statusBadge";

/**
 * Dashboard do Grupo (PRD10-01). PNG = fonte de verdade: faixa com foto+nome,
 * 4 cards 2×2 (Participantes/Pendentes/Bloqueados/Convites Ativos), "Últimos
 * Cadastros" (+ Ver todos) e "Ações Rápidas" (Pendentes/Convites/Configurações).
 */
export function GroupDashboard(): JSX.Element {
  const { data, isLoading, isError, refetch } = useGroupDashboard();

  return (
    <div className="flex flex-col gap-5">
      <GroupAdminSubHeader title="Administração do Grupo" />

      {isError && !isLoading ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <DashboardSkeleton />
      ) : (
        <DashboardContent data={data} />
      )}
    </div>
  );
}

function DashboardContent({ data }: { data: GroupDashboardData }): JSX.Element {
  const { pool, counts, recent } = data;

  return (
    <div className="flex flex-col gap-6">
      {/* Faixa do pool: foto + nome */}
      <div className="flex items-center gap-3 rounded-xl border border-border p-4">
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
          {pool.photoBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pool.photoBase64} alt="" className="size-full object-cover" />
          ) : (
            <Shield size={22} className="text-muted-foreground" aria-hidden="true" />
          )}
        </span>
        <h2 className="truncate text-base font-bold text-foreground">{pool.name}</h2>
      </div>

      {/* Visão geral — 4 cards 2×2 */}
      <section aria-labelledby="overview-title" className="flex flex-col gap-3">
        <h3 id="overview-title" className="text-sm font-semibold text-foreground">
          Visão geral
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<Users size={22} aria-hidden="true" />}
            value={counts.participants}
            label="Participantes"
          />
          <StatCard
            icon={<Clock size={22} aria-hidden="true" />}
            value={counts.pending}
            label="Pendentes"
          />
          <StatCard
            icon={<Shield size={22} aria-hidden="true" />}
            value={counts.blocked}
            label="Bloqueados"
          />
          <StatCard
            icon={<Link2 size={22} aria-hidden="true" />}
            value={counts.activeInvites}
            label="Convites Ativos"
          />
        </div>
      </section>

      {/* Últimos cadastros */}
      <section aria-labelledby="recent-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 id="recent-title" className="text-sm font-semibold text-foreground">
            Últimos Cadastros
          </h3>
          <Link
            href="/group/users/pending"
            className="text-sm font-medium text-primary hover:underline"
          >
            Ver todos
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
            Nenhum registro encontrado.
          </p>
        ) : (
          <ul className="flex flex-col rounded-xl border border-border">
            {recent.map((u) => {
              const variant = getAvatarVariant(u.uid);
              return (
                <li
                  key={u.uid}
                  className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
                >
                  <Avatar>
                    {u.avatarUrl ? (
                      <AvatarImage src={u.avatarUrl} alt="" />
                    ) : null}
                    <AvatarFallback
                      className={cn("text-sm font-medium", AVATAR_CLASSES[variant])}
                    >
                      {getInitials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {u.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDatePtBr(u.createdAt)}
                    </p>
                  </div>
                  <UserStatusBadge status={u.status} />
                  <ChevronRight
                    size={18}
                    className="shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Ações rápidas */}
      <section aria-labelledby="quick-title" className="flex flex-col gap-3">
        <h3 id="quick-title" className="text-sm font-semibold text-foreground">
          Ações Rápidas
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <QuickAction
            href="/group/users/pending"
            icon={<Clock size={20} aria-hidden="true" />}
            label="Pendentes"
          />
          <QuickAction
            href="/group/invites"
            icon={<Link2 size={20} aria-hidden="true" />}
            label="Convites"
          />
          <QuickAction
            href="/group/settings"
            icon={<Settings size={20} aria-hidden="true" />}
            label="Configurações"
          />
          <QuickAction
            href="/group/predictions"
            icon={<Pencil size={20} aria-hidden="true" />}
            label="Palpites"
          />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: JSX.Element;
  value: number;
  label: string;
}): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border p-4">
      <span className="text-primary">{icon}</span>
      <span className="text-2xl font-bold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: JSX.Element;
  label: string;
}): JSX.Element {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: "outline" }),
        "h-auto min-h-[44px] flex-col gap-1.5 py-3",
      )}
    >
      <span className="text-foreground">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }): JSX.Element {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex flex-col items-center gap-3 rounded-xl border border-border p-6 text-center"
    >
      <AlertCircle size={28} className="text-destructive" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">Erro ao carregar informações.</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="min-h-[44px]"
      >
        Tentar novamente
      </Button>
    </div>
  );
}

function DashboardSkeleton(): JSX.Element {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <div className="h-20 rounded-xl border border-border bg-muted/40 animate-pulse motion-reduce:animate-none" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-border bg-muted/40 animate-pulse motion-reduce:animate-none"
          />
        ))}
      </div>
      <div className="h-40 rounded-xl border border-border bg-muted/40 animate-pulse motion-reduce:animate-none" />
    </div>
  );
}
