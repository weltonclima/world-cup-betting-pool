// @vitest-environment jsdom
/**
 * Testes do HeroCard (TASK-01 home-revamp).
 *
 * Componente presentacional: recebe HeroSummary por prop. O sparkline (recharts)
 * é isolado via mock de ChartContainer — o equivalente textual (sr-only) fica
 * fora dele e segue testável. Foco: hierarquia visual, estados condicionais e a11y.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// recharts/ResponsiveContainer exige ResizeObserver (ausente no jsdom) — mockar
// o ChartContainer como passthrough leve evita o gráfico real, sem afetar o
// resto do HeroCard (o texto alternativo do sparkline é irmão, não filho).
vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sparkline-chart">{children}</div>
  ),
}));

import type { HeroSummary } from "@/features/home/lib/homeDashboardHelpers";

import { HeroCard, HeroCardSkeleton } from "../HeroCard";

// ── fixtures ─────────────────────────────────────────────────────────────────

function makeHero(overrides: Partial<HeroSummary> = {}): HeroSummary {
  return {
    position: 3,
    totalParticipants: 20,
    points: 128,
    trend: null,
    accuracy: 72,
    totalCorrect: 18,
    denominator: 25,
    longestStreak: 5,
    sparkline: null,
    ruler: null,
    isEmpty: false,
    ...overrides,
  };
}

// ── empty-state ──────────────────────────────────────────────────────────────

describe("HeroCard — empty-state", () => {
  it("exibe mensagem útil quando isEmpty", () => {
    render(<HeroCard summary={makeHero({ isEmpty: true })} />);
    expect(
      screen.getByText("Seu desempenho aparece aqui após o primeiro jogo."),
    ).toBeTruthy();
    // Não renderiza a posição no empty-state
    expect(screen.queryByText("#3")).toBeNull();
  });
});

// ── render principal ───────────────────────────────────────────────────────────

describe("HeroCard — render", () => {
  it("exibe posição, total e pontos", () => {
    render(<HeroCard summary={makeHero()} />);
    expect(screen.getByText("#3")).toBeTruthy();
    expect(screen.getByText("de 20")).toBeTruthy();
    expect(screen.getByText("128 pts")).toBeTruthy();
  });

  it("exibe aproveitamento com denominador", () => {
    render(<HeroCard summary={makeHero({ accuracy: 72 })} />);
    expect(screen.getByText("72%")).toBeTruthy();
    expect(screen.getByText("18 de 25 palpites")).toBeTruthy();
  });

  it("omite a linha de denominador quando denominator é null", () => {
    render(<HeroCard summary={makeHero({ denominator: null })} />);
    expect(screen.getByText("72%")).toBeTruthy();
    expect(screen.queryByText(/palpites/)).toBeNull();
  });

  it("exibe maior sequência", () => {
    render(<HeroCard summary={makeHero({ longestStreak: 5 })} />);
    expect(screen.getByText("Maior sequência")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("arredonda aproveitamento fracionário", () => {
    render(<HeroCard summary={makeHero({ accuracy: 66.6 })} />);
    expect(screen.getByText("67%")).toBeTruthy();
  });
});

// ── tendência ──────────────────────────────────────────────────────────────────

describe("HeroCard — tendência", () => {
  it("não renderiza chip quando trend é null", () => {
    render(<HeroCard summary={makeHero({ trend: null })} />);
    expect(screen.queryByLabelText(/Tendência/)).toBeNull();
  });

  it("subiu: aria-label com ícone+texto (não só cor)", () => {
    render(
      <HeroCard summary={makeHero({ trend: { direction: "up", delta: 2, roundLabel: "R5" } })} />,
    );
    expect(screen.getByLabelText("Tendência: Subiu 2 (R5)")).toBeTruthy();
  });

  it("caiu: aria-label de queda", () => {
    render(
      <HeroCard summary={makeHero({ trend: { direction: "down", delta: 3, roundLabel: null } })} />,
    );
    expect(screen.getByLabelText("Tendência: Caiu 3")).toBeTruthy();
  });

  it("estável: aria-label estável", () => {
    render(
      <HeroCard summary={makeHero({ trend: { direction: "stable", delta: 0, roundLabel: null } })} />,
    );
    expect(screen.getByLabelText("Tendência: Estável")).toBeTruthy();
  });
});

// ── sparkline ──────────────────────────────────────────────────────────────────

describe("HeroCard — sparkline", () => {
  it("não renderiza quando sparkline é null", () => {
    render(<HeroCard summary={makeHero({ sparkline: null })} />);
    expect(screen.queryByTestId("sparkline-chart")).toBeNull();
  });

  it("renderiza com equivalente textual (sr-only) quando há série", () => {
    render(<HeroCard summary={makeHero({ sparkline: [8, 5, 3] })} />);
    expect(screen.getByTestId("sparkline-chart")).toBeTruthy();
    expect(
      screen.getByText("Evolução da posição: 8 a 3 nas últimas 3 atualizações."),
    ).toBeTruthy();
  });
});

// ── régua ──────────────────────────────────────────────────────────────────────

describe("HeroCard — régua", () => {
  const ruler: NonNullable<HeroSummary["ruler"]> = {
    lowest: 12,
    average: 96,
    highest: 210,
    userPoints: 128,
    fraction: 0.585,
    averageFraction: 0.424,
    label: "acima da média",
  };

  it("não renderiza quando ruler é null", () => {
    render(<HeroCard summary={makeHero({ ruler: null })} />);
    expect(screen.queryByText("Você no bolão")).toBeNull();
  });

  it("renderiza com aria-label descritivo e valores visíveis", () => {
    render(<HeroCard summary={makeHero({ ruler })} />);
    expect(screen.getByText("Você no bolão")).toBeTruthy();
    expect(screen.getByText("acima da média")).toBeTruthy();
    expect(screen.getByText("mín 12")).toBeTruthy();
    expect(screen.getByText("máx 210")).toBeTruthy();
    const svg = screen.getByRole("img");
    expect(svg.getAttribute("aria-label")).toContain("Você tem 128 pontos");
    expect(svg.getAttribute("aria-label")).toContain("acima da média");
  });
});

// ── skeleton ─────────────────────────────────────────────────────────────────

describe("HeroCardSkeleton", () => {
  it("expõe role status com aria-busy", () => {
    render(<HeroCardSkeleton />);
    const sk = screen.getByRole("status");
    expect(sk.getAttribute("aria-busy")).toBe("true");
  });
});
