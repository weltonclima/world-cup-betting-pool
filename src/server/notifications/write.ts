import "server-only";

import type { Firestore } from "firebase-admin/firestore";

import { notificationSchema } from "@/schemas/notifications";

import type { NotificationCreate } from "./factory";

const NOTIFICATIONS_COLLECTION = "notifications";
/** Limite de operações por `db.batch()` / refs por `getAll` no Firestore. */
const MAX_BATCH = 500;

/**
 * Grava notificações e retorna os itens **recém-criados** (web-push-pwa TASK-07).
 *
 * Idempotência sob cron: o push só deve disparar para o que foi de fato criado
 * nesta execução. Por isso:
 *  - **ID determinístico** (games/ranking): pré-checa existência via `getAll`
 *    (chunked ≤500) e grava SOMENTE os docs inexistentes — re-run do cron não
 *    regrava (preserva `isRead`) nem repusha. Itens já existentes não entram no
 *    retorno.
 *  - **auto-id** (moderação/promoção): `coll.doc()` nunca colide → todo item é
 *    novo → sempre gravado e retornado (repeat legítimo deve sempre entregar).
 *  - **dedup intra-chamada**: dois itens com o mesmo id contam como 1 doc.
 *
 * Append-only: `set` grava o doc completo, validado pelo schema antes do write.
 * `now` injetado (nunca `new Date()` interno). Mantém o chunking ≤500/commit.
 */
export async function writeNotifications(
  db: Firestore,
  items: NotificationCreate[],
  now: Date,
): Promise<NotificationCreate[]> {
  if (items.length === 0) {
    return [];
  }

  const coll = db.collection(NOTIFICATIONS_COLLECTION);
  const createdAt = now.toISOString();

  // Predicado ÚNICO de "ID determinístico" — usado no pré-check, na seleção e na
  // escrita para não divergirem. `""` conta como auto-id (consistente em todos os
  // pontos), evitando que pré-check e write discordem do mesmo item.
  const isDeterministic = (i: NotificationCreate): i is NotificationCreate & { id: string } =>
    typeof i.id === "string" && i.id.length > 0;

  // IDs determinísticos únicos (1ª ocorrência), preservando a ordem de entrada.
  const detIds: string[] = [];
  const seenIds = new Set<string>();
  for (const item of items) {
    if (isDeterministic(item) && !seenIds.has(item.id)) {
      seenIds.add(item.id);
      detIds.push(item.id);
    }
  }

  // Pré-check de existência dos refs determinísticos (getAll chunked ≤500).
  const existingIds = new Set<string>();
  for (let i = 0; i < detIds.length; i += MAX_BATCH) {
    const chunkIds = detIds.slice(i, i + MAX_BATCH);
    const refs = chunkIds.map((id) => coll.doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (snap.exists) existingIds.add(snap.id);
    }
  }

  // Seleciona o que criar (preserva ordem; dedup determinístico; auto-id sempre).
  const created: NotificationCreate[] = [];
  const writtenIds = new Set<string>();
  for (const item of items) {
    if (!isDeterministic(item)) {
      created.push(item);
      continue;
    }
    if (existingIds.has(item.id) || writtenIds.has(item.id)) continue;
    writtenIds.add(item.id);
    created.push(item);
  }

  if (created.length === 0) {
    return created;
  }

  for (let i = 0; i < created.length; i += MAX_BATCH) {
    const chunk = created.slice(i, i + MAX_BATCH);
    const batch = db.batch();

    for (const item of chunk) {
      const ref = isDeterministic(item) ? coll.doc(item.id) : coll.doc();
      const payload = notificationSchema.parse({
        id: ref.id,
        userId: item.userId,
        type: item.type,
        title: item.title,
        message: item.message,
        isRead: false,
        createdAt,
      });
      batch.set(ref, payload);
    }

    await batch.commit();
  }

  return created;
}
