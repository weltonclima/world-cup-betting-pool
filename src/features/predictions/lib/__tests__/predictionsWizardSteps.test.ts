/**
 * Testes da sequência canônica do wizard (TASK-16).
 * Cobre resolveWizardStep (match mais específico, fora do wizard→null) e
 * next/prev nas bordas e no meio da sequência.
 */

import { describe, expect, it } from "vitest";

import {
  WIZARD_STEPS,
  WIZARD_TOTAL_STEPS,
  nextStepHref,
  prevStepHref,
  resolveWizardStep,
  stepLabel,
} from "@/features/predictions/lib/predictionsWizardSteps";

describe("resolveWizardStep", () => {
  it("resolve o Hub na primeira etapa", () => {
    expect(resolveWizardStep("/predictions")).toBe(0);
  });

  it("resolve a etapa Grupos para /predictions/groups e subrotas de grupo", () => {
    const gruposIndex = WIZARD_STEPS.findIndex((s) => s.key === "grupos");
    expect(resolveWizardStep("/predictions/groups")).toBe(gruposIndex);
    expect(resolveWizardStep("/predictions/groups/A")).toBe(gruposIndex);
    expect(resolveWizardStep("/predictions/groups/L")).toBe(gruposIndex);
  });

  it("resolve as fases eliminatórias por slug", () => {
    expect(
      WIZARD_STEPS[resolveWizardStep("/predictions/knockout/dezesseis-avos")!]?.key,
    ).toBe("dezesseis-avos");
    expect(WIZARD_STEPS[resolveWizardStep("/predictions/knockout/oitavas")!]?.key).toBe(
      "oitavas",
    );
    expect(WIZARD_STEPS[resolveWizardStep("/predictions/knockout/final")!]?.key).toBe(
      "final",
    );
  });

  it("resolve resumo-grupos, terceiros e resumo final", () => {
    expect(WIZARD_STEPS[resolveWizardStep("/predictions/groups-summary")!]?.key).toBe(
      "resumo-grupos",
    );
    expect(
      WIZARD_STEPS[resolveWizardStep("/predictions/best-thirds")!]?.key,
    ).toBe("melhores-terceiros");
    expect(WIZARD_STEPS[resolveWizardStep("/predictions/summary")!]?.key).toBe(
      "resumo",
    );
  });

  it("ignora query string e trailing slash", () => {
    expect(resolveWizardStep("/predictions/groups?wizard=1")).toBe(
      WIZARD_STEPS.findIndex((s) => s.key === "grupos"),
    );
    expect(resolveWizardStep("/predictions/groups/")).toBe(
      WIZARD_STEPS.findIndex((s) => s.key === "grupos"),
    );
  });

  it("retorna null fora do wizard", () => {
    expect(resolveWizardStep("/matches")).toBeNull();
    expect(resolveWizardStep("/matches/123/predict")).toBeNull();
    expect(resolveWizardStep("/rankings")).toBeNull();
  });
});

describe("nextStepHref / prevStepHref", () => {
  it("não tem Anterior na primeira etapa (Hub)", () => {
    expect(prevStepHref("/predictions")).toBeUndefined();
    expect(nextStepHref("/predictions")).toBe("/predictions/groups");
  });

  it("não tem Próximo na última etapa (Resumo final)", () => {
    expect(nextStepHref("/predictions/summary")).toBeUndefined();
    expect(prevStepHref("/predictions/summary")).toBe("/predictions/knockout/final");
  });

  it("avança e retrocede no meio da sequência", () => {
    expect(nextStepHref("/predictions/knockout/oitavas")).toBe(
      "/predictions/knockout/quartas",
    );
    expect(prevStepHref("/predictions/knockout/oitavas")).toBe(
      "/predictions/knockout/dezesseis-avos",
    );
  });

  it("retorna undefined fora do wizard", () => {
    expect(nextStepHref("/rankings")).toBeUndefined();
    expect(prevStepHref("/rankings")).toBeUndefined();
  });
});

describe("stepLabel / total", () => {
  it("expõe o total de etapas", () => {
    expect(WIZARD_TOTAL_STEPS).toBe(WIZARD_STEPS.length);
  });

  it("retorna o rótulo da etapa atual e null fora do wizard", () => {
    expect(stepLabel("/predictions/groups")).toBe("Grupos");
    expect(stepLabel("/matches")).toBeNull();
  });
});
