import "server-only";

import {
  EspnScoreClient,
  mapEspnEventsToMatches,
  mapEspnEventsToLeagueMatches,
} from "@/server/copaData";
import { deriveRanges } from "@/server/copaData/espnClient";
import {
  DEFAULT_CHAMPIONSHIP_ID,
  getChampionship,
} from "@/server/copaData/championshipCatalog";
import { getChampionshipStatus } from "@/server/copaData/championshipState";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { matchSchema } from "@/schemas";
import type { MatchWithId } from "@/server/copaData";
import type { Championship } from "@/types/championships";

/**
 * Fonte efetiva de partidas — ESPN como ÚNICA fonte, ESCOPADA POR CAMPEONATO
 * (TASK-05, multi-championship-launch).
 *
 * ESPN é a BASE do schedule (`fetchSchedule` + mapper por tipo). Não há fallback:
 * se a ESPN cair, o erro propaga (o route handler decide resiliência via snapshot
 * stale). Por cima da base, as partidas persistidas em `matches/{id}` do MESMO
 * campeonato e EDITADAS MANUALMENTE (`isManualOverride === true`) sempre vencem.
 *
 * Precedência: `manual > ESPN`. Escopo: tudo é filtrado pelo `championshipId`
 * (default `DEFAULT_CHAMPIONSHIP_ID` = `"fifa.world"` → compat byte-a-byte com a
 * Copa 2026 e todos os callers legados sem argumento; constante única no catálogo).
 */

/**
 * Lê a coleção `matches` persistida → mapa id→match do campeonato pedido.
 * Filtra por `championshipId` EM MEMÓRIA (parse defaulta docs legados sem o campo
 * para `"fifa.world"`); ignora docs malformados. Volume atual = override-only
 * (pequeno); leitura banco-first de arquivados é TASK-14.
 */
export async function readPersistedMatches(
  championshipId: string = DEFAULT_CHAMPIONSHIP_ID,
): Promise<Map<string, MatchWithId>> {
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
    // Escopo por campeonato: docs de outro campeonato não entram no overlay.
    if (parsed.data.championshipId !== championshipId) {
      continue;
    }
    map.set(d.id, { ...parsed.data, id: d.id });
  }
  return map;
}

/**
 * Base ESPN de um campeonato: schedule completo → `MatchWithId[]`.
 * Slug/ranges derivados do campeonato; mapper escolhido por `type`
 * (`league` → mapper de liga; demais → mapper Copa). NÃO absorve erros —
 * qualquer falha (fetch, parse, mapping) propaga para `getEffectiveMatches`.
 */
async function fetchEspnBase(championship: Championship): Promise<MatchWithId[]> {
  const client = new EspnScoreClient(championship.espnSlug);
  const events = await client.fetchSchedule(deriveRanges(championship));
  return championship.type === "league"
    ? mapEspnEventsToLeagueMatches(events, championship)
    : mapEspnEventsToMatches(events);
}

/**
 * Partidas efetivas de um campeonato, com precedência por STATUS (TASK-14).
 *
 * Ramifica pela resolução de status em runtime (`getChampionshipStatus`):
 *  - **`archived` de LIGA (`type: "league"`, não-legada)** → BANCO-FIRST: serve o
 *    schedule congelado de `matches/{id}` (gravado pela TASK-13), ESPN IGNORADA e
 *    sem o filtro manual-only (o snapshot É o schedule completo). Ordenado por
 *    `kickoffAt` para preservar a ordem cronológica da fase ao vivo. Sem snapshot
 *    → erro claro (servir ESPN com janela stale mascararia perda de dados).
 *  - **`live`/`upcoming`**, o campeonato LEGADO (`fifa.world`) em QUALQUER status,
 *    e todo CUP não-legado (mesmo `archived`) → ESPN (fonte única) + overrides
 *    manuais. Precedência `manual > ESPN`.
 *
 * Por que o gate `type === "league"`: o mapper de CUP (`mapEspnEventsToMatches`)
 * ainda NÃO carimba `championshipId` nem gera id namespaced — cups produzem ids
 * BARE default `"fifa.world"` (ver memória `cup-matchid-not-namespaced`). O
 * snapshot de um cup arquivado ficaria mistaggeado e `readPersistedMatches(cupId)`
 * o filtraria por completo → falso-throw permanente. Enquanto o namespacing de cup
 * (foundation) não fecha, cups arquivados seguem servidos pela ESPN — mesma
 * precedência do scoring gated-a-league da TASK-11. O legado `fifa.world` também
 * NUNCA vai banco-first (seus docs são overrides, não schedule congelado).
 *
 * Resiliência (aceito): `getChampionshipStatus` degrada para o default do catálogo
 * numa falha de leitura (contrato degrade-safe do épico, consumido por
 * recalc/scoring). Num apagão de Firestore, uma liga arquivada pode cair ao
 * caminho ESPN (best-effort; o route handler cobre via cache stale). O invariante
 * banco-first vale com o Firestore saudável.
 *
 * Erros do caminho ESPN: campeonato fora do catálogo → erro; ESPN-down → propaga
 * (sem fallback); Firestore-down (overlay) → base ESPN sem overrides.
 *
 * @param championshipId id do campeonato (default `"fifa.world"` → compat).
 */
export async function getEffectiveMatches(
  championshipId: string = DEFAULT_CHAMPIONSHIP_ID,
): Promise<MatchWithId[]> {
  const championship = getChampionship(championshipId);
  if (!championship) {
    throw new Error(
      `getEffectiveMatches: campeonato desconhecido "${championshipId}" ` +
        `(não está no catálogo).`,
    );
  }

  // Banco-first para LIGAS arquivadas não-legadas (TASK-14). Cups não-legados e o
  // legado `fifa.world` seguem sempre ESPN+overlay — ver docstring (gate de tipo).
  if (championship.legacyMatchId !== true && championship.type === "league") {
    const status = await getChampionshipStatus(getAdminFirestore(), championshipId);
    if (status === "archived") {
      const snapshot = await readPersistedMatches(championshipId);
      if (snapshot.size === 0) {
        throw new Error(
          `getEffectiveMatches: liga "${championshipId}" está arquivada ` +
            `mas não há snapshot persistido em 'matches'.`,
        );
      }
      // Ordena por kickoffAt: `matches.values()` sai em ordem de doc-id (id
      // namespaced lexicográfico ≠ cronológico); consumidores esperam ordem de jogo.
      return [...snapshot.values()].sort((a, b) =>
        a.kickoffAt < b.kickoffAt ? -1 : a.kickoffAt > b.kickoffAt ? 1 : 0,
      );
    }
  }

  const base = await fetchEspnBase(championship);

  let persisted: Map<string, MatchWithId>;
  try {
    persisted = await readPersistedMatches(championshipId);
  } catch (err) {
    console.error(
      "[matchSource] falha lendo matches persistidos; usando base ESPN sem overrides:",
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
