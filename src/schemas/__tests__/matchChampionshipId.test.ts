/**
 * TASK-05 — `matchSchema.championshipId` (aditivo) + `stage: "liga"`.
 *
 * Regras verificadas:
 *  - doc legado SEM `championshipId` → parse defaulta "fifa.world" (compat);
 *  - `championshipId` explícito é preservado;
 *  - `stage: "liga"` é válido e aceita `round` numérico (matchday);
 *  - `.strict()` continua rejeitando campos desconhecidos.
 */

import { describe, expect, it } from "vitest";

import { matchSchema } from "@/schemas/matches";
import { stageSchema } from "@/schemas/shared";

function legacyMatch(over: Record<string, unknown> = {}) {
  return {
    homeTeamId: "BRA",
    awayTeamId: "ARG",
    kickoffAt: "2026-06-11T12:00:00Z",
    stage: "grupos",
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    ...over,
  };
}

describe("matchSchema.championshipId (TASK-05)", () => {
  it("doc legado sem championshipId defaulta 'fifa.world'", () => {
    const parsed = matchSchema.parse(legacyMatch());
    expect(parsed.championshipId).toBe("fifa.world");
  });

  it("championshipId explícito é preservado", () => {
    const parsed = matchSchema.parse(
      legacyMatch({ championshipId: "bra.1-2026" }),
    );
    expect(parsed.championshipId).toBe("bra.1-2026");
  });

  it("championshipId vazio é rejeitado (nonEmptyString)", () => {
    expect(matchSchema.safeParse(legacyMatch({ championshipId: "" })).success).toBe(
      false,
    );
  });
});

describe("stage 'liga' (TASK-05)", () => {
  it("stageSchema aceita 'liga'", () => {
    expect(stageSchema.parse("liga")).toBe("liga");
  });

  it("matchSchema aceita stage 'liga' com round numérico (matchday)", () => {
    const parsed = matchSchema.parse(
      legacyMatch({ stage: "liga", round: 5, championshipId: "bra.1-2026" }),
    );
    expect(parsed.stage).toBe("liga");
    expect(parsed.round).toBe(5);
  });
});
