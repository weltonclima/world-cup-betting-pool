"use client";

import { useEffect, useState, type JSX } from "react";
import { useForm } from "react-hook-form";
import {
  BellRing,
  CalendarClock,
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
import { usePushRegistration } from "@/features/push/hooks/usePushRegistration";
import { registerPush, unregisterPush } from "@/features/push/registration";
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
];

/** Tela 03 — Preferências de Notificação (PRD08-03). */
export function PreferencesForm(): JSX.Element {
  const query = usePreferences();
  const update = useUpdatePreferences();
  const push = usePushRegistration();
  // Opt-in de push em voo (prompt de permissão + registro do token).
  const [pushBusy, setPushBusy] = useState(false);

  const form = useForm<NotificationPreferencesInput>({
    values: query.data
      ? {
          system: query.data.system,
          games: query.data.games,
          ranking: query.data.ranking,
          pushEnabled: query.data.pushEnabled,
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
        pushEnabled: query.data.pushEnabled,
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

  /**
   * Master switch de push (TASK-05). Ligar dispara o opt-in real (permissão +
   * token); sem token (negada/sem suporte) reverte e avisa — sem token o push não
   * chega. Desligar persiste o opt-out e remove o token (best-effort).
   */
  async function handlePushToggle(checked: boolean): Promise<void> {
    if (pushBusy) return; // já há um opt-in em voo (evita disparo duplo)
    if (checked) {
      form.setValue("pushEnabled", true); // otimista
      setPushBusy(true);
      try {
        const token = await registerPush();
        if (!token) {
          form.setValue("pushEnabled", false);
          toast.error("Não foi possível ativar as notificações.");
          return;
        }
        update.mutate(
          { ...form.getValues(), pushEnabled: true },
          {
            onError: () => {
              form.setValue("pushEnabled", false);
              toast.error("Não foi possível salvar a preferência.");
            },
          },
        );
      } finally {
        setPushBusy(false);
      }
      return;
    }

    form.setValue("pushEnabled", false);
    update.mutate(
      { ...form.getValues(), pushEnabled: false },
      {
        onError: () => {
          form.setValue("pushEnabled", true);
          toast.error("Não foi possível salvar a preferência.");
        },
      },
    );
    void unregisterPush(); // best-effort: remove o token do device
  }

  const values = form.watch();

  // Estado do master switch de push (texto auxiliar acessível + disabled).
  const pushOn = values.pushEnabled ?? false;
  const pushDenied = push.permission === "denied";
  const pushBusyAny = pushBusy || update.isPending;
  const pushHelp = pushDenied
    ? "Permissão negada. Habilite as notificações nas configurações do navegador."
    : pushBusy
      ? "Solicitando permissão…"
      : pushOn
        ? "Push ativado neste dispositivo."
        : "Receba alertas mesmo com o app fechado.";

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

      {/* Push (master switch) — só quando o ambiente suporta (SSR/sem suporte/
          sem VAPID/iOS-aba não renderiza; CTA de instalar é da TASK-06). */}
      {push.supported ? (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Notificações push
          </h2>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BellRing size={18} aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium text-foreground">
                Notificações push
              </span>
              <span
                role="status"
                aria-live="polite"
                className={`text-xs ${pushDenied ? "text-destructive" : "text-muted-foreground"}`}
              >
                {pushHelp}
              </span>
            </div>
            <Switch
              checked={pushOn}
              onCheckedChange={(value) => void handlePushToggle(value)}
              aria-label="Notificações push"
              // denied só desabilita quando JÁ está off (sem re-pedir prompt). Se
              // ficou on e a permissão foi revogada depois, permite desligar.
              disabled={pushBusyAny || (pushDenied && !pushOn)}
            />
          </div>
        </section>
      ) : null}

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
                // trava também durante o opt-in de push em voo: o write de push
                // espalha form.getValues() e setDoc sobrescreve o doc inteiro —
                // editar categoria no meio correria com esse write.
                disabled={update.isPending || pushBusy}
              />
            </div>
          );
        })}
      </section>

      {/* Aviso */}
      <div className="flex items-start gap-2 rounded-lg bg-muted p-4">
        <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Importante:</span> as
          categorias valem para as notificações internas e também para o push. O
          push só é enviado com o interruptor de notificações push ligado; quando
          ligado, <span className="font-medium text-foreground">Sistema</span> segue
          esse interruptor.
        </p>
      </div>
    </div>
  );
}
