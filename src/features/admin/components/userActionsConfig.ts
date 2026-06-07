import type { UserStatus } from "@/types";

/** Variante de Button suportada pelas ações (subset de @/components/ui/button). */
export type ActionVariant = "default" | "destructive" | "outline";

export interface UserActionDef {
  /** Identidade da ação (chave de UI/teste). */
  readonly id: "approve" | "reject" | "block" | "unblock";
  /** Status destino da transição (origem = a tab atual). */
  readonly to: UserStatus;
  /** Rótulo do botão na linha. */
  readonly label: string;
  /** Variante visual do botão. */
  readonly variant: ActionVariant;
  /**
   * Fluxo: "success" → dispara direto e abre ApprovedDialog (Aprovar);
   * "confirm" → abre ConfirmActionDialog antes de mutar (demais).
   */
  readonly flow: "success" | "confirm";
  /** Copy do diálogo de confirmação (ausente quando flow === "success"). */
  readonly confirm?: {
    readonly title: string;
    /** `{name}` é interpolado com user.name no componente. */
    readonly description: string;
    readonly confirmLabel: string;
    readonly confirmVariant: ActionVariant;
  };
  /** Toast de sucesso (ausente p/ Aprovar — feedback é o modal). */
  readonly successToast?: string;
}

/**
 * Mapa status (origem) → ações disponíveis + copy pt-BR (PRD-01.2, A1/A5).
 * `from` da transição = a chave do Record; `to` vem do def.
 */
export const USER_ACTIONS: Record<UserStatus, readonly UserActionDef[]> = {
  pending: [
    {
      id: "approve",
      to: "approved",
      label: "Aprovar",
      variant: "default",
      flow: "success",
    },
    {
      id: "reject",
      to: "blocked",
      label: "Rejeitar",
      variant: "destructive",
      flow: "confirm",
      confirm: {
        title: "Rejeitar usuário?",
        description:
          "{name} será bloqueado e não poderá acessar o bolão. Você pode desbloquear depois.",
        confirmLabel: "Rejeitar",
        confirmVariant: "destructive",
      },
      successToast: "Usuário rejeitado.",
    },
  ],
  approved: [
    {
      id: "block",
      to: "blocked",
      label: "Bloquear",
      variant: "destructive",
      flow: "confirm",
      confirm: {
        title: "Bloquear usuário?",
        description:
          "{name} perderá o acesso ao bolão imediatamente. Você pode desbloquear depois.",
        confirmLabel: "Bloquear",
        confirmVariant: "destructive",
      },
      successToast: "Usuário bloqueado.",
    },
  ],
  blocked: [
    {
      id: "unblock",
      to: "approved",
      label: "Desbloquear",
      variant: "outline",
      flow: "confirm",
      confirm: {
        title: "Desbloquear usuário?",
        description: "{name} voltará a ter acesso ao bolão.",
        confirmLabel: "Desbloquear",
        confirmVariant: "default",
      },
      successToast: "Usuário desbloqueado.",
    },
  ],
};
