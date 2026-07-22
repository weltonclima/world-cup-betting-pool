/**
 * Testes dos helpers de config de campeonatos do pool (TASK-07).
 *
 * Catálogo REAL (`championshipCatalog`) — sem mock. Cobre defaults-na-leitura
 * (`getEnabledChampionships`/`getRankingMode`) e a validação de domínio
 * (`validateEnabledChampionships`): catálogo, piso/teto, duplicados.
 */

import { describe, expect, it } from "vitest";

import {
  getEnabledChampionships,
  getRankingMode,
  validateEnabledChampionships,
  filterActiveChampionships,
} from "@/lib/poolChampionships";
import { MAX_ENABLED_CHAMPIONSHIPS } from "@/schemas/pools";
import { DEFAULT_CHAMPIONSHIP_ID } from "@/server/copaData/championshipCatalog";
import type { Pool } from "@/types/pools";
import type { ChampionshipStatus } from "@/types/championships";

// Pool mínimo válido; helpers só leem os campos aditivos de campeonato.
const basePool: Pool = {
  id: "pool-1",
  name: "Bolão",
  slug: "bolao",
  status: "active",
  adminId: "uid-1",
  createdAt: "2026-06-05T12:00:00Z",
};

describe("poolChampionships › getEnabledChampionships", () => {
  it("ausente → [DEFAULT_CHAMPIONSHIP_ID] (só Copa)", () => {
    expect(getEnabledChampionships(basePool)).toEqual([DEFAULT_CHAMPIONSHIP_ID]);
  });

  it("array vazio → [DEFAULT_CHAMPIONSHIP_ID] (trata vazio como legado)", () => {
    expect(
      getEnabledChampionships({ ...basePool, enabledChampionships: [] }),
    ).toEqual([DEFAULT_CHAMPIONSHIP_ID]);
  });

  it("presente e não-vazio → ecoa os ids válidos do catálogo", () => {
    const ids = ["fifa.world", "bra.1-2026"];
    expect(
      getEnabledChampionships({ ...basePool, enabledChampionships: ids }),
    ).toEqual(ids);
  });

  it("filtra ids fora do catálogo na leitura (WR-01)", () => {
    expect(
      getEnabledChampionships({
        ...basePool,
        enabledChampionships: ["fifa.world", "ja-nao-existe-2026", "bra.1-2026"],
      }),
    ).toEqual(["fifa.world", "bra.1-2026"]);
  });

  it("todos os ids inválidos → cai no default (só Copa)", () => {
    expect(
      getEnabledChampionships({
        ...basePool,
        enabledChampionships: ["xxx-2026", "yyy-2026"],
      }),
    ).toEqual([DEFAULT_CHAMPIONSHIP_ID]);
  });

  it("não aliasa o array do pool (retorno é cópia independente — IN-01)", () => {
    const ids = ["fifa.world", "bra.1-2026"];
    const pool = { ...basePool, enabledChampionships: ids };
    const result = getEnabledChampionships(pool);
    result.push("mutado");
    expect(pool.enabledChampionships).toEqual(ids); // inalterado
  });
});

describe("poolChampionships › filterActiveChampionships (segmentação área ativa — TASK-15 §6.5)", () => {
  const statuses = (m: Record<string, ChampionshipStatus>) =>
    new Map<string, ChampionshipStatus>(Object.entries(m));

  it("remove os arquivados, mantém os não-arquivados", () => {
    expect(
      filterActiveChampionships(
        ["fifa.world", "bra.1-2026", "eng.1-2026"],
        statuses({
          "fifa.world": "archived",
          "bra.1-2026": "upcoming",
          "eng.1-2026": "live",
        }),
      ),
    ).toEqual(["bra.1-2026", "eng.1-2026"]);
  });

  it("pool Copa-only com a Copa arquivada → VAZIO (temporada encerrada)", () => {
    // BUGFIX: antes havia proteção anti-vazio que devolvia o conjunto original.
    // Isso mantinha a Copa encerrada na área ativa (ranking/palpite) em vez de
    // recolhê-la ao Histórico. Agora um pool 100%-arquivado zera a área ativa; a
    // UI mostra "temporada encerrada → veja o Histórico".
    expect(
      filterActiveChampionships(
        ["fifa.world"],
        statuses({ "fifa.world": "archived" }),
      ),
    ).toEqual([]);
  });

  it("quando TODOS os habilitados estão arquivados → VAZIO", () => {
    expect(
      filterActiveChampionships(
        ["fifa.world", "bra.1-2026"],
        statuses({ "fifa.world": "archived", "bra.1-2026": "archived" }),
      ),
    ).toEqual([]);
  });

  it("status ausente no mapa é tratado como NÃO-arquivado (mantém)", () => {
    // Degrade-safe: se o status de um id não veio no mapa, não o esconde da área ativa.
    expect(
      filterActiveChampionships(["bra.1-2026"], statuses({})),
    ).toEqual(["bra.1-2026"]);
  });

  it("não aliasa a entrada (retorno é cópia independente)", () => {
    const enabled = ["bra.1-2026"];
    const result = filterActiveChampionships(
      enabled,
      statuses({ "bra.1-2026": "upcoming" }),
    );
    result.push("mutado");
    expect(enabled).toEqual(["bra.1-2026"]);
  });
});

describe("poolChampionships › getRankingMode", () => {
  it("ausente → 'geral'", () => {
    expect(getRankingMode(basePool)).toBe("geral");
  });

  it("presente → ecoa o modo", () => {
    expect(
      getRankingMode({ ...basePool, rankingMode: "por-campeonato" }),
    ).toBe("por-campeonato");
    expect(getRankingMode({ ...basePool, rankingMode: "geral" })).toBe("geral");
  });
});

describe("poolChampionships › validateEnabledChampionships", () => {
  it("ok para ids válidos do catálogo", () => {
    expect(
      validateEnabledChampionships(["fifa.world", "bra.1-2026"]),
    ).toEqual({ ok: true });
  });

  it("erro para id fora do catálogo", () => {
    const result = validateEnabledChampionships(["fifa.world", "xyz.999-2026"]);
    expect(result.ok).toBe(false);
  });

  it("erro para array vazio (piso ≥ 1)", () => {
    const result = validateEnabledChampionships([]);
    expect(result.ok).toBe(false);
  });

  it("erro para ids duplicados", () => {
    const result = validateEnabledChampionships(["fifa.world", "fifa.world"]);
    expect(result.ok).toBe(false);
  });

  it("erro para length acima do teto", () => {
    // Constrói uma lista única e válida acima do teto, se possível; senão
    // repete ids válidos (o teto dispara antes/independente de duplicidade).
    const ids = Array.from(
      { length: MAX_ENABLED_CHAMPIONSHIPS + 1 },
      (_, i) => `champ-${i}`,
    );
    expect(validateEnabledChampionships(ids).ok).toBe(false);
  });

  it("falhas carregam `reason` não-vazio (contrato discriminável)", () => {
    for (const bad of [[], ["fifa.world", "fifa.world"], ["xyz.999-2026"]]) {
      const result = validateEnabledChampionships(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("ok no limite exato (== teto) com ids válidos distintos", () => {
    const ids = [
      "fifa.world",
      "conmebol.america-2026",
      "uefa.euro-2026",
      "uefa.nations-2026",
      "fifa.cwc-2026",
      "bra.1-2026",
      "eng.1-2026",
      "esp.1-2026",
      "ita.1-2026",
      "ger.1-2026",
    ];
    expect(ids).toHaveLength(MAX_ENABLED_CHAMPIONSHIPS);
    expect(validateEnabledChampionships(ids)).toEqual({ ok: true });
  });
});
