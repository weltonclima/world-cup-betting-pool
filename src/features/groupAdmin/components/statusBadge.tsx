import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { UserStatus } from "@/types";

/** Rótulo + variante de badge por status do usuário (PNG: Pendente=âmbar, Aprovado=verde). */
const STATUS_META: Record<
  UserStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pendente",
    className: "bg-warning-bg text-warning",
  },
  approved: {
    label: "Aprovado",
    className: "bg-success-bg text-success",
  },
  blocked: {
    label: "Bloqueado",
    className: "bg-destructive/10 text-destructive",
  },
};

/** Badge de status do usuário com cores semânticas (âmbar/verde/vermelho). */
export function UserStatusBadge({ status }: { status: UserStatus }): JSX.Element {
  const meta = STATUS_META[status];
  return (
    <Badge variant="muted" className={meta.className}>
      {meta.label}
    </Badge>
  );
}

/** Formata um ISO em data pt-BR (dd/MM/yyyy), à prova de valor inválido. */
export function formatDatePtBr(iso: string | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
