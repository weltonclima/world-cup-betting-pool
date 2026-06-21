import "server-only";

import { getAdminFirestore, getAdminMessaging } from "@/server/firebaseAdmin";
import type { NotificationType } from "@/schemas/notifications";

import type { NotificationCreate } from "./factory";
import { fetchPreferencesMap, shouldDeliverPush } from "./preferences";
import { getUserTokens, pruneTokens } from "./tokens";

/**
 * Envio server-side de Web Push (web-push-pwa TASK-04).
 *
 * Camada aditiva e best-effort sobre o write in-app: para cada notificação já
 * produzida, dispara push FCM aos dispositivos do usuário, gated por
 * `shouldDeliverPush` (master switch `pushEnabled` + toggle por-tipo, TASK-05),
 * com fan-out por token e poda dos tokens mortos. Best-effort absoluto: nenhuma
 * falha de push pode derrubar scoring/recalc/moderação/promoção nem alterar o
 * response do route.
 *
 * Idempotência sob cron (só pushar docs recém-criados) é da TASK-07. O master
 * switch `pushEnabled` (TASK-05) governa todo o envio: sem opt-in explícito,
 * nenhum push sai — inclusive `system`. O dedup de foreground (app aberto) é
 * resolvido no client (`useForegroundPush`), não aqui.
 */

/** Limite de tokens por `sendEachForMulticast` (FCM_MAX_BATCH_SIZE). */
const MAX_MULTICAST = 500;

/** Ícone PWA default exibido na notificação (TASK-01). */
const PUSH_ICON = "/icons/icon-192.png";

/** Códigos do FCM que significam token morto → poda. */
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

/** Payload FCM — alinhado ao consumer `firebase-messaging-sw.js` (TASK-02). */
export interface PushPayload {
  notification: { title: string; body: string; icon?: string };
  data: { url: string; type: NotificationType };
}

export interface PushSendStats {
  attempted: number; // tokens endereçados
  success: number; // somatório de BatchResponse.successCount
  failure: number; // somatório de BatchResponse.failureCount
  pruned: number; // tokens mortos apagados
}

/** Deep-link do `notificationclick` por tipo. SW cai para "/" se ausente. */
function urlForType(type: NotificationType): string {
  switch (type) {
    case "ranking":
      return "/rankings";
    case "games":
    case "system":
      return "/notifications";
  }
}

/** Monta o payload FCM a partir da notificação in-app. */
function toPushPayload(item: NotificationCreate): PushPayload {
  return {
    notification: { title: item.title, body: item.message, icon: PUSH_ICON },
    data: { url: urlForType(item.type), type: item.type },
  };
}

function emptyStats(): PushSendStats {
  return { attempted: 0, success: 0, failure: 0, pruned: 0 };
}

/**
 * Envia push para os dispositivos dos usuários das notificações dadas.
 *
 * 1. agrupa por `userId` e aplica o gate de preferência (system sempre;
 *    games/ranking pelo toggle) — só pusha o que o in-app também entregaria;
 * 2. por uid: lê tokens (multi-device) e, por notificação, faz fan-out em
 *    chunks ≤500 via `sendEachForMulticast`;
 * 3. casa `responses[i]` ↔ `tokens[i]` e poda tokens mortos (1 delete por uid);
 * 4. loga counts (observabilidade) e nunca lança (best-effort).
 */
export async function sendPushForNotifications(
  items: NotificationCreate[],
  // TASK-07: a idempotência sob cron é resolvida ANTES daqui — `writeNotifications`
  // já devolve só os docs recém-criados e o call site passa essa lista. `now` fica
  // sem uso interno; mantido por paridade de assinatura com `writeNotifications`.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  now: Date,
): Promise<PushSendStats> {
  const stats = emptyStats();
  if (items.length === 0) return stats;

  try {
    const db = getAdminFirestore();
    const prefs = await fetchPreferencesMap(
      db,
      items.map((i) => i.userId),
    );

    // Gate de push (TASK-05): master switch `pushEnabled` + toggle por-tipo.
    // Difere do in-app — sem opt-in de push, nada é enviado (mesmo `system`).
    const eligible = items.filter((i) => {
      const pref = prefs.get(i.userId);
      return pref !== undefined && shouldDeliverPush(i.type, pref);
    });
    if (eligible.length === 0) return stats;

    // Agrupa por uid → 1 leitura de tokens por usuário.
    const byUid = new Map<string, NotificationCreate[]>();
    for (const item of eligible) {
      const list = byUid.get(item.userId) ?? [];
      list.push(item);
      byUid.set(item.userId, list);
    }

    const messaging = getAdminMessaging();

    for (const [uid, group] of byUid) {
      // Isola cada uid: um reject de `sendEachForMulticast` (payload inválido/
      // oversized — não token morto, esse vem no BatchResponse) não pode abortar
      // os uids restantes do batch (entrega degradaria além do ofensor sob cron).
      try {
        const tokens = await getUserTokens(uid);
        if (tokens.length === 0) continue;

        const dead = new Set<string>();

        for (const item of group) {
          const { notification, data } = toPushPayload(item);

          for (let i = 0; i < tokens.length; i += MAX_MULTICAST) {
            const chunk = tokens.slice(i, i + MAX_MULTICAST);
            stats.attempted += chunk.length;

            const res = await messaging.sendEachForMulticast({
              tokens: chunk,
              notification,
              data,
            });
            stats.success += res.successCount;
            stats.failure += res.failureCount;

            // responses[j] casa por índice com chunk[j].
            res.responses.forEach((r, j) => {
              const code = r.error?.code;
              const token = chunk[j];
              if (token !== undefined && code !== undefined && DEAD_TOKEN_CODES.has(code)) {
                dead.add(token);
              }
            });
          }
        }

        if (dead.size > 0) {
          await pruneTokens([...dead]);
          stats.pruned += dead.size;
        }
      } catch (err) {
        console.error(`[notifications/push] falha no envio ao uid=${uid}:`, err);
      }
    }

    console.info(
      `[notifications/push] enviados=${stats.success} falhas=${stats.failure} podados=${stats.pruned} (tokens=${stats.attempted})`,
    );
    return stats;
  } catch (err) {
    console.error("[notifications/push] falha no envio best-effort:", err);
    return stats;
  }
}
