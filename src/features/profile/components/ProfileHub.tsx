"use client";

import { useRef, useState, type JSX } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity,
  BarChart3,
  Camera,
  FolderCheck,
  FolderClock,
  FolderX,
  Globe,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  ScrollText,
  Settings,
  Trophy,
  UserCheck,
  UserCog,
  Users,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { isGroupAdminRole, isSuperAdminRole } from "@/schemas/shared";

import { useProfile, useUpdateProfile } from "../hooks";
import { AvatarImageError, validateImageInput } from "../lib/imageToDataUrl";
import { AvatarCropModal } from "./AvatarCropModal";
import { ProfileMenuItem } from "./ProfileMenuItem";

/** Iniciais (até 2) a partir do nome para o fallback do avatar. */
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const STATUS_LABEL: Record<string, string> = {
  approved: "Participante Ativo",
  pending: "Aguardando Aprovação",
  blocked: "Conta Bloqueada",
};

/** Tela 01 — Meu Perfil (hub) (PRD06-01). */
export function ProfileHub(): JSX.Element {
  const { profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  if (!profile) {
    return (
      <p className="text-sm text-muted-foreground">Carregando perfil…</p>
    );
  }

  const memberSince = profile.createdAt
    ? format(new Date(profile.createdAt), "dd/MM/yyyy", { locale: ptBR })
    : null;

  // Seleção do arquivo: valida e abre o modal de recorte. Input disparado por
  // clique direto no botão (gesto do usuário) para compatibilidade com iOS
  // Safari; o modal abre via onChange, nunca programaticamente.
  function handleAvatarChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ): void {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite reselecionar o mesmo arquivo
    if (!file) return;
    try {
      validateImageInput(file);
    } catch (error) {
      toast.error(
        error instanceof AvatarImageError
          ? error.message
          : "Não foi possível usar essa imagem.",
      );
      return;
    }
    setPendingFile(file);
    setCropOpen(true);
  }

  function closeCrop(): void {
    setCropOpen(false);
    setPendingFile(null);
  }

  async function handleCropConfirm(avatarUrl: string): Promise<void> {
    try {
      await updateProfile.mutateAsync({ avatarUrl });
      toast.success("Foto de perfil atualizada.");
    } catch {
      toast.error("Não foi possível atualizar a foto. Tente novamente.");
    } finally {
      closeCrop();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Engrenagem → Configurações */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Meu Perfil</h1>
        <Link
          href="/profile/configuracoes"
          aria-label="Configurações"
          className={cn(buttonVariants({ variant: "ghost" }), "size-11")}
        >
          <Settings size={20} aria-hidden="true" />
        </Link>
      </div>

      {/* Card de identidade */}
      <section className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="relative">
          <Avatar className="size-24">
            {profile.avatarUrl ? (
              <AvatarImage src={profile.avatarUrl} alt={`Foto de ${profile.name}`} />
            ) : null}
            <AvatarFallback className="text-2xl">
              {initials(profile.name)}
            </AvatarFallback>
          </Avatar>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <Button
            type="button"
            size="icon"
            aria-label="Alterar foto de perfil"
            disabled={cropOpen || updateProfile.isPending}
            onClick={() => fileInputRef.current?.click()}
            className="absolute right-0 bottom-0 size-8 rounded-full"
          >
            <Camera size={16} aria-hidden="true" />
          </Button>
        </div>

        <AvatarCropModal
          open={cropOpen}
          file={pendingFile}
          onConfirm={handleCropConfirm}
          onCancel={closeCrop}
        />

        <div className="flex flex-col gap-0.5">
          <p className="text-xl font-semibold text-foreground">{profile.name}</p>
          <p className="text-sm text-muted-foreground">@{profile.nickname}</p>
          {memberSince ? (
            <p className="text-xs text-muted-foreground">
              Participante desde {memberSince}
            </p>
          ) : null}
        </div>

        <Badge className="bg-primary text-primary-foreground">
          {STATUS_LABEL[profile.status] ?? profile.status}
        </Badge>
      </section>

      {/* Menu de navegação */}
      <nav aria-label="Menu do perfil" className="flex flex-col gap-2">
        <ProfileMenuItem
          icon={BarChart3}
          title="Estatísticas Pessoais"
          subtitle="Acompanhe seu desempenho"
          href="/profile/estatisticas"
        />
        <ProfileMenuItem
          icon={ListChecks}
          title="Histórico de Palpites"
          subtitle="Veja todos os seus palpites"
          href="/profile/historico"
        />
        <ProfileMenuItem
          icon={KeyRound}
          title="Alterar Senha"
          subtitle="Atualize sua senha de acesso"
          href="/profile/senha"
        />
        <ProfileMenuItem
          icon={Settings}
          title="Configurações"
          subtitle="Preferências do aplicativo"
          href="/profile/configuracoes"
        />
      </nav>

      {/* Administração do Grupo — group_admin (PRD-10, role-gated) */}
      {isGroupAdminRole(profile.role) ? (
        <section
          aria-labelledby="group-admin-section"
          className="flex flex-col gap-2"
        >
          <h2
            id="group-admin-section"
            className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Administração do Grupo
          </h2>
          <ProfileMenuItem
            icon={LayoutDashboard}
            title="Dashboard do Grupo"
            subtitle="Visão geral do grupo"
            href="/grupo/dashboard"
          />
          <ProfileMenuItem
            icon={UserCheck}
            title="Usuários Pendentes"
            subtitle="Aprovar ou rejeitar entradas"
            href="/grupo/usuarios/pendentes"
          />
          <ProfileMenuItem
            icon={Users}
            title="Usuários Aprovados"
            subtitle="Participantes ativos"
            href="/grupo/usuarios/aprovados"
          />
          <ProfileMenuItem
            icon={UserX}
            title="Usuários Bloqueados"
            subtitle="Gerenciar bloqueios"
            href="/grupo/usuarios/bloqueados"
          />
          <ProfileMenuItem
            icon={Mail}
            title="Convites"
            subtitle="Gerar links e códigos"
            href="/grupo/convites"
          />
          <ProfileMenuItem
            icon={Settings}
            title="Configurações do Grupo"
            subtitle="Editar informações do grupo"
            href="/grupo/configuracoes"
          />
        </section>
      ) : null}

      {/* Super Admin — área global (PRD-11, role-gated): todas as telas */}
      {isSuperAdminRole(profile.role) ? (
        <section
          aria-labelledby="super-admin-section"
          className="flex flex-col gap-2"
        >
          <h2
            id="super-admin-section"
            className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Super Admin
          </h2>
          <ProfileMenuItem
            icon={Globe}
            title="Dashboard Global"
            subtitle="Visão geral da plataforma"
            href="/admin/dashboard-global"
          />
          <ProfileMenuItem
            icon={FolderClock}
            title="Grupos Pendentes"
            subtitle="Aprovar novos grupos"
            href="/admin/grupos-pendentes"
          />
          <ProfileMenuItem
            icon={FolderCheck}
            title="Grupos Ativos"
            subtitle="Gerenciar grupos existentes"
            href="/admin/grupos-ativos"
          />
          <ProfileMenuItem
            icon={FolderX}
            title="Grupos Bloqueados"
            subtitle="Reativar ou excluir grupos"
            href="/admin/grupos-bloqueados"
          />
          <ProfileMenuItem
            icon={UserCog}
            title="Administradores"
            subtitle="Gerenciar Group Admins"
            href="/admin/administradores"
          />
          <ProfileMenuItem
            icon={Trophy}
            title="Resultados da Copa"
            subtitle="Partidas e resultados"
            href="/admin/jogos-da-copa"
          />
          <ProfileMenuItem
            icon={ScrollText}
            title="Logs Globais"
            subtitle="Auditoria do sistema"
            href="/admin/logs-globais"
          />
        </section>
      ) : null}

      {/* Administração (sistema) — PRD-07 legado, super admin */}
      {isSuperAdminRole(profile.role) ? (
        <section aria-labelledby="admin-section" className="flex flex-col gap-2">
          <h2
            id="admin-section"
            className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Administração (Sistema)
          </h2>
          <ProfileMenuItem
            icon={LayoutDashboard}
            title="Dashboard"
            subtitle="Visão geral do sistema"
            href="/admin/dashboard"
          />
          <ProfileMenuItem
            icon={UserCheck}
            title="Gerenciar Aprovações"
            subtitle="Usuários pendentes"
            href="/admin/usuarios/pendentes"
          />
          <ProfileMenuItem
            icon={Users}
            title="Usuários Ativos"
            subtitle="Aprovados"
            href="/admin/usuarios/aprovados"
          />
          <ProfileMenuItem
            icon={UserX}
            title="Usuários Bloqueados"
            subtitle="Bloqueados"
            href="/admin/usuarios/bloqueados"
          />
          <ProfileMenuItem
            icon={Activity}
            title="Status da API"
            subtitle="Saúde da API-Football"
            href="/admin/api-status"
          />
          <ProfileMenuItem
            icon={ScrollText}
            title="Logs do Sistema"
            subtitle="Eventos e auditoria"
            href="/admin/logs"
          />
        </section>
      ) : null}

      {/* Encerrar sessão */}
      <Link
        href="/profile/logout"
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-12 w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive",
        )}
      >
        <LogOut size={18} aria-hidden="true" />
        Encerrar Sessão
      </Link>
    </div>
  );
}
