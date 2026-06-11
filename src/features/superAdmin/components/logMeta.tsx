import type { JSX } from "react";
import {
  Ban,
  CheckCircle2,
  Pencil,
  RefreshCw,
  ShieldCheck,
  UserCog,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import type { SystemLogType } from "@/schemas/systemLogs";

/**
 * Mapa tipo de log → ícone, cor e título pt-BR (PRD11-09/10). Cobre os tipos da
 * PRD-11 e os legados da PRD-07. Cores conforme PNG: sync/aprovado verde, editado
 * azul, bloqueado/rejeitado vermelho, troca de admin neutro.
 */
interface LogMeta {
  icon: LucideIcon;
  title: string;
  className: string;
}

const DEFAULT_META: LogMeta = {
  icon: CheckCircle2,
  title: "Evento do sistema",
  className: "bg-muted text-muted-foreground",
};

const LOG_META: Record<SystemLogType, LogMeta> = {
  // PRD-11
  worldcup_synced: {
    icon: RefreshCw,
    title: "Sincronização da Copa",
    className: "bg-success-bg text-success",
  },
  match_edited: {
    icon: Pencil,
    title: "Resultado editado",
    className: "bg-info-bg text-info",
  },
  group_approved: {
    icon: CheckCircle2,
    title: "Grupo aprovado",
    className: "bg-success-bg text-success",
  },
  group_rejected: {
    icon: XCircle,
    title: "Grupo rejeitado",
    className: "bg-destructive/10 text-destructive",
  },
  group_blocked: {
    icon: Ban,
    title: "Grupo bloqueado",
    className: "bg-destructive/10 text-destructive",
  },
  group_reactivated: {
    icon: ShieldCheck,
    title: "Grupo reativado",
    className: "bg-success-bg text-success",
  },
  pool_admin_changed: {
    icon: UserCog,
    title: "Administrador alterado",
    className: "bg-warning-bg text-warning",
  },
  // PRD-07 (legados — exibidos no mesmo feed/lista)
  login_admin: { icon: ShieldCheck, title: "Login de admin", className: "bg-muted text-muted-foreground" },
  user_approved: { icon: CheckCircle2, title: "Usuário aprovado", className: "bg-success-bg text-success" },
  user_blocked: { icon: Ban, title: "Usuário bloqueado", className: "bg-destructive/10 text-destructive" },
  user_unblocked: { icon: ShieldCheck, title: "Usuário reativado", className: "bg-success-bg text-success" },
  api_error: { icon: XCircle, title: "Erro de API", className: "bg-destructive/10 text-destructive" },
  ranking_update: { icon: RefreshCw, title: "Atualização de ranking", className: "bg-muted text-muted-foreground" },
};

export function logMeta(type: SystemLogType): LogMeta {
  return LOG_META[type] ?? DEFAULT_META;
}

/** Ícone do log dentro de um círculo colorido por tipo. */
export function LogIcon({ type }: { type: SystemLogType }): JSX.Element {
  const meta = logMeta(type);
  const Icon = meta.icon;
  return (
    <span
      aria-hidden="true"
      className={`flex size-10 shrink-0 items-center justify-center rounded-full ${meta.className}`}
    >
      <Icon size={18} />
    </span>
  );
}
