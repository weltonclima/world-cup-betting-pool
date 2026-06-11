import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeGroupAdminOfPool } from "@/app/api/group/_authorize";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import {
  canTransition,
  isSuperAdminRole,
  roleSchema,
  userSchema,
  userStatusSchema,
} from "@/schemas";
import type { UserStatus } from "@/types";

/**
 * Núcleo compartilhado das rotas de moderação `/api/group/users/{action}`
 * (PRD-10, TASK-05). REUSA o motor de status (`canTransition`) — não o reescreve.
 *
 * Toda ação:
 *  - autoriza via `authorizeGroupAdminOfPool` (groupId da sessão — D2);
 *  - valida `target.groupId === sessão.groupId` (isolamento);
 *  - PROTEGE o super_admin (nunca moderável por um group_admin);
 *  - aplica a transição via `canTransition` (rejeita inválida com 409);
 *  - grava SOMENTE os campos da ação (status + auditoria + campos net-new).
 */

const bodySchema = z.object({
  uid: z.string().min(1),
  reason: z.string().max(280).optional(),
});

/** Erro de domínio da moderação, carregando o status HTTP a devolver. */
export class ModerationError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ModerationError";
    this.status = status;
  }
}

export type StatusModerationKind = "approve" | "reject" | "block" | "unblock";

/** Mapa ação → transição de status (rejeitar ≡ blocked — A1). */
const TRANSITIONS: Record<
  StatusModerationKind,
  { from: UserStatus; to: UserStatus }
> = {
  approve: { from: "pending", to: "approved" },
  reject: { from: "pending", to: "blocked" },
  block: { from: "approved", to: "blocked" },
  unblock: { from: "blocked", to: "approved" },
};

interface TargetUser {
  status: UserStatus;
  groupId: string | undefined;
  isSuperAdmin: boolean;
}

/** Lê e valida o alvo: existe, é do pool, e não é super_admin. */
async function loadTarget(
  uid: string,
  groupId: string,
): Promise<TargetUser> {
  const db = getAdminFirestore();
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) throw new ModerationError(404, "Usuário não encontrado.");

  const data = snap.data();
  const status = userStatusSchema.safeParse(data?.["status"]);
  if (!status.success) {
    throw new ModerationError(422, "Usuário com status inválido.");
  }

  const targetGroupId =
    typeof data?.["groupId"] === "string" ? data["groupId"] : undefined;
  // Isolamento: alvo de outro pool é invisível para este admin.
  if (targetGroupId !== groupId) {
    throw new ModerationError(403, "Usuário não pertence ao seu grupo.");
  }

  const role = roleSchema.safeParse(data?.["role"]);
  const isSuper = role.success && isSuperAdminRole(role.data);

  return { status: status.data, groupId: targetGroupId, isSuperAdmin: isSuper };
}

/**
 * Aplica uma transição de status (approve/reject/block/unblock). Best-effort dos
 * side-effects (log/notificação) fica no client (hook) — aqui só a escrita
 * autoritativa do Firestore.
 */
export async function handleStatusModeration(
  request: Request,
  kind: StatusModerationKind,
): Promise<NextResponse> {
  const result = await authorizeGroupAdminOfPool();
  if ("errorResponse" in result) return result.errorResponse;
  const { groupId } = result.auth;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }
  const { uid, reason } = parsed.data;

  const { from, to } = TRANSITIONS[kind];
  const db = getAdminFirestore();
  const updatedAt = new Date().toISOString();

  try {
    const target = await loadTarget(uid, groupId);

    // Super admin é intocável por um group_admin (proteção de papel).
    if (target.isSuperAdmin) {
      throw new ModerationError(403, "Não é possível moderar este usuário.");
    }

    // Estado atual precisa casar com a origem esperada da ação.
    if (target.status !== from) {
      throw new ModerationError(
        409,
        "O usuário não está no estado esperado para esta ação.",
      );
    }
    if (!canTransition(from, to)) {
      throw new ModerationError(409, "Transição de status não permitida.");
    }

    const patch: Record<string, unknown> = { status: to, updatedAt };
    // Captura/limpa o motivo do bloqueio conforme a ação.
    if (kind === "block") {
      if (reason && reason.trim().length > 0) patch["blockReason"] = reason.trim();
    } else if (kind === "unblock") {
      patch["blockReason"] = ""; // limpa o motivo ao reativar
    }

    await db.collection("users").doc(uid).update(patch);

    const updatedSnap = await db.collection("users").doc(uid).get();
    const updated = userSchema.parse(updatedSnap.data());
    return NextResponse.json({ user: updated }, { status: 200 });
  } catch (err) {
    if (err instanceof ModerationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(`[group/users/${kind}] erro inesperado:`, err);
    return NextResponse.json(
      { error: "Erro ao moderar o usuário." },
      { status: 500 },
    );
  }
}

/**
 * Remove (soft-delete, D4) um usuário BLOQUEADO do grupo: preserva o doc
 * (auditoria/histórico), marca `removedFromGroupAt` e limpa `groupId`. Mantém
 * `status: blocked`. Só atua sobre bloqueados do próprio pool; super_admin intocável.
 */
export async function handleRemove(request: Request): Promise<NextResponse> {
  const result = await authorizeGroupAdminOfPool();
  if ("errorResponse" in result) return result.errorResponse;
  const { groupId } = result.auth;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }
  const { uid } = parsed.data;

  const db = getAdminFirestore();
  const updatedAt = new Date().toISOString();

  try {
    const target = await loadTarget(uid, groupId);
    if (target.isSuperAdmin) {
      throw new ModerationError(403, "Não é possível remover este usuário.");
    }
    if (target.status !== "blocked") {
      throw new ModerationError(
        409,
        "Apenas usuários bloqueados podem ser removidos.",
      );
    }

    // Soft-delete: preserva o doc, desvincula do pool e marca o momento.
    // `groupId` é REMOVIDO (FieldValue.delete), não zerado: `userSchema` exige
    // `nonEmptyString.optional()` — gravar "" violaria o schema e quebraria
    // qualquer `userSchema.parse` posterior nesse doc (review WR-01).
    const { FieldValue } = await import("firebase-admin/firestore");
    await db.collection("users").doc(uid).update({
      removedFromGroupAt: updatedAt,
      groupId: FieldValue.delete(),
      updatedAt,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    if (err instanceof ModerationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[group/users/remove] erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro ao remover o usuário." },
      { status: 500 },
    );
  }
}
