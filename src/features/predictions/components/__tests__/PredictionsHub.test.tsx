// @vitest-environment jsdom
/**
 * Testes da tela Hub de Palpites (TASK-07, PRD03-01).
 *
 * Cobre:
 * - buildHubPhases (pura): status derivado + bloqueio A6 em cascata.
 * - PredictionsHub: render (título, progressbar, 7 cards), estados vazio /
 *   andamento / completo, bloqueio A6 (card sem link), links de navegação,
 *   aria, loading (role=status), error (role=alert + retry).
 *
 * Padrão de asserção: espelha MassPredictionPrimitives.test.tsx (toBeTruthy /
 * getAttribute). Componente é puro — sem mocks de hooks.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  PredictionsHub,
  buildHubPhases,
  type HubPhaseInput,
  type PhaseHubItem,
} from "../PredictionsHub";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<HubPhaseInput> = {}): HubPhaseInput {
  return {
    stage: "grupos",
    title: "Fase de Grupos",
    href: "/predictions/groups",
    gamesCount: 72,
    filledCount: 0,
    ...overrides,
  };
}

/** Sete fases na ordem fixa do Hub, com filled controlável por fase. */
function makePhases(
  fillByStage: Partial<Record<string, number>> = {},
): PhaseHubItem[] {
  const defs: HubPhaseInput[] = [
    makeInput({ stage: "grupos", title: "Fase de Grupos", href: "/predictions/groups", gamesCount: 72 }),
    makeInput({ stage: "dezesseis-avos", title: "16 Avos de Final", href: "/predictions/knockout/dezesseis-avos", gamesCount: 16 }),
    makeInput({ stage: "oitavas", title: "Oitavas de Final", href: "/predictions/knockout/oitavas", gamesCount: 8 }),
    makeInput({ stage: "quartas", title: "Quartas de Final", href: "/predictions/knockout/quartas", gamesCount: 4 }),
    makeInput({ stage: "semifinal", title: "Semifinal", href: "/predictions/knockout/semifinal", gamesCount: 2 }),
    makeInput({ stage: "terceiro", title: "Disputa de 3º Lugar", href: "/predictions/knockout/terceiro", gamesCount: 1 }),
    makeInput({ stage: "final", title: "Final", href: "/predictions/knockout/final", gamesCount: 1 }),
  ].map((d) => ({ ...d, filledCount: fillByStage[d.stage] ?? 0 }));
  return buildHubPhases(defs);
}

function renderHub(overrides: Partial<React.ComponentProps<typeof PredictionsHub>> = {}) {
  const props: React.ComponentProps<typeof PredictionsHub> = {
    filled: 32,
    total: 104,
    phases: makePhases({ grupos: 32 }),
    completeHref: "/predictions/groups",
    isComplete: false,
    isLoading: false,
    isError: false,
    onRetry: vi.fn(),
    ...overrides,
  };
  return render(<PredictionsHub {...props} />);
}

// ── buildHubPhases (regra A6) ───────────────────────────────────────────────────

describe("buildHubPhases (bloqueio A6)", () => {
  it("a primeira fase nunca é bloqueada", () => {
    const phases = buildHubPhases([makeInput({ filledCount: 0 })]);
    expect(phases[0]!.status).toBe("nao-iniciado");
  });

  it("deriva andamento / concluido / nao-iniciado pela contagem", () => {
    const phases = makePhases({ grupos: 72 }); // grupos completo
    expect(phases[0]!.status).toBe("concluido");
    // 16 avos: 0 preenchidos, grupos concluído → desbloqueado, nao-iniciado
    expect(phases[1]!.status).toBe("nao-iniciado");
  });

  it("bloqueia fases futuras enquanto a anterior não concluir", () => {
    const phases = makePhases({ grupos: 10 }); // grupos em andamento (10/72)
    expect(phases[0]!.status).toBe("andamento");
    // todas as fases seguintes ficam bloqueadas
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i]!.status).toBe("bloqueado");
    }
  });

  it("desbloqueia em cascata: concluir grupos libera 16 avos, mas não além", () => {
    const phases = makePhases({ grupos: 72, "dezesseis-avos": 4 });
    expect(phases[0]!.status).toBe("concluido");
    expect(phases[1]!.status).toBe("andamento"); // 16 avos liberado
    expect(phases[2]!.status).toBe("bloqueado"); // oitavas ainda bloqueada
  });

  it("fase com 0 jogos não destrava a seguinte", () => {
    const phases = buildHubPhases([
      makeInput({ stage: "grupos", gamesCount: 0, filledCount: 0 }),
      makeInput({ stage: "oitavas", gamesCount: 8, filledCount: 0, href: "/x" }),
    ]);
    expect(phases[0]!.status).toBe("nao-iniciado"); // 0 jogos → não concluído
    expect(phases[1]!.status).toBe("bloqueado");
  });

  it("calcula pendingCount = gamesCount - filledCount (clamp em 0)", () => {
    const phases = buildHubPhases([makeInput({ gamesCount: 6, filledCount: 4 })]);
    expect(phases[0]!.pendingCount).toBe(2);
    const over = buildHubPhases([makeInput({ gamesCount: 6, filledCount: 9 })]);
    expect(over[0]!.pendingCount).toBe(0);
  });
});

// ── PredictionsHub render ────────────────────────────────────────────────────────

describe("PredictionsHub — render", () => {
  it("renderiza título, progressbar e os 7 cards de fase", () => {
    renderHub();
    expect(screen.getByRole("heading", { name: "Meus Palpites" })).toBeTruthy();
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("32");
    expect(bar.getAttribute("aria-valuemax")).toBe("104");
    // 7 fases pelos títulos
    expect(screen.getByText("Fase de Grupos")).toBeTruthy();
    expect(screen.getByText("16 Avos de Final")).toBeTruthy();
    expect(screen.getByText("Final")).toBeTruthy();
  });

  it("reflete o progresso global no valuetext da barra", () => {
    renderHub({ filled: 50, total: 104 });
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuetext")).toContain("50 / 104");
  });
});

// ── Estados ──────────────────────────────────────────────────────────────────────

describe("PredictionsHub — estados", () => {
  it("estado vazio: copy de incentivo + CTA 'Ir para Fase de Grupos'", () => {
    renderHub({ filled: 0, phases: makePhases({}), completeHref: "/predictions/groups" });
    expect(screen.getByText("Ainda não há palpites")).toBeTruthy();
    const cta = screen.getByRole("link", { name: /Ir para Fase de Grupos/ });
    expect(cta.getAttribute("href")).toBe("/predictions/groups");
  });

  it("estado em andamento: CTA 'Completar Copa' com href do próximo passo", () => {
    renderHub({
      filled: 32,
      phases: makePhases({ grupos: 32 }),
      completeHref: "/predictions/groups",
    });
    const cta = screen.getByRole("link", { name: /Completar Copa/ });
    expect(cta.getAttribute("href")).toBe("/predictions/groups");
  });

  it("estado completo/enviado: banner de conclusão + CTA 'Ver Resumo Final'", () => {
    renderHub({
      filled: 104,
      total: 104,
      isComplete: true,
      phases: makePhases({
        grupos: 72,
        "dezesseis-avos": 16,
        oitavas: 8,
        quartas: 4,
        semifinal: 2,
        terceiro: 1,
        final: 1,
      }),
      completeHref: "/predictions/summary",
    });
    expect(screen.getByText("Copa completa!")).toBeTruthy();
    const cta = screen.getByRole("link", { name: /Ver Resumo Final/ });
    expect(cta.getAttribute("href")).toBe("/predictions/summary");
  });
});

// ── Bloqueio A6 no render ──────────────────────────────────────────────────────────

describe("PredictionsHub — bloqueio A6 (PRD03-16)", () => {
  it("fase de grupos é link; fases futuras bloqueadas não navegam", () => {
    renderHub({ filled: 10, phases: makePhases({ grupos: 10 }) });
    // Grupos navegável
    const grupos = screen.getByRole("link", { name: /Fase de Grupos/ });
    expect(grupos.getAttribute("href")).toBe("/predictions/groups");
    // 16 avos bloqueado → não existe link com esse nome
    expect(screen.queryByRole("link", { name: /16 Avos de Final/ })).toBeNull();
    // mas o card existe com aria-disabled
    const blocked = screen.getByLabelText(/16 Avos de Final/);
    expect(blocked.getAttribute("aria-disabled")).toBe("true");
  });

  it("concluir grupos torna 16 avos navegável", () => {
    renderHub({ filled: 72, phases: makePhases({ grupos: 72 }) });
    const avos = screen.getByRole("link", { name: /16 Avos de Final/ });
    expect(avos.getAttribute("href")).toBe("/predictions/knockout/dezesseis-avos");
  });
});

// ── Loading / Error ────────────────────────────────────────────────────────────────

describe("PredictionsHub — loading e error", () => {
  it("loading: renderiza role=status e não renderiza cards", () => {
    renderHub({ isLoading: true });
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByText("Fase de Grupos")).toBeNull();
  });

  it("error: role=alert + botão 'Tentar novamente' chama onRetry", () => {
    const onRetry = vi.fn();
    renderHub({ isError: true, onRetry });
    const alert = screen.getByRole("alert");
    expect(alert).toBeTruthy();
    const retry = within(alert).getByRole("button", { name: "Tentar novamente" });
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
