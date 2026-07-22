import "server-only";

import { NextResponse } from "next/server";

import { requireApprovedUser } from "@/server/auth/requireApprovedUser";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { AGGREGATE_SCOPE, ensureRankingsFresh } from "@/server/rankings/recalc";
import {
  championshipScope,
  resolveChampionshipDocScope,
} from "@/server/rankings/championshipScope";
import {
  DEFAULT_CHAMPIONSHIP_ID,
  getChampionship,
} from "@/server/copaData/championshipCatalog";
import { hydrateRankingEntries } from "@/server/rankings/hydrateEntries";
import { getEnabledChampionships, getRankingMode } from "@/lib/poolChampionships";
import {
  aggregateRankingSchema,
  championshipRankingSchema,
  HEX_COLOR_REGEX,
  rankingSchema,
} from "@/schemas";
import type { Pool } from "@/types/pools";

// firebase-admin + cookies() exigem Node runtime; lê/grava Firestore → sem cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/rankings/pool — ranking FECHADO do pool do usuário logado (PRD-09).
 *
 * Isolamento multi-tenant: o `groupId` vem SEMPRE da sessão (`users/{uid}.groupId`),
 * NUNCA do request — senão um usuário pediria o pool de outro grupo. Serve
 * `rankings/pool-{groupId}-geral` (re-rankeado só com membros do pool pelo recalc).
 * Usuário sem pool → `null` (não pertence a ranking nenhum e nunca aparece em outro).
 * Aplica o recalc preguiçoso (dirty-by-finish) via `ensureRankingsFresh`.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const session = await requireApprovedUser();
  if ("errorResponse" in session) return session.errorResponse;

  // TASK-21: `?championship={id}` opcional. Ausente/`fifa.world` → `pool-{id}-geral`
  // (compat Copa). Liga → `pool-{id}-{champ}-geral`. Só `geral` (esta rota é o geral
  // fechado do pool); id inválido → 400.
  const rawChampionship = new URL(request.url).searchParams.get("championship");
  const resolved = resolveChampionshipDocScope(rawChampionship, "geral");
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  const db = getAdminFirestore();

  const userSnap = await db.collection("users").doc(session.user.uid).get();
  const groupId = userSnap.data()?.["groupId"];
  if (typeof groupId !== "string" || groupId.length === 0) {
    // Sem pool: deny-by-default semântico — não há ranking a servir.
    return NextResponse.json(null, { status: 200 });
  }

  // Recalc-on-read (best-effort, nunca lança): mantém os docs de ranking frescos.
  await ensureRankingsFresh(db);

  // Config de exibição do pool (multi-championship TASK-12): lida SÓ da sessão
  // (pools/{groupId}), nunca do request. `rankingMode` decide qual UI o client monta
  // (lista agregada única vs seletor por campeonato) e, sem `?championship`, qual doc
  // servir. As flags de exibição são de NÍVEL POOL (não do campeonato).
  const poolSnap = await db.collection("pools").doc(groupId).get();
  const poolData = poolSnap.data();
  const rankingMode = getRankingMode((poolData ?? {}) as Pool);

  // Seleção do doc-scope:
  //  - modo `geral` SEM `?championship` → ranking AGREGADO (`pool-{id}-agregado`);
  //    se o pool não agrega (só Copa, sem doc agregado) → fallback ao `geral` bare.
  //  - senão (modo `por-campeonato`, ou `?championship=` presente) → `resolved.docScope`
  //    (geral bare da Copa ou `{C}-geral` da liga — TASK-21, inalterado).
  const wantsAggregate = !rawChampionship && rankingMode === "geral";
  let docScope = resolved.docScope;
  let isChampionshipScoped = resolved.isChampionshipScoped;
  let isAggregate = false;

  if (wantsAggregate) {
    // Modo geral sem `?championship`: prioriza o AGREGADO (pool com ≥2 pontuáveis).
    const aggSnap = await db
      .collection("rankings")
      .doc(`pool-${groupId}-${AGGREGATE_SCOPE}`)
      .get();
    if (aggSnap.exists) {
      docScope = AGGREGATE_SCOPE;
      isAggregate = true;
    } else {
      // Sem agregado (pool <2 pontuáveis). O `geral` bare (`pool-{id}-geral`) é SEMPRE
      // a Copa (gravado incondicionalmente pela recalc §5.1). Se o pool NÃO habilita a
      // Copa e tem exatamente 1 liga ATIVA, servir esse bare mostraria a competição
      // ERRADA — o "geral" dele é o ranking DAQUELA liga (`pool-{id}-{liga}-geral`,
      // recalc §7.5). Caso contrário (Copa habilitada, ou nenhuma liga pontuável) →
      // `pool-{id}-geral` bare (compat só-Copa / legado).
      const soleLeague = soleActiveLeagueScope((poolData ?? {}) as Pool);
      if (soleLeague) {
        docScope = soleLeague; // `{liga}-geral`
        isChampionshipScoped = true;
      } else {
        docScope = "geral";
      }
    }
  }

  const snap = await db.collection("rankings").doc(`pool-${groupId}-${docScope}`).get();
  if (!snap.exists) {
    return NextResponse.json(null, { status: 200 });
  }

  // Parse por forma do doc: por campeonato (com `championshipId`) → schema dedicado;
  // agregado (`scope: "agregado"`, sem `championshipId`) → schema dedicado; geral bare
  // legado → `rankingSchema` (enum de fases).
  const parsed = isChampionshipScoped
    ? championshipRankingSchema.safeParse(snap.data())
    : isAggregate
      ? aggregateRankingSchema.safeParse(snap.data())
      : rankingSchema.safeParse(snap.data());
  if (!parsed.success) {
    console.warn("[rankings] pool doc fora do schema:", groupId, parsed.error.issues);
    return NextResponse.json(null, { status: 200 });
  }

  // Foto/nome de exibição resolvidos AO VIVO (não do snapshot do recalc): garante que
  // trocar avatar/apelido reflita no ranking sem depender de um recalc disparar.
  const entries = await hydrateRankingEntries(db, parsed.data.entries);

  // Contrato limpo (TASK-21 LOW-2): as flags Copa/pool-display só fazem sentido para o
  // ranking do pool (Copa / agregado), NÃO para a resposta escopada por campeonato
  // (uma liga só tem `geral`, sem fase/prorrogação). `rankingMode` acompanha sempre.
  if (isChampionshipScoped) {
    return NextResponse.json({ ...parsed.data, entries, rankingMode }, { status: 200 });
  }

  // Flags de exibição do pool, lidas SÓ da sessão. Ausente/não-booleano = OFF (omitida
  // do payload; telas tratam como false). Nenhum outro dado do pool vaza aqui.
  const rawFlag: unknown = poolData?.["splitPhaseRanking"];
  const splitPhaseRanking = typeof rawFlag === "boolean" ? rawFlag : undefined;
  // Cores de marca do pool (TASK-03). Guarda hex defensiva: uma cor malformada no
  // banco NÃO deve quebrar o parse do payload inteiro no client → omite se inválida.
  const asHex = (v: unknown): string | undefined =>
    typeof v === "string" && HEX_COLOR_REGEX.test(v) ? v : undefined;
  const primaryColorLight = asHex(poolData?.["primaryColorLight"]);
  const primaryColorDark = asHex(poolData?.["primaryColorDark"]);
  // Flag de exibição p/ pontuar eliminatórias pelo 90min (TASK-04). Mesmo padrão.
  const rawOvertimeFlag: unknown = poolData?.["ignoreOvertimeGoals"];
  const ignoreOvertimeGoals = typeof rawOvertimeFlag === "boolean" ? rawOvertimeFlag : undefined;

  return NextResponse.json(
    {
      ...parsed.data,
      entries,
      rankingMode,
      splitPhaseRanking,
      ignoreOvertimeGoals,
      primaryColorLight,
      primaryColorDark,
    },
    { status: 200 },
  );
}

/**
 * Doc-scope `{liga}-geral` quando o pool NÃO habilita a Copa e tem exatamente 1 liga
 * ATIVA habilitada; senão `null`. Espelha o gate "pontuável/ativo" da recalc
 * (`type === "league" && status !== "archived"`) e a exclusão da Copa (dimensão bare).
 * Usado só no fallback do modo geral (pool <2 pontuáveis) p/ evitar servir a Copa a um
 * pool liga-única. Copa habilitada → `null` (o geral bare já é a Copa).
 */
function soleActiveLeagueScope(pool: Pool): string | null {
  const enabled = getEnabledChampionships(pool);
  if (enabled.includes(DEFAULT_CHAMPIONSHIP_ID)) return null;
  const activeLeagues = enabled.filter((id) => {
    const champ = getChampionship(id);
    return champ?.type === "league" && champ.status !== "archived";
  });
  if (activeLeagues.length !== 1) return null;
  const champ = getChampionship(activeLeagues[0]!);
  return champ ? championshipScope(champ, "geral") : null;
}
