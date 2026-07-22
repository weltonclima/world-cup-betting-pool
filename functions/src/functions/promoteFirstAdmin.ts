/**
 * Trigger Firestore `promoteFirstAdmin` — promove o PRIMEIRO usuário a admin (AUTH TASK-05 / A1).
 *
 * Por quê (R1): as Security Rules (`firestore.rules`) bloqueiam o client de escrever
 * `role: "admin"` / `status: "approved"` em `users/{uid}` (o auto-cadastro nasce sempre
 * `user`/`pending`). Sem um caminho privilegiado, o sistema nunca teria um admin e
 * ninguém poderia aprovar usuários. Esta função roda server-side via Admin SDK, que
 * bypassa as rules por design.
 *
 * Como (B1 — corrida): a decisão "este é o usuário inaugural?" é feita dentro de uma
 * transação Firestore sobre a flag `system_settings/bootstrap.firstAdminAssigned`.
 * Cadastros simultâneos disparam eventos concorrentes; a transação serializa as
 * decisões sobre o mesmo doc `bootstrap` → apenas o primeiro a commitar promove, os
 * demais releem a flag já `true` e fazem no-op. Idempotente também contra retries do
 * Functions (reentrância do mesmo evento).
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import {
  getFirestore,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";
import "../firebase/admin"; // garante inicialização (singleton) do Admin SDK
import { syncRoleClaim } from "./syncRoleClaim";

/** Caminho do doc de flag que marca se o primeiro admin já foi atribuído. */
const BOOTSTRAP_DOC_PATH = "system_settings/bootstrap";

/**
 * Papéis já privilegiados que o bootstrap NÃO pode rebaixar (multi-championship
 * TASK-16). Se o primeiro usuário do sistema for um criador auto-serviço (que já
 * nasce `group_admin` via a rota Admin SDK), este trigger não deve clobbar seu
 * papel para `admin`. Cobre também `super_admin` (seed manual) e o legado `admin`.
 */
const PRIVILEGED_ROLES = new Set(["group_admin", "super_admin", "admin"]);

/** Resultado da decisão transacional. */
export interface PromotionResult {
  /** `true` se ESTE usuário foi promovido a admin nesta execução. */
  promoted: boolean;
}

/**
 * Núcleo testável: dentro de uma transação, decide e (se for o caso) promove.
 *
 * - Lê `system_settings/bootstrap`. Se `firstAdminAssigned` ainda não é `true`,
 *   marca a flag (merge) e promove `users/{uid}` para `admin`/`approved` via
 *   `tx.set(..., { merge: true })`.
 * - Caso contrário, no-op.
 *
 * Robustez (B1 — corrida com TASK-06/TASK-16): se `users/{uid}` já não existe na
 * transação (rollback `user.delete()` em corrida, ou retry do Functions), a função
 * faz no-op ANTES de qualquer escrita — não usa `tx.update()` (que lançaria
 * NOT_FOUND) nem `tx.set(merge)` (que RESSUSCITARIA o doc como admin, criando um
 * fantasma privilegiado e consumindo indevidamente a flag de bootstrap — H1).
 * A promoção do caminho feliz usa `tx.set(..., { merge: true })`.
 *
 * @param tx - Transação Firestore ativa.
 * @param db - Instância do Firestore (para resolver refs).
 * @param uid - UID do usuário recém-criado.
 */
export async function promoteFirstAdminTx(
  tx: Transaction,
  db: Firestore,
  uid: string,
): Promise<PromotionResult> {
  const bootstrapRef = db.doc(BOOTSTRAP_DOC_PATH);
  const snapshot = await tx.get(bootstrapRef);
  const alreadyAssigned = snapshot.data()?.["firstAdminAssigned"] === true;

  if (alreadyAssigned) {
    return { promoted: false };
  }

  // Guarda anti-clobber (TASK-16): se o doc do usuário já carrega papel canônico
  // privilegiado, NÃO promove e NÃO consome a flag de bootstrap. Um participante
  // legítimo posterior ainda poderá bootstrapar o primeiro admin.
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await tx.get(userRef);

  // Corrida com o rollback do onboarding (TASK-16 / H1): se o doc já foi apagado
  // entre o evento de criação e esta transação, NÃO ressuscita o usuário como
  // admin (`set(merge)` recriaria um fantasma privilegiado) nem consome a flag de
  // bootstrap. No-op deixa o primeiro admin para um participante legítimo futuro.
  if (!userSnap.exists) {
    return { promoted: false };
  }

  // Guarda anti-clobber (TASK-16): papel canônico já privilegiado → no-op.
  const currentRole = userSnap.data()?.["role"];
  if (typeof currentRole === "string" && PRIVILEGED_ROLES.has(currentRole)) {
    return { promoted: false };
  }

  tx.set(bootstrapRef, { firstAdminAssigned: true }, { merge: true });
  tx.set(
    userRef,
    {
      role: "admin",
      status: "approved",
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return { promoted: true };
}

/**
 * Trigger Firestore: ao criar `users/{uid}`, tenta promover o usuário inaugural.
 */
export const promoteFirstAdmin = onDocumentCreated(
  "users/{uid}",
  async (event) => {
    const uid = event.params.uid;

    const db = getFirestore();
    const result = await db.runTransaction((tx) =>
      promoteFirstAdminTx(tx, db, uid),
    );

    if (result.promoted) {
      // Reflete o role no custom claim do token (base p/ middleware TASK-10).
      // Feito FORA da transação: claims do Auth não participam da transação do
      // Firestore. Se falhar, o doc já está consistente (role:"admin") e o
      // trigger onUpdate (syncRoleClaimOnUserUpdate) NÃO dispara aqui (foi um
      // create) — por isso logamos como erro p/ correção manual/retry.
      try {
        await syncRoleClaim(uid, "admin");
        logger.info(
          `promoteFirstAdmin: custom claim role=admin gravado para ${uid}.`,
        );
      } catch (err) {
        logger.error(
          `promoteFirstAdmin: doc promovido mas falha ao gravar custom claim de ${uid}. ` +
            `Token não terá role=admin até nova gravação.`,
          err,
        );
      }

      logger.info(
        `promoteFirstAdmin: usuário ${uid} promovido a admin/approved (primeiro usuário).`,
      );
    } else {
      logger.info(
        `promoteFirstAdmin: usuário ${uid} mantido como user/pending (admin já existe).`,
      );
    }
  },
);
