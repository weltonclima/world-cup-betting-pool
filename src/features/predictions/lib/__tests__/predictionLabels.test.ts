/**
 * TDD RED — TASK-01 (regra-empate-parcial)
 * Garante que os Records exaustivos cobrem o novo display status "acertou_empate".
 */
import { describe, expect, it } from "vitest";

import {
  PREDICTION_DISPLAY_STATUS_COLOR,
  PREDICTION_DISPLAY_STATUS_LABEL,
} from "@/features/predictions/lib/predictionLabels";
import type { PredictionDisplayStatus } from "@/features/predictions/lib";

const ALL_STATUSES: PredictionDisplayStatus[] = [
  "pendente",
  "acertou",
  "acertou_vencedor",
  "acertou_empate",
  "errou",
  "bloqueado",
];

describe("predictionLabels — cobertura exaustiva", () => {
  it("LABEL tem entrada não-vazia para todo display status (incl. acertou_empate)", () => {
    for (const status of ALL_STATUSES) {
      expect(PREDICTION_DISPLAY_STATUS_LABEL[status]).toBeTruthy();
    }
  });

  it("COLOR tem classe não-vazia para todo display status (incl. acertou_empate)", () => {
    for (const status of ALL_STATUSES) {
      expect(PREDICTION_DISPLAY_STATUS_COLOR[status]).toBeTruthy();
    }
  });

  it("acertou_empate tem label pt-BR de empate", () => {
    expect(PREDICTION_DISPLAY_STATUS_LABEL.acertou_empate).toMatch(/empate/i);
  });

  it("acertou_empate tem cor distinta de acertou_vencedor, acertou e errou", () => {
    const empate = PREDICTION_DISPLAY_STATUS_COLOR.acertou_empate;
    expect(empate).not.toBe(PREDICTION_DISPLAY_STATUS_COLOR.acertou_vencedor);
    expect(empate).not.toBe(PREDICTION_DISPLAY_STATUS_COLOR.acertou);
    expect(empate).not.toBe(PREDICTION_DISPLAY_STATUS_COLOR.errou);
  });
});
