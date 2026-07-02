"use client";

import { useEffect, useState, type JSX } from "react";
import { useTheme } from "next-themes";
import {
  Bell,
  CircleHelp,
  Info,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  UserPen,
} from "lucide-react";

import type { ThemePreference } from "@/types";

import { themeLabel } from "../lib/themeSync";
import { ProfileMenuItem } from "./ProfileMenuItem";

/** Ícone do item Tema conforme a escolha atual. */
const THEME_ICON = { light: Sun, dark: Moon, system: Monitor } as const;

/** Seção rotulada de configurações. */
function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Tela 05 — Configurações (PRD06-05). */
export function SettingsMenu(): JSX.Element {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Escolha atual só após montar (theme indeterminado no SSR/pré-hidratação).
  const current = (mounted ? (theme ?? "light") : "light") as ThemePreference;
  const ThemeIcon = THEME_ICON[current] ?? Sun;

  return (
    <div className="flex flex-col gap-5">
      <SettingsSection title="Geral">
        <ProfileMenuItem
          icon={UserPen}
          title="Editar Perfil"
          subtitle="Nome, foto e informações"
          href="/profile/edit"
        />
      </SettingsSection>

      <SettingsSection title="Segurança">
        <ProfileMenuItem
          icon={ShieldCheck}
          title="Login por Biometria"
          subtitle="Face ID, Touch ID ou digital"
          href="/profile/security"
        />
      </SettingsSection>

      <SettingsSection title="Notificações">
        <ProfileMenuItem
          icon={Bell}
          title="Gerenciar Notificações"
          subtitle="Configure suas preferências"
          href="/notifications/preferences"
        />
      </SettingsSection>

      <SettingsSection title="Tema">
        {/* dark theme, TASK-03: navega para o seletor; subtitle = escolha atual. */}
        <ProfileMenuItem
          icon={ThemeIcon}
          title="Tema do Aplicativo"
          subtitle={themeLabel(current)}
          href="/profile/theme"
        />
      </SettingsSection>

      <SettingsSection title="Sobre">
        {/* A5: informativo estático. */}
        <ProfileMenuItem
          icon={Info}
          title="Sobre o Bolão"
          subtitle="Versão 1.0.0"
          disabled
        />
      </SettingsSection>

      <SettingsSection title="Ajuda e Suporte">
        <ProfileMenuItem
          icon={CircleHelp}
          title="Central de Ajuda"
          subtitle="Dúvidas frequentes"
          disabled
        />
      </SettingsSection>
    </div>
  );
}
