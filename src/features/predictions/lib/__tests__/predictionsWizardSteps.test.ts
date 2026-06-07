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

  it("resolve a etapa Grupos para /predictions/grupos e subrotas de grupo", () => {
    const gruposIndex = WIZARD_STEPS.findIndex((s) => s.key === "grupos");
    expect(resolveWizardStep("/predictions/grupos")).toBe(gruposIndex);
    expect(resolveWizardStep("/predictions/grupos/A")).toBe(gruposIndex);
    expect(resolveWizardStep("/predictions/grupos/L")).toBe(gruposIndex);
  });

  it("resolve as fases eliminatórias por slug", () => {
    expect(
      WIZARD_STEPS[resolveWizardStep("/predictions/chave/dezesseis-avos")!]?.key,
    ).toBe("dezesseis-avos");
    expect(WIZARD_STEPS[resolveWizardStep("/predictions/chave/oitavas")!]?.key).toBe(
      "oitavas",
    );
    expect(WIZARD_STEPS[resolveWizardStep("/predictions/chave/final")!]?.key).toBe(
      "final",
    );
  });

  it("resolve resumo-grupos, terceiros e resumo final", () => {
    expect(WIZARD_STEPS[resolveWizardStep("/predictions/resumo-grupos")!]?.key).toBe(
      "resumo-grupos",
    );
    expect(
      WIZARD_STEPS[resolveWizardStep("/predictions/melhores-terceiros")!]?.key,
    ).toBe("melhores-terceiros");
    expect(WIZARD_STEPS[resolveWizardStep("/predictions/resumo")!]?.key).toBe(
      "resumo",
    );
  });

  it("ignora query string e trailing slash", () => {
    expect(resolveWizardStep("/predictions/grupos?wizard=1")).toBe(
      WIZARD_STEPS.findIndex((s) => s.key === "grupos"),
    );
    expect(resolveWizardStep("/predictions/grupos/")).toBe(
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
    expect(nextStepHref("/predictions")).toBe("/predictions/grupos");
  });

  it("não tem Próximo na última etapa (Resumo final)", () => {
    expect(nextStepHref("/predictions/resumo")).toBeUndefined();
    expect(prevStepHref("/predictions/resumo")).toBe("/predictions/chave/final");
  });

  it("avança e retrocede no meio da sequência", () => {
    expect(nextStepHref("/predictions/chave/oitavas")).toBe(
      "/predictions/chave/quartas",
    );
    expect(prevStepHref("/predictions/chave/oitavas")).toBe(
      "/predictions/chave/dezesseis-avos",
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
    expect(stepLabel("/predictions/grupos")).toBe("Grupos");
    expect(stepLabel("/matches")).toBeNull();
  });
});
