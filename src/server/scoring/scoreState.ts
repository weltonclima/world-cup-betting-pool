import "server-only";

import type { Firestore } from "firebase-admin/firestore";

import { scoreStateSchema } from "@/schemas/scoreState";

// Doc único de controle do cron de pontuação — scoring-write-cost (TASK-02).
// Path fixo `score_state/cron`: 1 read no início do run, 1 write no fim (só se mudou).
const SCORE_STATE_COLLECTION = "score_state";
const SCORE_STATE_DOC_ID = "cron";

/**
 * Lê o estado de pontuação `score_state/cron` como `Map<matchId, resultHash>`.
 *
 * Defensivo (BR2): doc ausente OU `matches` ausente/malformado → `Map` vazio,
 * nunca lança. Garante que o 1º run (sem doc) e qualquer doc corrompido não
 * derrubem o cron — o pior caso degrada para "re-pontua tudo", nunca para erro.
 * Faz 1 read.
 */
export async function readScoreState(db: Firestore): Promise<Map<string, string>> {
  const snap = await db.collection(SCORE_STATE_COLLECTION).doc(SCORE_STATE_DOC_ID).get();
  if (!snap.exists) {
    return new Map();
  }

  const parsed = scoreStateSchema.safeParse(snap.data());
  if (!parsed.success) {
    // Doc presente mas fora do shape esperado: trata como vazio (degrada seguro).
    return new Map();
  }

  return new Map(Object.entries(parsed.data.matches));
}

/**
 * Grava o `Map<matchId, resultHash>` no doc `score_state/cron` (1 write).
 *
 * Serializa o `Map` → objeto plano, monta `{ matches, updatedAt }`, valida pelo
 * schema ANTES do `set` e grava o doc completo. `now` é injetado (BR4) — nunca
 * `new Date()` interno. Chamado apenas quando o mapa mudou (decisão do caller, TASK-03).
 *
 * Assimetria com `readScoreState` é INTENCIONAL: a leitura degrada seguro (Map vazio),
 * mas a escrita usa `.parse()` (lança) — validação do shape no write é invariante
 * dura. Um valor inválido aqui é bug do caller, não dado legado: falhar alto evita
 * persistir lixo. Efeito de um throw = doc não avança → próximo run re-pontua tudo
 * (mesma degradação segura da leitura, só que via exceção). `now` inválido lança em
 * `.toISOString()` antes do parse — o caller (TASK-03) deve passar um `Date` válido.
 */
export async function writeScoreState(
  db: Firestore,
  map: Map<string, string>,
  now: Date,
): Promise<void> {
  const payload = scoreStateSchema.parse({
    matches: Object.fromEntries(map),
    updatedAt: now.toISOString(),
  });

  await db
    .collection(SCORE_STATE_COLLECTION)
    .doc(SCORE_STATE_DOC_ID)
    .set(payload);
}
