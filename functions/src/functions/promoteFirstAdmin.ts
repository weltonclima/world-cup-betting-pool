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

/** Caminho do doc de flag que marca se o primeiro admin já foi atribuído. */
const BOOTSTRAP_DOC_PATH = "system_settings/bootstrap";

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
 * Robustez (B1 — corrida com TASK-06): a promoção usa `tx.set(..., { merge: true })`
 * em vez de `tx.update(...)`. O `Transaction.update()` do Admin SDK lança NOT_FOUND
 * se o doc `users/{uid}` tiver sido removido entre o evento de criação e a transação
 * (ex.: rollback `user.delete()` do TASK-06 em corrida, ou um retry do Functions),
 * gerando ruído de erro/retry. O `set` com merge tolera doc ausente sem lançar.
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

  const userRef = db.doc(`users/${uid}`);
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
