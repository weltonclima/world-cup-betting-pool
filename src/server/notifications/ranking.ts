import "server-only";

import type { Firestore } from "firebase-admin/firestore";

import { defaultPreferences } from "@/schemas/notificationPreferences";
import type { RankingPositionDelta } from "@/server/rankings/recalc";

import { notifyRankingUp, type NotificationCreate } from "./factory";
import { fetchPreferencesMap, shouldDeliver } from "./preferences";
import { sendPushForNotifications } from "./push";
import { writeNotifications } from "./write";

/**
 * Disparo best-effort das notificações `ranking` (TASK-05). Recebe os deltas de
 * posição do recalc e cria UMA notificação de subida por usuário elegível:
 *
 *  - filtra só-subida com baseline definida (`previousPosition` numérico e
 *    `newPosition < previousPosition`) — queda/igual/sem-baseline não notificam;
 *  - lê preferências em batch e aplica `shouldDeliver("ranking", …)`;
 *  - monta via `notifyRankingUp` (ID determinístico `ranking-{uid}-{dateKey}`,
 *    `dateKey` derivado de `now` em UTC → idempotente por dia, pódio top 3);
 *  - grava via `writeNotifications` com `now` injetado e faz push (TASK-07)
 *    APENAS nos docs recém-criados (retorno do write) → re-run/recalc repetido
 *    no mesmo dia não repusha (1 notificação de subida por dia, 1ª vence).
 *
 * Try/catch interno: qualquer falha (preferências/escrita) loga e NUNCA lança —
 * notificação jamais derruba o recalc nem altera o response do route.
 */
export async function notifyRankingUps(
  db: Firestore,
  deltas: RankingPositionDelta[],
  now: Date,
): Promise<void> {
  try {
    // Só subida PARA/DENTRO do top 3 (pódio), com baseline definida. Decisão de
    // produto: ranking só notifica os 3 primeiros lugares. `previousPosition ===
    // undefined` (marco zero), queda/igual ou subida fora do top 3 não notificam.
    // Resolve também HG-01: subida não-pódio não consome o slot diário do ID.
    const rises = deltas.filter(
      (d) =>
        d.previousPosition !== undefined &&
        d.newPosition < d.previousPosition &&
        d.newPosition <= 3,
    );
    if (rises.length === 0) return;

    const prefs = await fetchPreferencesMap(
      db,
      rises.map((d) => d.uid),
    );
    const dateKey = now.toISOString().slice(0, 10); // UTC YYYY-MM-DD

    const items: NotificationCreate[] = [];
    for (const d of rises) {
      // Doc ausente (uid não no map) → default all-true → ENTREGA (spec §6). Não
      // depende do seed do fetchPreferencesMap: undefined cai no default explícito.
      const pref = prefs.get(d.uid) ?? defaultPreferences(d.uid);
      if (!shouldDeliver("ranking", pref)) continue;
      items.push(
        notifyRankingUp({
          uid: d.uid,
          newPosition: d.newPosition,
          // filtro acima garante baseline numérica.
          previousPosition: d.previousPosition!,
          dateKey,
        }),
      );
    }

    // TASK-07: push só nos docs recém-criados → re-run do recalc/cron não repusha
    // (in-app já é idempotente por `ranking-{uid}-{dateKey}`).
    const created = await writeNotifications(db, items, now);
    await sendPushForNotifications(created, now);
  } catch (err) {
    console.warn("[ranking] fan-out de notificações ranking falhou:", err);
  }
}
