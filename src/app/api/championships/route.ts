/**
 * GET /api/championships — catálogo curado de campeonatos (TASK-06).
 *
 * Projeção PÚBLICA do registry estático (`listChampionships`): expõe só os campos
 * que o cliente precisa para montar seletor/listagem — NÃO vaza `needsPagination`,
 * `legacyMatchId` nem `espnSlug` (detalhes internos de fetch/compat/provedor). O
 * cliente identifica o campeonato pelo `id` (chave de `?championship=`), nunca pelo
 * slug ESPN — expor o slug acoplaria o contrato público ao provedor.
 *
 * O filtro "habilitados no pool" (`pool.enabledChampionships`) NÃO é feito aqui —
 * depende da TASK-07 e é integrado na TASK-09. Esta rota devolve o catálogo
 * inteiro.
 *
 * Cache: 24h — catálogo é singleton de módulo (estático). Transições reais de
 * `status` (upcoming → live → archived) são da TASK-13.
 */

import { NextResponse } from "next/server";

import { listChampionships } from "@/server/copaData/championshipCatalog";
import type { ChampionshipStatus, ChampionshipType } from "@/types/championships";

// Literal estático obrigatório pelo Next.js.
export const revalidate = 86400;

/** Forma pública de um campeonato no catálogo (sem campos internos de fetch). */
interface ChampionshipPublic {
  id: string;
  name: string;
  season: string;
  type: ChampionshipType;
  status: ChampionshipStatus;
}

export function GET(): NextResponse {
  const catalog: ChampionshipPublic[] = listChampionships().map((c) => ({
    id: c.id,
    name: c.name,
    season: c.season,
    type: c.type,
    status: c.status,
  }));
  return NextResponse.json(catalog);
}
