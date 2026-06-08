"use client";

import { useEffect, type JSX } from "react";
import { useForm } from "react-hook-form";
import {
  CalendarClock,
  Flag,
  Info,
  ShieldCheck,
  Trophy,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  RankingErrorState,
  RankingSkeleton,
} from "@/features/rankings/components";
import { Switch } from "@/components/ui/switch";
import type { NotificationPreferencesInput } from "@/schemas/notificationPreferences";

import { usePreferences, useUpdatePreferences } from "../hooks";

type Category = keyof NotificationPreferencesInput;

const CATEGORIES: {
  key: Category;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    key: "system",
    label: "Sistema",
    description: "Notificações sobre conta, segurança, aprovação e bloqueios.",
    icon: ShieldCheck,
  },
  {
    key: "games",
    label: "Jogos",
    description: "Notificações sobre novos jogos, prazos e resultados.",
    icon: CalendarClock,
  },
  {
    key: "ranking",
    label: "Ranking",
    description: "Notificações sobre atualizações e mudanças de posição.",
    icon: Trophy,
  },
  {
    key: "pool",
    label: "Bolão",
    description: "Notificações sobre fases e regras do bolão.",
    icon: Flag,
  },
];

/** Tela 03 — Preferências de Notificação (PRD08-03). */
export function PreferencesForm(): JSX.Element {
  const query = usePreferences();
  const update = useUpdatePreferences();

  const form = useForm<NotificationPreferencesInput>({
    values: query.data
      ? {
          system: query.data.system,
          games: query.data.games,
          ranking: query.data.ranking,
          pool: query.data.pool,
        }
      : undefined,
  });

  // Mantém o form sincronizado quando os dados chegam.
  useEffect(() => {
    if (query.data) {
      form.reset({
        system: query.data.system,
        games: query.data.games,
        ranking: query.data.ranking,
        pool: query.data.pool,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  if (query.isLoading) return <RankingSkeleton rows={4} />;
  if (query.isError) {
    return (
      <RankingErrorState
        message="Erro ao carregar preferências"
        onRetry={() => void query.refetch()}
      />
    );
  }

  function handleToggle(key: Category, checked: boolean): void {
    form.setValue(key, checked);
    const next = { ...form.getValues(), [key]: checked };
    update.mutate(next, {
      onError: () => {
        form.setValue(key, !checked); // reverte em caso de falha
        toast.error("Não foi possível salvar a preferência.");
      },
    });
  }

  const values = form.watch();

  return (
    <div className="flex flex-col gap-6">
      {/* Intro */}
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bell size={28} aria-hidden="true" />
        </span>
        <p className="max-w-xs text-sm text-muted-foreground">
          Gerencie suas preferências de notificações.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Categorias
        </h2>
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const checked = values[cat.key] ?? true;
          return (
            <div
              key={cat.key}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon size={18} aria-hidden="true" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium text-foreground">
                  {cat.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {cat.description}
                </span>
              </div>
              <Switch
                checked={checked}
                onCheckedChange={(value) => handleToggle(cat.key, value)}
                aria-label={`Notificações de ${cat.label}`}
                disabled={update.isPending}
              />
            </div>
          );
        })}
      </section>

      {/* Aviso */}
      <div className="flex items-start gap-2 rounded-lg bg-muted p-4">
        <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Importante:</span> estas
          preferências controlam apenas as notificações internas do aplicativo. Não
          enviamos e-mail ou push nesta versão.
        </p>
      </div>
    </div>
  );
}
