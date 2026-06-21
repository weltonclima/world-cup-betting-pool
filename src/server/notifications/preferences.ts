import "server-only";

import type { Firestore } from "firebase-admin/firestore";

import type { NotificationType } from "@/schemas/notifications";
import {
  defaultPreferences,
  notificationPreferencesSchema,
  type NotificationPreferences,
} from "@/schemas/notificationPreferences";

const PREFERENCES_COLLECTION = "notificationPreferences";

/**
 * Lê preferências em batch via Admin SDK (`getAll`), cobrindo todos os uids pedidos.
 * Dedup de uids; doc ausente OU legado/inválido → `defaultPreferences` (tolerante).
 */
export async function fetchPreferencesMap(
  db: Firestore,
  uids: string[],
): Promise<Map<string, NotificationPreferences>> {
  const map = new Map<string, NotificationPreferences>();
  const unique = [...new Set(uids)];
  if (unique.length === 0) {
    return map;
  }

  // Cobertura estrutural (§6.4): semeia default para todo uid pedido, depois
  // sobrescreve com o doc válido. Não depende do shape de retorno do getAll —
  // garante que o caller nunca receba undefined em map.get(uid).
  for (const uid of unique) {
    map.set(uid, defaultPreferences(uid));
  }

  const coll = db.collection(PREFERENCES_COLLECTION);
  const refs = unique.map((uid) => coll.doc(uid));
  const snaps = await db.getAll(...refs);

  for (const snap of snaps) {
    if (!snap.exists) {
      continue;
    }
    const parsed = notificationPreferencesSchema.safeParse(snap.data());
    if (parsed.success) {
      map.set(snap.id, parsed.data);
    }
  }

  return map;
}

/**
 * Gate de preferência por tipo (in-app). `system` (moderação) sempre entrega —
 * ignora o toggle; `games`/`ranking` respeitam a escolha do usuário.
 */
export function shouldDeliver(
  type: NotificationType,
  prefs: NotificationPreferences,
): boolean {
  if (type === "system") {
    return true;
  }
  return prefs[type];
}

/**
 * Gate de preferência por tipo para **push** (web-push-pwa TASK-05). Difere do
 * in-app: o master switch `pushEnabled` governa TUDO — sem opt-in, nada de push.
 * Com push ligado, `system` entrega sempre (gated só pelo master, espelhando que
 * é crítico mas agora respeita o opt-out de push); `games`/`ranking` ainda
 * respeitam o toggle por-tipo.
 */
export function shouldDeliverPush(
  type: NotificationType,
  prefs: NotificationPreferences,
): boolean {
  if (!prefs.pushEnabled) {
    return false;
  }
  if (type === "system") {
    return true;
  }
  return prefs[type];
}
