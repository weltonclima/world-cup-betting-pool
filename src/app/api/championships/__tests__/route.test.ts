/**
 * Testes do Route Handler GET /api/championships (TASK-06).
 *
 * Catálogo REAL (`championshipCatalog`) — sem mock. Valida a projeção pública
 * (campos expostos, ocultação de `needsPagination`/`legacyMatchId`).
 */

import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/championships/route";
import { listChampionships } from "@/server/copaData/championshipCatalog";

interface ChampionshipPublic {
  id: string;
  name: string;
  season: string;
  type: string;
  status: string;
}

describe("GET /api/championships", () => {
  it("responde 200 com o catálogo inteiro", async () => {
    const response = GET();
    expect(response.status).toBe(200);

    const body = (await response.json()) as ChampionshipPublic[];
    expect(body).toHaveLength(listChampionships().length);
  });

  it("projeta apenas campos públicos (sem needsPagination/legacyMatchId/espnSlug)", async () => {
    const body = (await GET().json()) as ChampionshipPublic[];
    for (const c of body) {
      expect(Object.keys(c).sort()).toEqual([
        "id",
        "name",
        "season",
        "status",
        "type",
      ]);
    }
  });

  it("inclui ligas e copas com o `type` correto", async () => {
    const body = (await GET().json()) as ChampionshipPublic[];
    expect(body.find((c) => c.id === "bra.1-2026")?.type).toBe("league");
    expect(body.find((c) => c.id === "uefa.champions-2026")?.type).toBe("cup");
  });
});
