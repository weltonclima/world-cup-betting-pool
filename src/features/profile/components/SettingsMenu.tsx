"use client";

import type { JSX } from "react";
import {
  Bell,
  CircleHelp,
  Info,
  Sun,
  UserPen,
} from "lucide-react";

import { ProfileMenuItem } from "./ProfileMenuItem";

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
  return (
    <div className="flex flex-col gap-5">
      <SettingsSection title="Geral">
        <ProfileMenuItem
          icon={UserPen}
          title="Editar Perfil"
          subtitle="Nome, foto e informações"
          href="/profile/editar"
        />
      </SettingsSection>

      <SettingsSection title="Notificações">
        <ProfileMenuItem
          icon={Bell}
          title="Gerenciar Notificações"
          subtitle="Configure suas preferências"
          href="/notificacoes/preferencias"
        />
      </SettingsSection>

      <SettingsSection title="Tema">
        {/* A4: tema claro/escuro é futuro — item visível, somente leitura. */}
        <ProfileMenuItem
          icon={Sun}
          title="Tema do Aplicativo"
          subtitle="Claro"
          disabled
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
