import type { NotificationInput } from "@/schemas/notifications";
import type { SystemLogInput } from "@/schemas/systemLogs";
import type { UserStatus } from "@/types";

// Mapeia uma moderação de usuário (mudança de status pelo admin) nos efeitos
// colaterais de auditoria + notificação (PRD-07 logs + PRD-08 notificações).
// Puro/testável — a escrita real (createLog/createNotification) fica no hook.
//
// Decisão D-A5: apenas notificações de **Sistema** são geradas no V1 (aprovação/
// bloqueio/reativação), sempre client-side pelo admin (sem Cloud Function).

export interface ModerationContext {
  uid: string; // usuário-alvo
  from: UserStatus;
  to: UserStatus;
  actorUid: string; // admin que executou
}

/** Log de auditoria (`system_logs`) correspondente à moderação. */
export function moderationLog(ctx: ModerationContext): SystemLogInput {
  const { uid, from, to, actorUid } = ctx;
  if (to === "approved") {
    return {
      type: from === "blocked" ? "user_unblocked" : "user_approved",
      actorUid,
      targetUid: uid,
      message:
        from === "blocked"
          ? `Usuário ${uid} reativado por ${actorUid}.`
          : `Usuário ${uid} aprovado por ${actorUid}.`,
      level: "info",
    };
  }
  // to === "blocked" (bloqueio de aprovado OU rejeição de pendente).
  return {
    type: "user_blocked",
    actorUid,
    targetUid: uid,
    message:
      from === "pending"
        ? `Cadastro de ${uid} rejeitado por ${actorUid}.`
        : `Usuário ${uid} bloqueado por ${actorUid}.`,
    level: "warning",
  };
}

/**
 * Notificação de Sistema para o usuário-alvo correspondente à moderação.
 * Retorna `null` quando a transição não gera notificação ao usuário.
 */
export function moderationNotification(
  ctx: ModerationContext,
): NotificationInput | null {
  const { uid, from, to } = ctx;

  if (to === "approved" && from === "pending") {
    return {
      userId: uid,
      type: "system",
      title: "Cadastro aprovado",
      message:
        "Seu cadastro foi aprovado. Bem-vindo ao Bolão dos Parças! Já pode registrar seus palpites.",
    };
  }
  if (to === "approved" && from === "blocked") {
    return {
      userId: uid,
      type: "system",
      title: "Conta reativada",
      message: "Sua conta foi reativada. Você já pode acessar o bolão novamente.",
    };
  }
  if (to === "blocked") {
    return from === "pending"
      ? {
          userId: uid,
          type: "system",
          title: "Cadastro não aprovado",
          message: "Seu cadastro não foi aprovado pelo administrador.",
        }
      : {
          userId: uid,
          type: "system",
          title: "Conta bloqueada",
          message: "Sua conta foi bloqueada. Entre em contato com o administrador.",
        };
  }
  return null;
}
