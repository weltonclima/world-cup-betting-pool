/**
 * Trigger Firestore onUpdate `users/{uid}` — mantém o custom claim `role`
 * sincronizado com o documento (TASK-08).
 *
 * Por quê: hoje o `role` só muda server-side em `promoteFirstAdmin` (onCreate).
 * Mas qualquer fluxo admin futuro de promoção/rebaixamento alterará apenas o
 * doc `users/{uid}` (o painel admin atual só toca `status`). Para que o claim
 * NUNCA divirja do doc — independentemente de quem/como o role foi alterado —
 * este trigger reage a TODA atualização de `users/{uid}` e, se `role` mudou,
 * reflete o novo valor no token via `setCustomUserClaims`.
 *
 * Idempotência/ruído: faz no-op quando `role` não mudou (caso comum: o painel
 * admin alterando só `status`/`updatedAt`), evitando chamadas desnecessárias ao
 * Auth e loops. A escrita de claim NÃO modifica o doc, então não re-dispara este
 * trigger.
 *
 * Cobertura de cenários:
 *  - user → admin: grava `{ role: "admin" }` (promoção).
 *  - admin → user: grava `{ role: null }` (rebaixamento; remove privilégio).
 *  - role inalterado: no-op.
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { syncRoleClaim, type Role } from "./syncRoleClaim";

/** Papéis aceitos para sincronização de claim. */
const VALID_ROLES: readonly Role[] = ["user", "admin"];

/** Type guard: o valor é um `Role` conhecido. */
function isRole(value: unknown): value is Role {
  return typeof value === "string" && (VALID_ROLES as readonly string[]).includes(value);
}

/** Decisão pura/testável a partir dos valores de role antes/depois. */
export interface ClaimSyncDecision {
  /** `true` se o claim deve ser regravado. */
  shouldSync: boolean;
  /** Novo role a refletir no claim (definido só quando `shouldSync`). */
  role?: Role;
}

/**
 * Decide se o claim precisa ser ressincronizado, dado o role antes e depois.
 *
 * - Sincroniza quando o role MUDOU e o novo valor é um Role válido.
 * - No-op quando: role inalterado, doc deletado (`after` undefined), ou novo
 *   role ausente/inválido (defensivo — não toca o token com lixo).
 */
export function decideClaimSync(
  beforeRole: unknown,
  afterRole: unknown,
): ClaimSyncDecision {
  if (beforeRole === afterRole) return { shouldSync: false };
  if (!isRole(afterRole)) return { shouldSync: false };
  return { shouldSync: true, role: afterRole };
}

/**
 * Trigger Firestore: ao atualizar `users/{uid}`, ressincroniza o custom claim
 * `role` se o campo `role` mudou.
 */
export const syncRoleClaimOnUserUpdate = onDocumentUpdated(
  "users/{uid}",
  async (event) => {
    const uid = event.params.uid;
    const beforeRole = event.data?.before.data()?.["role"];
    const afterRole = event.data?.after.data()?.["role"];

    const decision = decideClaimSync(beforeRole, afterRole);
    if (!decision.shouldSync || decision.role === undefined) {
      return;
    }

    try {
      await syncRoleClaim(uid, decision.role);
      logger.info(
        `syncRoleClaimOnUserUpdate: claim role=${decision.role} sincronizado para ${uid}.`,
      );
    } catch (err) {
      // Falha de I/O no Auth: logar p/ diagnóstico. O Functions pode retentar;
      // a operação é idempotente (regravar o mesmo claim é seguro).
      logger.error(
        `syncRoleClaimOnUserUpdate: falha ao sincronizar claim de ${uid}.`,
        err,
      );
      throw err;
    }
  },
);
