"use client";

import type { JSX } from "react";
import {
  CalendarDays,
  CircleCheckBig,
  Clock,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useDashboardStats } from "@/features/superAdmin/hooks";
import type { DashboardStats } from "@/services/superAdmin";

import { ErrorState } from "./shared";
import { RecentActivity } from "./RecentActivity";

/** Dashboard Global do Super Admin (PRD11-01). */
export function SuperAdminDashboard(): JSX.Element {
  const { profile } = useAuth();
  const { data, isLoading, isError, refetch } = useDashboardStats();

  const greeting = `Olá, ${profile?.name ?? "Super Admin"}!`;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold text-foreground">{greeting}</h1>
        <p className="text-sm text-muted-foreground">
          Painel geral da plataforma.
        </p>
      </header>

      {isError && !isLoading ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <>
          <KpiGrid stats={isLoading ? null : (data ?? null)} />
          <RecentActivity />
        </>
      )}
    </div>
  );
}

interface KpiCardProps {
  icon: LucideIcon;
  value: number | string;
  label: string;
  loading: boolean;
}

function KpiCard({ icon: Icon, value, label, loading }: KpiCardProps): JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <Icon size={20} aria-hidden="true" className="text-primary" />
      {loading ? (
        <div className="h-7 w-12 rounded bg-muted animate-pulse motion-reduce:animate-none" />
      ) : (
        <span className="text-2xl font-bold tabular-nums text-foreground">
          {value}
        </span>
      )}
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function KpiGrid({ stats }: { stats: DashboardStats | null }): JSX.Element {
  const loading = stats === null;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <KpiCard icon={CircleCheckBig} value={stats?.groups.active ?? 0} label="Grupos Ativos" loading={loading} />
      <KpiCard icon={Clock} value={stats?.groups.pending ?? 0} label="Grupos Pendentes" loading={loading} />
      <KpiCard icon={Users} value={stats?.users ?? 0} label="Participantes" loading={loading} />
      <KpiCard icon={ShieldCheck} value={stats?.admins ?? 0} label="Administradores" loading={loading} />
      <KpiCard icon={CalendarDays} value={stats?.matches ?? 0} label="Jogos" loading={loading} />
    </div>
  );
}
