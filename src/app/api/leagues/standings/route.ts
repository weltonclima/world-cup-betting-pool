/**
 * GET /api/leagues/standings — tabela de classificação de liga com cache Firestore.
 *
 * Espelha `api/worldcup/groups` (read-through + resiliência stale), com gate
 * INVERTIDO: só `type === "league"` (spec §6). Fluxo:
 *  1. Snapshot fresco E válido → retorna cacheado.
 *  2. Stale/ausente/corrompido → busca ESPN (fetch único), computa, grava best-effort.
 *  3. Falha no fetch + snapshot (mesmo stale) → serve stale (`no-store`).
 *  4. Falha no fetch + sem snapshot → copaDataErrorResponse.
 *
 * Resposta: LeagueStandingsResponse = { table: LeagueStanding[], hasLiveMatch: boolean }
 */

import { after, NextResponse } from "next/server";

import {
  resolveChampionshipFromRequest,
  UnknownChampionshipError,
  unknownChampionshipResponse,
} from "@/app/api/_lib/championshipParam";
import { copaDataErrorResponse } from "@/app/api/_lib/copaDataError";
import { computeLeagueStandings } from "@/server/leagues/standings";
import { getLeagueStandingsData } from "@/server/leagues/standingsSource";
import { isFresh, readSnapshot, writeSnapshot } from "@/server/worldcup/cache";
import { leagueStandingsResponseSchema } from "@/schemas/leagues";
import type { Championship } from "@/types/championships";

// Força modo dinâmico — cache gerenciado pelo helper Firestore.
export const dynamic = "force-dynamic";

/** Chave de cache escopada por campeonato (namespace novo, não colide). */
function cacheKey(championshipId: string): string {
  return `standings:${championshipId}`;
}

/**
 * Header Cache-Control: 60s ao vivo / 24h ocioso — espelha `api/worldcup/groups`.
 */
function cacheControl(hasLive: boolean): Record<string, string> {
  if (hasLive) {
    return { "Cache-Control": "s-maxage=60, stale-while-revalidate=0" };
  }
  return { "Cache-Control": "s-maxage=86400, stale-while-revalidate=60" };
}

export async function GET(request: Request): Promise<NextResponse> {
  const now = Date.now();

  // Gate league-only (spec §6): Copa/cup/id-inválido → 400. `?championship=`
  // ausente → default Copa (cup) → rejeitado (classificação é só de liga).
  let championship: Championship;
  try {
    championship = resolveChampionshipFromRequest(request);
  } catch (err) {
    if (err instanceof UnknownChampionshipError) {
      return unknownChampionshipResponse();
    }
    throw err;
  }
  if (championship.type !== "league") {
    return NextResponse.json(
      { error: "Classificação de pontos corridos indisponível para este campeonato." },
      { status: 400 },
    );
  }

  const key = cacheKey(championship.id);

  // 1. Snapshot fresco + válido → serve cacheado.
  const snap = await readSnapshot(key);
  if (snap && isFresh(snap, now)) {
    const parsed = leagueStandingsResponseSchema.safeParse(snap.payload);
    if (parsed.success) {
      return NextResponse.json(parsed.data, {
        headers: cacheControl(snap.hasLiveGroupMatch),
      });
    }
    console.error(
      `[leagues/standings] snapshot "${key}" fora do contrato — recomputando`,
    );
  }

  // 2/3/4. Recomputa a partir da ESPN (fetch único → matches + display).
  // A resiliência stale-on-error cobre SÓ o fetch ESPN (falha de upstream). O
  // cômputo/validação da NOSSA carga fica FORA deste try: um erro aí é bug de
  // dado nosso, não outage da ESPN — deve falhar honesto (não ser mascarado
  // como "Falha no fetch" nem servir stale para sempre) (review TASK-20 M-1/M-2).
  let matches;
  let teams;
  try {
    ({ matches, teams } = await getLeagueStandingsData(championship));
  } catch (err) {
    // Resiliência: ESPN indisponível mas snapshot (mesmo stale) existe.
    if (snap) {
      console.error(
        `[leagues/standings] Falha no fetch ESPN; retornando snapshot stale "${key}":`,
        err,
      );
      return NextResponse.json(snap.payload, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    return copaDataErrorResponse(err);
  }

  const hasLive = matches.some((m) => m.stage === "liga" && m.status === "live");

  const payload = leagueStandingsResponseSchema.parse({
    table: computeLeagueStandings(matches, teams),
    hasLiveMatch: hasLive,
  });

  // Escrita desacoplada do response (after); writeSnapshot engole seus erros.
  // Reusa o campo `hasLiveGroupMatch` do snapshot como flag genérica de "ao vivo".
  after(() => writeSnapshot(key, payload, hasLive, now));

  return NextResponse.json(payload, { headers: cacheControl(hasLive) });
}
