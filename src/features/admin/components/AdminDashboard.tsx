"use client";

import type { JSX } from "react";
import {
  Ban,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { useAdminStats } from "../hooks/useAdminStats";

/** Tela — Dashboard Admin (PRD07-01). */
export function AdminDashboard(): JSX.Element {
  const { profile } = useAuth();
  const stats = useAdminStats();

  return (
    <div className="flex flex-col gap-4">
      {/* Banner de boas-vindas */}
      <section className="rounded-2xl bg-primary p-5 text-primary-foreground">
        <p className="text-lg font-semibold">
          Bem-vindo, {profile?.nickname ?? "Admin"}!
        </p>
        <p className="text-sm opacity-90">
          Aqui está a visão geral do sistema.
        </p>
      </section>

      {/* Resumo geral */}
      <section className="flex flex-col gap-3" aria-labelledby="resumo-geral">
        <h2 id="resumo-geral" className="text-lg font-medium text-foreground">
          Resumo Geral
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Total de Usuários"
            value={stats.isLoading ? "…" : String(stats.total)}
            icon={Users}
          />
          <StatCard
            label="Pendentes de Aprovação"
            value={stats.isLoading ? "…" : String(stats.pending)}
            icon={Clock}
          />
          <StatCard
            label="Usuários Aprovados"
            value={stats.isLoading ? "…" : String(stats.approved)}
            icon={CheckCircle2}
            tone="win"
          />
          <StatCard
            label="Usuários Bloqueados"
            value={stats.isLoading ? "…" : String(stats.blocked)}
            icon={Ban}
            tone="loss"
          />
          {/* D-A3: sem serviço de contagem agregada — placeholder honesto. */}
          <StatCard label="Total de Palpites" value="—" icon={Target} />
          <StatCard label="Jogos Processados" value="—" icon={CalendarCheck} />
        </div>
        <p className="px-1 text-xs text-muted-foreground">
          Total de palpites e jogos processados serão exibidos quando a
          telemetria agregada estiver disponível.
        </p>
      </section>

      {/* Status da API (resumo → tela dedicada) */}
      <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">
            Status do API-Football
          </span>
          <Badge variant="secondary">Sem dados</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Telemetria não instrumentada nesta versão (ver Status da API).
        </p>
      </section>

      <section className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-4">
        <span className="text-sm font-medium text-foreground">
          Última atualização do Ranking
        </span>
        <Badge variant="secondary">Sem dados</Badge>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "neutral" | "win" | "loss";
}): JSX.Element {
  const valueColor =
    tone === "win"
      ? "text-win"
      : tone === "loss"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon size={16} aria-hidden="true" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className={cn("text-3xl font-bold tabular-nums", valueColor)}>
        {value}
      </span>
    </div>
  );
}
