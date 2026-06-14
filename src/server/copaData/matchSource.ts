import "server-only";

import {
  fetchAllMatches,
  EspnScoreClient,
  buildEspnPatchMap,
} from "@/server/copaData";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { matchSchema } from "@/schemas";
import type { MatchWithId, EspnMatchPatch } from "@/server/copaData";

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

/** Dia atual em UTC no formato `YYYYMMDD` exigido pelo `?dates` da ESPN. */
function todayUtcYyyymmdd(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * Busca o patch ESPN (status/placar ao vivo) para a base. BEST-EFFORT: qualquer
 * falha (timeout, HTTP, parse, rede) é absorvida com `console.error` e retorna
 * mapa vazio — ESPN-down nunca derruba nem altera o pipeline (zero regressão).
 */
async function fetchEspnPatchMap(
  base: MatchWithId[],
): Promise<Map<string, EspnMatchPatch>> {
  try {
    const client = new EspnScoreClient();
    const scoreboard = await client.fetchScoreboard(todayUtcYyyymmdd());
    return buildEspnPatchMap(scoreboard.events, base);
  } catch (err) {
    console.error(
      "[matchSource] falha ESPN; seguindo sem live scores (degradação resiliente):",
      err,
    );
    return new Map();
  }
}

/**
 * Aplica o patch ESPN (só status/placar) sobre a base. Map vazio → base intacta.
 *
 * Precedência ESPN > openfootball é INCONDICIONAL por design (PRD-12): se a base
 * já marca `finished` mas a ESPN ainda reporta `in` (lag de fim de jogo), o match
 * volta a `live` e sai do ranking (recalc filtra `finished`) até a ESPN convergir
 * (≤5min, janela de cache). Risco transitório ACEITO — não há guarda anti-regressão.
 */
function applyEspnPatches(
  base: MatchWithId[],
  patchMap: Map<string, EspnMatchPatch>,
): MatchWithId[] {
  if (patchMap.size === 0) return base;
  return base.map((m) => {
    const patch = patchMap.get(m.id);
    return patch
      ? { ...m, status: patch.status, homeScore: patch.homeScore, awayScore: patch.awayScore }
      : m;
  });
}

/**
 * Partidas efetivas com precedência `manual > ESPN > openfootball`.
 *
 * Pipeline: base openfootball → patch ESPN ao vivo (best-effort) → overrides
 * manuais persistidos por cima. Resiliente em ambas as bordas:
 *  - ESPN-down → patch vazio → saída idêntica ao openfootball (zero regressão);
 *  - Firestore-down → cai para a base já com ESPN aplicado (live scores seguem).
 * Coleção `matches` vazia → base + ESPN, sem overrides.
 */
export async function getEffectiveMatches(): Promise<MatchWithId[]> {
  const base = await fetchAllMatches();

  // Camada ESPN (antes dos overrides manuais — manual sempre vence).
  const espnPatchMap = await fetchEspnPatchMap(base);
  const espnBase = applyEspnPatches(base, espnPatchMap);

  let persisted: Map<string, MatchWithId>;
  try {
    persisted = await readPersistedMatches();
  } catch (err) {
    console.error(
      "[matchSource] falha lendo matches persistidos; usando base + ESPN:",
      err,
    );
    return espnBase;
  }
  if (persisted.size === 0) return espnBase;

  const baseIds = new Set(espnBase.map((m) => m.id));
  const merged = espnBase.map((m) => {
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
