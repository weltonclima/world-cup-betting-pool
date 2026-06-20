import "server-only";

import type { Firestore } from "firebase-admin/firestore";

import { defaultPreferences } from "@/schemas/notificationPreferences";
import type { RankingPositionDelta } from "@/server/rankings/recalc";

import { notifyRankingUp, type NotificationCreate } from "./factory";
import { fetchPreferencesMap, shouldDeliver } from "./preferences";
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
 *  - grava via `writeNotifications` com `now` injetado.
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
    // Só subida com baseline definida. `previousPosition === undefined` (marco
    // zero) ou queda/igual não geram notificação.
    const rises = deltas.filter(
      (d) =>
        d.previousPosition !== undefined && d.newPosition < d.previousPosition,
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

    await writeNotifications(db, items, now);
  } catch (err) {
    console.warn("[ranking] fan-out de notificações ranking falhou:", err);
  }
}
