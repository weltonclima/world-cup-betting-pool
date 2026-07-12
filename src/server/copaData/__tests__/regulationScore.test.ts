import { describe, expect, it } from "vitest";

import { deriveRegulationScore, mapOutcome } from "@/server/copaData/espnMapper";
import type { EspnCompetitor } from "@/server/copaData/espnTypes";

/**
 * TASK-01 — reconstrução do placar do tempo normal (90min) a partir do array
 * `details` (gol-a-gol) da ESPN, e correção da detecção de prorrogação
 * (STATUS_FINAL_AET). Dados reais 2026: ENG@NOR e ARG@SUI, ambos AET, 1×1 nos 90'.
 */

/** Competitor mínimo p/ deriveRegulationScore (só team.id/homeAway importam). */
function competitor(homeAway: "home" | "away", id: string): EspnCompetitor {
  return { homeAway, score: 0, team: { id, abbreviation: id } } as EspnCompetitor;
}

/** Item de `details` (scoring play) mínimo. `display` opcional (minuto exibido). */
function goal(opts: {
  clock?: number;
  display?: string;
  teamId?: string;
  shootout?: boolean;
  ownGoal?: boolean;
  scoreValue?: number;
}) {
  return {
    type: { id: "70", text: "Goal" },
    clock: {
      ...(opts.clock !== undefined ? { value: opts.clock } : {}),
      displayValue: opts.display ?? "",
    },
    ...(opts.teamId !== undefined ? { team: { id: opts.teamId } } : {}),
    scoreValue: opts.scoreValue ?? 1,
    scoringPlay: true,
    shootout: opts.shootout ?? false,
    ...(opts.ownGoal !== undefined ? { ownGoal: opts.ownGoal } : {}),
  };
}

/** Item não-gol (cartão) — deve ser ignorado. */
function card(clock: number, teamId: string) {
  return {
    type: { id: "94", text: "Yellow Card" },
    clock: { value: clock, displayValue: "" },
    team: { id: teamId },
    scoreValue: 0,
    scoringPlay: false,
    shootout: false,
  };
}

describe("mapOutcome — detecção de prorrogação", () => {
  it("STATUS_FINAL_AET (post) → overtime", () => {
    expect(mapOutcome("STATUS_FINAL_AET", "post")).toBe("overtime");
  });

  it("STATUS_OVERTIME (post, legado) → overtime", () => {
    expect(mapOutcome("STATUS_OVERTIME", "post")).toBe("overtime");
  });

  it("STATUS_FINAL_PEN (post) → penalties", () => {
    expect(mapOutcome("STATUS_FINAL_PEN", "post")).toBe("penalties");
  });

  it("nome desconhecido (post) → normal", () => {
    expect(mapOutcome("STATUS_FULL_TIME", "post")).toBe("normal");
  });

  it("state != post → undefined", () => {
    expect(mapOutcome("STATUS_FINAL_AET", "in")).toBeUndefined();
  });
});

describe("deriveRegulationScore — placar do tempo normal (90min)", () => {
  it("ENG@NOR (AET): exclui gol de prorrogação (93') → 1×1", () => {
    // home = NOR, away = ENG. NOR 36' (2101), ENG 45'+2' (2700 capado), ENG 93' (5554, prorrogação).
    const home = competitor("home", "NOR");
    const away = competitor("away", "ENG");
    const details = [
      goal({ clock: 2101, teamId: "NOR" }),
      goal({ clock: 2700, teamId: "ENG" }),
      card(6993, "NOR"),
      goal({ clock: 5554, teamId: "ENG" }), // prorrogação
    ];
    expect(deriveRegulationScore(details, home, away)).toEqual({ home: 1, away: 1 });
  });

  it("ARG@SUI (AET): exclui 2 gols de prorrogação (112', 120'+1') → 1×1", () => {
    const home = competitor("home", "ARG");
    const away = competitor("away", "SUI");
    const details = [
      goal({ clock: 576, teamId: "ARG" }), // 10'
      goal({ clock: 4015, teamId: "SUI" }), // 67'
      goal({ clock: 6701, teamId: "ARG" }), // 112' prorrogação
      goal({ clock: 7200, teamId: "ARG" }), // 120'+1' prorrogação
    ];
    expect(deriveRegulationScore(details, home, away)).toEqual({ home: 1, away: 1 });
  });

  it("details ausente → null", () => {
    const home = competitor("home", "ARG");
    const away = competitor("away", "SUI");
    expect(deriveRegulationScore(undefined, home, away)).toBeNull();
  });

  it("details vazio → null", () => {
    const home = competitor("home", "ARG");
    const away = competitor("away", "SUI");
    expect(deriveRegulationScore([], home, away)).toBeNull();
  });

  it("exclui gol de disputa de pênaltis (shootout: true)", () => {
    const home = competitor("home", "ARG");
    const away = competitor("away", "SUI");
    const details = [
      goal({ clock: 576, teamId: "ARG" }),
      goal({ clock: 7200, teamId: "ARG", shootout: true }), // pênalti de disputa
      goal({ clock: 7200, teamId: "SUI", shootout: true }),
    ];
    expect(deriveRegulationScore(details, home, away)).toEqual({ home: 1, away: 0 });
  });

  it("inclui gol de acréscimo capado no limite (clock == 5400)", () => {
    const home = competitor("home", "ARG");
    const away = competitor("away", "SUI");
    const details = [goal({ clock: 5400, teamId: "SUI" })]; // 90'+X capado
    expect(deriveRegulationScore(details, home, away)).toEqual({ home: 0, away: 1 });
  });

  it("gol contra (ownGoal) credita o lado adversário", () => {
    // ownGoal com team.id = ARG (home) deve contar para SUI (away).
    const home = competitor("home", "ARG");
    const away = competitor("away", "SUI");
    const details = [goal({ clock: 1200, teamId: "ARG", ownGoal: true })];
    expect(deriveRegulationScore(details, home, away)).toEqual({ home: 0, away: 1 });
  });

  // H1: displayValue é o critério primário — distingue "90'+4'" (normal) de
  // "94'" (prorrogação) mesmo se o clock.value contradisser.
  it("displayValue '90+4' conta como tempo normal mesmo com clock alto (>5400)", () => {
    const home = competitor("home", "ARG");
    const away = competitor("away", "SUI");
    // clock 5650 (>5400) mas displayValue "90'+4'" (base 90) → tempo normal.
    const details = [goal({ clock: 5650, display: "90'+4'", teamId: "ARG" })];
    expect(deriveRegulationScore(details, home, away)).toEqual({ home: 1, away: 0 });
  });

  it("displayValue '94' conta como prorrogação mesmo com clock baixo (<=5400)", () => {
    const home = competitor("home", "ARG");
    const away = competitor("away", "SUI");
    // clock 5390 (<=5400) mas displayValue "94'" (base 94) → prorrogação, excluído.
    const details = [goal({ clock: 5390, display: "94'", teamId: "ARG" })];
    expect(deriveRegulationScore(details, home, away)).toEqual({ home: 0, away: 0 });
  });

  // M1: sem team.id nos competidores → null (fallback ao placar final).
  it("competidor sem team.id → null", () => {
    const home = { homeAway: "home", score: 0, team: {} } as unknown as EspnCompetitor;
    const away = competitor("away", "SUI");
    const details = [goal({ clock: 600, teamId: "SUI" })];
    expect(deriveRegulationScore(details, home, away)).toBeNull();
  });

  // Conservador: gol de tempo normal sem tempo classificável → null.
  it("gol de tempo normal sem clock nem displayValue → null", () => {
    const home = competitor("home", "ARG");
    const away = competitor("away", "SUI");
    const details = [goal({ teamId: "ARG" })]; // sem clock.value nem display
    expect(deriveRegulationScore(details, home, away)).toBeNull();
  });

  // Conservador: gol de tempo normal com team.id de terceiro → null.
  it("gol de tempo normal não atribuível a nenhum lado → null", () => {
    const home = competitor("home", "ARG");
    const away = competitor("away", "SUI");
    const details = [goal({ clock: 600, teamId: "XXX" })];
    expect(deriveRegulationScore(details, home, away)).toBeNull();
  });
});
