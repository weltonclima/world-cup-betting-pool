import "server-only";

import type { Firestore } from "firebase-admin/firestore";

import { championshipStatusSchema } from "@/schemas/championships";
import type { ChampionshipStatus } from "@/types/championships";
import {
  getChampionship,
  listChampionships,
} from "@/server/copaData/championshipCatalog";

/**
 * Resolução de STATUS de campeonato com override de runtime (multi-championship
 * TASK-13).
 *
 * O catálogo (`getChampionship`) é estático/frozen: metadados imutáveis (`type`,
 * `espnSlug`, janelas) SEMPRE vêm dele e permanece síncrono. Só o `status` ganha
 * uma camada de override, gravada pelo pipeline de arquivamento no doc
 * `championships/{id}` (Admin-SDK-write only). Quando não há doc, o default
 * estático do catálogo segue válido (compat: `fifa.world` continua `archived`
 * sem doc). Este módulo é o ÚNICO ponto de I/O do status — os gates de
 * recalc/scoring passam a consumi-lo em vez de ler `champ.status` cru.
 */

/** Coleção Firestore dos overrides de estado. */
const STATE_COLLECTION = "championships";

/**
 * Status observável em runtime de um campeonato.
 * - id fora do catálogo → lança (não existe campeonato para resolver).
 * - doc de override presente com `status` válido → vence o default estático.
 * - sem doc / status inválido → default do catálogo.
 */
export async function getChampionshipStatus(
  db: Firestore,
  id: string,
): Promise<ChampionshipStatus> {
  const champ = getChampionship(id);
  if (!champ) {
    throw new Error(`getChampionshipStatus: campeonato desconhecido "${id}".`);
  }
  // Degrada para o default do catálogo se a leitura do override falhar — mesmo
  // contrato de fallback seguro de `loadChampionshipStatuses`.
  try {
    const snap = await db.collection(STATE_COLLECTION).doc(id).get();
    if (snap.exists) {
      const parsed = championshipStatusSchema.safeParse(
        (snap.data() as { status?: unknown } | undefined)?.status,
      );
      if (parsed.success) return parsed.data;
    }
  } catch (err) {
    console.warn(
      `[championshipState] falha lendo override de status de "${id}"; usando default do catálogo:`,
      err,
    );
  }
  return champ.status;
}

/**
 * Mapa id→status de TODO o catálogo, com overrides do Firestore aplicados numa
 * única leitura da coleção. Para recalc/score que iteram muitos campeonatos por
 * passada (evita N leituras unitárias). Degrada para os defaults do catálogo se
 * a leitura falhar (fallback seguro, espelha o recalc).
 */
export async function loadChampionshipStatuses(
  db: Firestore,
): Promise<Map<string, ChampionshipStatus>> {
  const map = new Map<string, ChampionshipStatus>();
  for (const c of listChampionships()) {
    // `getChampionship(c.id)` (não `c.status` direto) para respeitar mocks de
    // catálogo que sobrepõem só `getChampionship` nos testes de gate.
    map.set(c.id, getChampionship(c.id)?.status ?? c.status);
  }
  try {
    const snap = await db.collection(STATE_COLLECTION).get();
    for (const d of snap.docs) {
      if (!map.has(d.id)) continue; // override de id fora do catálogo é ignorado
      const parsed = championshipStatusSchema.safeParse(
        (d.data() as { status?: unknown } | undefined)?.status,
      );
      if (parsed.success) map.set(d.id, parsed.data);
    }
  } catch (err) {
    console.warn(
      "[championshipState] falha lendo overrides de status; usando defaults do catálogo:",
      err,
    );
  }
  return map;
}
