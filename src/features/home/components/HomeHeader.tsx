"use client";

import { Bell } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  getInitials,
  getAvatarVariant,
  AVATAR_CLASSES,
} from "@/features/admin/components/userAvatar";
import { cn } from "@/lib/utils";

export interface HomeHeaderProps {
  /** Nome completo do usuário (profile.name). null durante loading ou erro. */
  name: string | null;
  /** uid do Firebase Auth. null se não autenticado. */
  uid: string | null;
}

/**
 * Bloco de boas-vindas no topo do conteúdo da Home.
 * NÃO é o Header fixo do AppShell — é um bloco de conteúdo dentro de <main>.
 *
 * Exibe: avatar por iniciais + saudação "Olá, {nome} 👋" + sino estático (MVP).
 */
export function HomeHeader({ name, uid }: HomeHeaderProps) {
  // Derivações puras — sem hooks
  const initials = name ? getInitials(name) : "?";
  const avatarColorClass = uid
    ? AVATAR_CLASSES[getAvatarVariant(uid)]
    : AVATAR_CLASSES["c1"];
  const greeting = name ? `Olá, ${name} 👋` : "Olá 👋";

  return (
    <section aria-label="Boas-vindas" className="mb-6">
      <div className="flex items-center justify-between gap-3">

        {/* Avatar + texto */}
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="size-12 shrink-0">
            {/* aria-hidden: o nome completo já é lido na saudação ao lado (evita leitura redundante das iniciais). */}
            <AvatarFallback
              aria-hidden="true"
              className={cn("text-sm font-semibold", avatarColorClass)}
            >
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <p className="text-lg font-semibold text-foreground truncate">
              {greeting}
            </p>
            <p className="text-sm text-muted-foreground">
              Bem-vindo ao bolão
            </p>
          </div>
        </div>

        {/* Sino estático (MVP — R5: sem realtime) */}
        {/* focus-visible mantido para quando disabled for removido (MVP+); usa token --ring do design-system. */}
        <button
          type="button"
          aria-label="Notificações (em breve)"
          aria-disabled="true"
          disabled
          className={cn(
            "flex items-center justify-center size-11 rounded-full",
            "text-muted-foreground",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <Bell size={20} aria-hidden="true" />
        </button>

      </div>
    </section>
  );
}
