import "server-only";

import {
  fetchAllMatches,
  EspnScoreClient,
  mapEspnEventsToMatches,
} from "@/server/copaData";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { matchSchema } from "@/schemas";
import type { MatchWithId } from "@/server/copaData";

/**
 * Fonte efetiva de partidas (PRD-13 — ESPN como fonte primária).
 *
 * Pipeline INVERTIDA: ESPN deixa de ser overlay e vira a BASE do schedule
 * completo (`fetchSchedule` + `mapEspnEventsToMatches`). O openfootball
 * (`fetchAllMatches`) vira FALLBACK de emergência — usado só quando a ESPN
 * falha integralmente (fetch OU mapping). Por cima de qualquer base, as
 * partidas persistidas em `matches/{id}` EDITADAS MANUALMENTE
 * (`isManualOverride === true`) sempre vencem.
 *
 * Precedência: `manual > ESPN > openfootball-fallback`.
 */

/** Lê a coleção `matches` persistida → mapa id→match (ignora docs malformados). */
export async function readPersistedMatches(): Promise<Map<string, MatchWithId>> {
  const db = getAdminFirestore();
  const snap = await db.collection("matches").get();
  const map = new Map<string, MatchWithId>();
  for (const d of snap.docs) {
    const parsed = matchSchema.safeParse(d.data());
    if (!parsed.success) {
      console.warn(
        "[matchSource] match persistido malformado ignorado:",
        d.id,
        parsed.error.issues,
      );
      continue;
    }
    map.set(d.id, { ...parsed.data, id: d.id });
  }
  return map;
}

/**
 * Base ESPN: schedule completo (104 jogos) mapeado para `MatchWithId[]`.
 * NÃO absorve erros — qualquer falha (fetch, parse, mapping) propaga para
 * `getEffectiveMatches`, que decide o fallback openfootball.
 */
async function fetchEspnBase(): Promise<MatchWithId[]> {
  const client = new EspnScoreClient();
  const events = await client.fetchSchedule();
  return mapEspnEventsToMatches(events);
}

/**
 * Partidas efetivas com precedência `manual > ESPN > openfootball-fallback`.
 *
 * Pipeline: base ESPN (fonte primária) → fallback openfootball se a ESPN cair
 * integralmente → overrides manuais persistidos por cima. Resiliente em ambas
 * as bordas:
 *  - ESPN-down → fallback para o schedule openfootball (best-effort);
 *  - Firestore-down → retorna a base (ESPN ou openfootball) sem overrides.
 * Coleção `matches` vazia → base sem overrides.
 */
export async function getEffectiveMatches(): Promise<MatchWithId[]> {
  let base: MatchWithId[];
  try {
    base = await fetchEspnBase();
  } catch (err) {
    console.error(
      "[matchSource] ESPN indisponível; usando fallback openfootball:",
      err,
    );
    base = await fetchAllMatches();
  }

  let persisted: Map<string, MatchWithId>;
  try {
    persisted = await readPersistedMatches();
  } catch (err) {
    console.error(
      "[matchSource] falha lendo matches persistidos; usando base sem overrides:",
      err,
    );
    return base;
  }
  if (persisted.size === 0) return base;

  const baseIds = new Set(base.map((m) => m.id));
  const merged = base.map((m) => {
    const override = persisted.get(m.id);
    return override && override.isManualOverride === true ? override : m;
  });
  // Override manual de uma partida ausente da base (defensivo): preserva a edição.
  for (const [id, override] of persisted) {
    if (!baseIds.has(id) && override.isManualOverride === true) {
      merged.push(override);
    }
  }
  return merged;
}
