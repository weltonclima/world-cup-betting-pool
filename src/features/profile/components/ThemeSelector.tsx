"use client";

import { useEffect, useState, type JSX } from "react";
import { useTheme } from "next-themes";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/types";

import { useUpdateProfile } from "../hooks";
import { THEME_OPTIONS } from "../lib/themeSync";

/**
 * Tela de seleção de tema (dark theme, TASK-03): 3 opções mutuamente exclusivas
 * (Claro/Escuro/Automático). Aplica via next-themes (`setTheme`) e persiste no
 * perfil (`themePreference`) para valer cross-device.
 *
 * Guarda `mounted`: antes de montar no client, `theme` é indeterminado — não
 * marcamos opção ativa para evitar mismatch de hidratação.
 */
export function ThemeSelector(): JSX.Element {
  const { theme, setTheme } = useTheme();
  const updateProfile = useUpdateProfile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Opção ativa = `theme` do next-themes (não `resolvedTheme`): "Automático"
  // ativa quando theme === "system". Só após `mounted` para não piscar.
  const active = mounted ? (theme ?? "light") : null;

  async function handleSelect(value: ThemePreference): Promise<void> {
    // Otimista: aplica o tema já, independentemente da persistência.
    setTheme(value);
    try {
      await updateProfile.mutateAsync({ themePreference: value });
    } catch {
      // Tema segue aplicado localmente; só avisamos que não salvou cross-device.
      toast.error("Não foi possível salvar sua preferência de tema.");
    }
  }

  return (
    <section
      role="radiogroup"
      aria-label="Tema do aplicativo"
      className="flex flex-col gap-2"
    >
      <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Aparência
      </h2>

      {THEME_OPTIONS.map(({ value, label, description, icon: Icon }) => {
        const selected = active === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={updateProfile.isPending}
            onClick={() => void handleSelect(value)}
            className={cn(
              "flex min-h-[56px] w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-70",
              selected
                ? "border-primary bg-card ring-1 ring-primary"
                : "border-border bg-card hover:bg-accent",
            )}
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                selected
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-foreground",
              )}
            >
              <Icon size={20} aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span
                className={cn(
                  "text-sm font-medium",
                  selected ? "text-primary" : "text-foreground",
                )}
              >
                {label}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {description}
              </span>
            </span>
            {selected ? (
              <Check
                size={20}
                aria-hidden="true"
                className="shrink-0 text-primary"
              />
            ) : null}
          </button>
        );
      })}

      <p className="px-1 pt-1 text-xs text-muted-foreground">
        No modo Automático o app acompanha o tema do seu dispositivo.
      </p>
    </section>
  );
}
