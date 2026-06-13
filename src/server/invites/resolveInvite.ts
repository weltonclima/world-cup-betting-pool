import "server-only";

import { getAdminFirestore } from "@/server/firebaseAdmin";
import { inviteCodeSchema, inviteSchema, poolSchema } from "@/schemas";

/**
 * Util server-only compartilhado de validação de convite (PRD-10, TASK-04).
 *
 * Fonte única da regra consumida por DOIS caminhos:
 *  - o Server Component `/invite/[code]` (resgate visual);
 *  - a rota pública `GET /api/invite/[code]/resolve` (resolução p/ o SignupForm).
 *
 * Centralizar aqui evita drift de regra entre os dois. As Rules bloqueiam a
 * coleção `invites` no client, então a leitura só é possível via Admin SDK.
 *
 * NUNCA lança: qualquer falha (inclusive Firestore indisponível) vira um
 * resultado `{ ok: false }`. O discriminante `code` distingue o estado
 * "expirado" (UI dedicada — TASK-03) de todos os demais ("generic").
 */

/** Convite válido resolvido para o mínimo necessário ao cadastro. */
export interface ValidInvite {
  groupId: string;
  groupName: string;
}

/** Resultado discriminado da validação. `code` decide a UI sem comparar mensagens. */
export type Resolution =
  | { ok: true; invite: ValidInvite }
  | { ok: false; reason: string; code: "expired" | "generic" };

/** Valida o convite server-side e resolve o nome do pool. Nunca lança. */
export async function resolveInvite(rawCode: string): Promise<Resolution> {
  const parsedCode = inviteCodeSchema.safeParse(rawCode);
  if (!parsedCode.success) {
    return { ok: false, code: "generic", reason: "Este link de convite é inválido." };
  }

  try {
    const db = getAdminFirestore();
    const snap = await db.collection("invites").doc(parsedCode.data).get();
    if (!snap.exists) {
      return { ok: false, code: "generic", reason: "Convite não encontrado." };
    }
    // .strip() tolera campos extras no doc Firestore sem quebrar o parse
    // (schema evoluiu com .strict() mas docs legados podem ter campos adicionais).
    const invite = inviteSchema.strip().parse(snap.data());

    if (!invite.isActive) {
      return { ok: false, code: "generic", reason: "Este convite não está mais ativo." };
    }
    if (Date.parse(invite.expiresAt) <= Date.now()) {
      return { ok: false, code: "expired", reason: "Este convite expirou." };
    }
    if (invite.usedCount >= invite.maxUses) {
      return { ok: false, code: "generic", reason: "Este convite atingiu o limite de usos." };
    }

    const poolSnap = await db.collection("pools").doc(invite.groupId).get();
    if (!poolSnap.exists) {
      return {
        ok: false,
        code: "generic",
        reason: "O grupo deste convite não está mais disponível.",
      };
    }
    const pool = poolSchema.strip().parse(poolSnap.data());
    if (pool.status === "blocked") {
      return { ok: false, code: "generic", reason: "O grupo deste convite está bloqueado." };
    }

    return {
      ok: true,
      invite: { groupId: invite.groupId, groupName: pool.name },
    };
  } catch {
    return {
      ok: false,
      code: "generic",
      reason: "Não foi possível validar o convite. Tente novamente.",
    };
  }
}
