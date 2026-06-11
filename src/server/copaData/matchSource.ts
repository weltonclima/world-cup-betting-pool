import "server-only";

import { fetchAllMatches } from "@/server/copaData";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { matchSchema } from "@/schemas";
import type { MatchWithId } from "@/types/matches";

/**
 * Fonte efetiva de partidas (PRD-11 — persistência + edição manual).
 *
 * Estratégia OVERLAY (menor risco, sem regressão): a base continua sendo o
 * openfootball ao vivo (`fetchAllMatches`) — placares em tempo real seguem
 * fluindo normalmente. Por cima, aplicamos as partidas persistidas em
 * `matches/{id}` QUE FORAM EDITADAS MANUALMENTE (`isManualOverride === true`):
 * uma correção do super_admin SEMPRE vence o dado do openfootball.
 *
 * Consequência: com a coleção `matches` vazia (estado inicial, antes do 1º
 * sync/edição) o comportamento é IDÊNTICO ao de hoje. Só diverge quando há
 * override manual — exatamente o objetivo.
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
 * Partidas efetivas = openfootball (base) com overrides manuais aplicados.
 * Resiliente: falha lendo o Firestore → cai para a base ao vivo (não quebra
 * ranking/groups/bracket). Coleção vazia → retorna a base inalterada.
 */
export async function getEffectiveMatches(): Promise<MatchWithId[]> {
  const base = await fetchAllMatches();

  let persisted: Map<string, MatchWithId>;
  try {
    persisted = await readPersistedMatches();
  } catch (err) {
    console.error(
      "[matchSource] falha lendo matches persistidos; usando só openfootball:",
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
