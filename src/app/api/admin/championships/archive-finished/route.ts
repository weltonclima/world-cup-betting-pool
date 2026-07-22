import "server-only";

import { NextResponse } from "next/server";

import { authorizeGroupAdmin } from "@/app/api/admin/groups/_authorize";
import { getAdminFirestore } from "@/server/firebaseAdmin";
import { getEnabledChampionships } from "@/lib/poolChampionships";
import { getChampionship } from "@/server/copaData/championshipCatalog";
import { getEffectiveMatches } from "@/server/copaData/matchSource";
import { archiveChampionship, isChampionshipFinished } from "@/server/copaData/archive";
import type { Pool } from "@/types/pools";

/**
 * POST /api/admin/championships/archive-finished — arquivamento AUTOMÁTICO dos
 * campeonatos encerrados (bugfix multi-championship: "temporada encerrada").
 *
 * Trigger de cron/script (sem ação manual): varre os campeonatos habilitados em
 * ≥1 pool, detecta os 100% encerrados (`isChampionshipFinished`) e chama
 * `archiveChampionship` — que congela schedule + ranking/estatísticas em
 * `history/*` e grava o estado `archived` em `championships/{id}`. Cobre a Copa
 * legada e qualquer campeonato futuro. É o que finalmente move um campeonato
 * encerrado para o Histórico (o snapshot é o gate do `GET /api/history`).
 *
 * Idempotência pelo DOC RUNTIME, não pelo status resolvido: pula um campeonato só
 * quando `championships/{id}` já existe com `status: "archived"`. A Copa
 * (`fifa.world`) é `archived` por DEFAULT do catálogo, mas sem doc runtime nem
 * snapshot até o primeiro arquivamento — gatear pelo status resolvido a pularia
 * para sempre e ela nunca entraria no Histórico. Best-effort por campeonato:
 * falha de um (ESPN fora, etc.) não derruba os demais.
 *
 * Auth: `authorizeGroupAdmin` (secret `x-admin-secret` == `GROUPS_ADMIN_SECRET`,
 * ou sessão super_admin). 200 com o resumo · 401/403 auth.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ArchiveFinishedSummary = {
  archived: string[];
  skippedAlreadyArchived: string[];
  skippedNotFinished: string[];
  errors: Array<{ championshipId: string; error: string }>;
};

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await authorizeGroupAdmin(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const db = getAdminFirestore();

  // Candidatos = união dos campeonatos habilitados em algum pool. Pools legados
  // caem no default `[fifa.world]` (a Copa entra mesmo sem campo). Bounded — não
  // varre o catálogo inteiro (evita fetch ESPN de 23 slugs, quase todos upcoming).
  const candidates = new Set<string>();
  try {
    const poolsSnap = await db.collection("pools").get();
    for (const d of poolsSnap.docs) {
      for (const cid of getEnabledChampionships(d.data() as Pool)) {
        candidates.add(cid);
      }
    }
  } catch (err) {
    console.error("[archive-finished] falha ao ler pools:", err);
    return NextResponse.json(
      { error: "Erro ao ler os campeonatos dos grupos." },
      { status: 500 },
    );
  }

  const summary: ArchiveFinishedSummary = {
    archived: [],
    skippedAlreadyArchived: [],
    skippedNotFinished: [],
    errors: [],
  };

  // Estado runtime dos candidatos numa ida (idempotência pelo DOC, não pelo status
  // resolvido — ver docstring). Doc ausente → nunca arquivado ainda. Guarda o status
  // runtime por cid p/ derivar o status RESOLVIDO (runtime ?? catálogo) sem uma 2ª
  // leitura (`loadChampionshipStatuses`).
  const cids = [...candidates];
  const stateSnaps = cids.length
    ? await db.getAll(...cids.map((cid) => db.collection("championships").doc(cid)))
    : [];
  const runtimeStatus = new Map<string, unknown>();
  const alreadyArchived = new Set<string>();
  stateSnaps.forEach((snap, i) => {
    const status = snap.exists
      ? (snap.data() as { status?: unknown } | undefined)?.status
      : undefined;
    runtimeStatus.set(cids[i]!, status);
    if (status === "archived") alreadyArchived.add(cids[i]!);
  });

  // Best-effort por campeonato — isola falhas (ESPN fora não derruba os demais).
  await Promise.allSettled(
    cids.map(async (cid) => {
      if (alreadyArchived.has(cid)) {
        summary.skippedAlreadyArchived.push(cid);
        return;
      }
      const champ = getChampionship(cid);
      if (!champ) {
        // Id fora do catálogo (doc out-of-band) — nada a arquivar.
        summary.skippedNotFinished.push(cid);
        return;
      }
      try {
        const matches = await getEffectiveMatches(cid);
        if (!isChampionshipFinished(matches)) {
          // Status resolvido = override runtime, senão o default do catálogo.
          const resolved = runtimeStatus.get(cid) ?? champ.status;
          if (resolved === "archived") {
            // INCONSISTÊNCIA (CR-01): o status diz `archived` (ex.: Copa legada,
            // archived-by-default no catálogo) — a ÁREA ATIVA já a esconde — mas a
            // fonte não confirma o encerramento e ainda não há snapshot. Silenciar
            // deixaria a Copa invisível em todo lugar (fora do ativo E fora do
            // Histórico). Emite ERRO p/ o cron falhar visível e re-tentar, em vez de
            // cair no bucket de sucesso `skippedNotFinished`.
            summary.errors.push({
              championshipId: cid,
              error:
                "status 'archived' mas a fonte não confirma encerramento; snapshot não gerado (área ativa esconde, Histórico vazio)",
            });
          } else {
            summary.skippedNotFinished.push(cid);
          }
          return;
        }
        await archiveChampionship(db, champ);
        summary.archived.push(cid);
      } catch (err) {
        console.error(`[archive-finished] falha ao arquivar ${cid}:`, err);
        summary.errors.push({
          championshipId: cid,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );

  // Erros → 500 (não 200): o cron usa `--fail-with-body`, então qualquer erro por
  // campeonato faz o job falhar visível (e re-tentar), nunca um sucesso silencioso.
  // O corpo (summary) acompanha nos dois casos para diagnóstico.
  return NextResponse.json(summary, {
    status: summary.errors.length > 0 ? 500 : 200,
  });
}
