// @vitest-environment jsdom
/**
 * Testes do RaioXCard (TASK-03 home-revamp).
 * Componente presentacional puro — assertions estruturais (donut/legenda/empty).
 * Contrato: ai/spec/task-home-revamp-03.md §9 + ai/ui-spec/task-home-revamp-03.md §7.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PredictionBreakdown } from "@/features/home/lib/homeDashboardHelpers";

import { RaioXCard, RaioXCardSkeleton } from "../RaioXCard";

// ── fixtures ──────────────────────────────────────────────────────────────────

function makeBreakdown(
  overrides: Partial<PredictionBreakdown> = {},
): PredictionBreakdown {
  return {
    correct: 2,
    partial: 1,
    wrong: 1,
    total: 4,
    isEmpty: false,
    ...overrides,
  };
}

const emptyBreakdown: PredictionBreakdown = {
  correct: 0,
  partial: 0,
  wrong: 0,
  total: 0,
  isEmpty: true,
};

// ── empty-state ────────────────────────────────────────────────────────────────

describe("RaioXCard — empty-state", () => {
  it("exibe mensagem de empty quando isEmpty é true", () => {
    render(<RaioXCard breakdown={emptyBreakdown} />);
    expect(
      screen.getByText("Faça seu primeiro palpite para ver seu raio-X."),
    ).toBeTruthy();
  });

  it("NÃO renderiza o donut (svg) no empty-state", () => {
    const { container } = render(<RaioXCard breakdown={emptyBreakdown} />);
    expect(container.querySelector("svg.recharts-surface")).toBeNull();
  });

  it("mantém o aria-label do card no empty-state", () => {
    render(<RaioXCard breakdown={emptyBreakdown} />);
    expect(
      screen.getByRole("article", { name: "Raio-X dos Palpites" }),
    ).toBeTruthy();
  });
});

// ── estado com dados ────────────────────────────────────────────────────────────

describe("RaioXCard — com dados", () => {
  it("NÃO exibe mensagem de empty quando há palpites", () => {
    render(<RaioXCard breakdown={makeBreakdown()} />);
    expect(
      screen.queryByText("Faça seu primeiro palpite para ver seu raio-X."),
    ).toBeNull();
  });

  it("exibe o total no centro do donut", () => {
    render(<RaioXCard breakdown={makeBreakdown({ total: 4 })} />);
    const card = screen.getByRole("article", { name: "Raio-X dos Palpites" });
    expect(within(card).getByText("4")).toBeTruthy();
    expect(within(card).getByText("palpites")).toBeTruthy();
  });

  it("exibe rótulos das 3 categorias na legenda", () => {
    render(<RaioXCard breakdown={makeBreakdown()} />);
    expect(screen.getByText("Exato")).toBeTruthy();
    expect(screen.getByText("Vencedor")).toBeTruthy();
    expect(screen.getByText("Erro")).toBeTruthy();
  });

  it("exibe contagem e percentual por categoria", () => {
    // 2/4=50%, 1/4=25%, 1/4=25%
    render(<RaioXCard breakdown={makeBreakdown({ correct: 2, partial: 1, wrong: 1, total: 4 })} />);
    expect(screen.getByText("2 (50%)")).toBeTruthy();
    expect(screen.getAllByText("1 (25%)").length).toBe(2);
  });

  it("exibe categoria zerada como '0 (0%)' na legenda", () => {
    render(<RaioXCard breakdown={makeBreakdown({ correct: 3, partial: 0, wrong: 0, total: 3 })} />);
    expect(screen.getByText("3 (100%)")).toBeTruthy();
    expect(screen.getAllByText("0 (0%)").length).toBe(2);
  });

  it("usa singular 'palpite' quando total é 1", () => {
    render(<RaioXCard breakdown={makeBreakdown({ correct: 1, partial: 0, wrong: 0, total: 1 })} />);
    const card = screen.getByRole("article", { name: "Raio-X dos Palpites" });
    expect(within(card).getByText("palpite")).toBeTruthy();
  });

  it("expõe o donut como imagem com equivalente textual (a11y)", () => {
    // ChartContainer não repassa aria-label ao div; o label tem de ficar
    // num elemento real (role=img) para chegar ao leitor de tela.
    render(<RaioXCard breakdown={makeBreakdown({ correct: 2, partial: 1, wrong: 1, total: 4 })} />);
    expect(
      screen.getByRole("img", {
        name: "2 placares exatos, 1 só vencedor, 1 erro",
      }),
    ).toBeTruthy();
  });
});

// ── skeleton ────────────────────────────────────────────────────────────────────

describe("RaioXCardSkeleton", () => {
  it("tem role='status' e aria-busy='true'", () => {
    render(<RaioXCardSkeleton />);
    const sk = screen.getByRole("status");
    expect(sk.getAttribute("aria-busy")).toBe("true");
  });

  it("tem aria-label descritivo", () => {
    render(<RaioXCardSkeleton />);
    expect(
      screen.getByRole("status", { name: "Carregando raio-X dos palpites" }),
    ).toBeTruthy();
  });
});
