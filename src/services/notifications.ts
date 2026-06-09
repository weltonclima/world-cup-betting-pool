import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { firestore } from "@/firebase";
import {
  notificationSchema,
  type Notification,
  type NotificationInput,
  type NotificationType,
} from "@/schemas/notifications";
import {
  defaultPreferences,
  notificationPreferencesSchema,
  type NotificationPreferences,
  type NotificationPreferencesInput,
} from "@/schemas/notificationPreferences";

/**
 * Camada de serviço de notificações (PRD-08). Funções puras de Firestore
 * (Client SDK — sem Cloud Function, compat. Spark). Erros propagam crus para a
 * UI traduzir; sem fallback silencioso (doc fora do schema rejeita com ZodError).
 *
 * NOTA: `createNotification` NÃO consulta preferências — o gating por
 * preferência (não criar se a categoria está off) é responsabilidade do caller
 * (notificationFactory, TASK-08), mantendo esta camada pura e testável.
 */

const NOTIFICATIONS = "notifications";
const PREFERENCES = "notificationPreferences";

const MAX_NOTIFICATIONS = 50; // <100 usuários → sem paginação (A5).

/** Lista notificações do usuário (mais recentes primeiro), opcionalmente por tipo. */
export async function listNotifications(
  uid: string,
  type?: NotificationType,
): Promise<Notification[]> {
  const base = collection(firestore, NOTIFICATIONS);
  const q = type
    ? query(
        base,
        where("userId", "==", uid),
        where("type", "==", type),
        orderBy("createdAt", "desc"),
        limit(MAX_NOTIFICATIONS),
      )
    : query(
        base,
        where("userId", "==", uid),
        orderBy("createdAt", "desc"),
        limit(MAX_NOTIFICATIONS),
      );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => notificationSchema.parse(d.data()));
}

/** Busca uma notificação por id; `null` se não existir. */
export async function getNotification(id: string): Promise<Notification | null> {
  const snap = await getDoc(doc(firestore, NOTIFICATIONS, id));
  if (!snap.exists()) return null;
  return notificationSchema.parse(snap.data());
}

/** Marca uma notificação como lida. */
export async function markAsRead(id: string): Promise<void> {
  await updateDoc(doc(firestore, NOTIFICATIONS, id), { isRead: true });
}

/** Marca todas as não-lidas do usuário como lidas (batch). */
export async function markAllAsRead(uid: string): Promise<void> {
  const q = query(
    collection(firestore, NOTIFICATIONS),
    where("userId", "==", uid),
    where("isRead", "==", false),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;
  const batch = writeBatch(firestore);
  snapshot.docs.forEach((d) => batch.update(d.ref, { isRead: true }));
  await batch.commit();
}

/**
 * Cria uma notificação. Id gerado client-side (`doc(collection)`) e gravado no
 * próprio doc; `isRead=false`; `createdAt` ISO 8601. NÃO consulta preferências
 * (ver NOTA no topo).
 */
export async function createNotification(
  input: NotificationInput,
): Promise<string> {
  const ref = doc(collection(firestore, NOTIFICATIONS));
  const payload: Notification = {
    id: ref.id,
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  // Valida antes de gravar (defesa: payload sempre conforme schema).
  await setDoc(ref, notificationSchema.parse(payload));
  return ref.id;
}

/** Lê as preferências do usuário; retorna defaults (tudo on) se o doc não existe. */
export async function getPreferences(
  uid: string,
): Promise<NotificationPreferences> {
  const snap = await getDoc(doc(firestore, PREFERENCES, uid));
  if (!snap.exists()) return defaultPreferences(uid);
  return notificationPreferencesSchema.parse(snap.data());
}

/** Grava (merge) as preferências do usuário. */
export async function updatePreferences(
  uid: string,
  prefs: NotificationPreferencesInput,
): Promise<void> {
  const payload: NotificationPreferences = { userId: uid, ...prefs };
  await setDoc(doc(firestore, PREFERENCES, uid), payload);
}
