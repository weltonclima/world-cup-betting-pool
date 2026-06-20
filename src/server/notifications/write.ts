import "server-only";

import type { Firestore } from "firebase-admin/firestore";

import { notificationSchema } from "@/schemas/notifications";

import type { NotificationCreate } from "./factory";

const NOTIFICATIONS_COLLECTION = "notifications";
/** Limite de operações por `db.batch()` no Firestore. */
const MAX_BATCH = 500;

/**
 * Grava notificações em batches chunked (≤500/commit). ID determinístico →
 * `coll.doc(id)` (re-run sobrescreve o mesmo doc, idempotente); sem id →
 * `coll.doc()` (auto-id, sempre novo). Append-only: `set` grava o doc completo,
 * validado pelo schema antes do write. `now` injetado (nunca `new Date()` interno).
 */
export async function writeNotifications(
  db: Firestore,
  items: NotificationCreate[],
  now: Date,
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  const coll = db.collection(NOTIFICATIONS_COLLECTION);
  const createdAt = now.toISOString();

  for (let i = 0; i < items.length; i += MAX_BATCH) {
    const chunk = items.slice(i, i + MAX_BATCH);
    const batch = db.batch();

    for (const item of chunk) {
      const ref = item.id ? coll.doc(item.id) : coll.doc();
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
}
