// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  PerformanceCard,
  PerformanceCardSkeleton,
} from "@/features/home/components/PerformanceCard";
import type { PerformanceSummary } from "@/features/home/lib/homeDashboardHelpers";

const mockSummary: PerformanceSummary = {
  totalCorrect: 12,
  accuracy: 25,
  longestStreak: 4,
  gamesPredicted: 48,
};

describe("PerformanceCard", () => {
  describe("com dados completos", () => {
    it("renderiza o aria-label correto no article", () => {
      render(<PerformanceCard summary={mockSummary} />);
      expect(
        screen.getByRole("article", { name: "Meu Desempenho" }),
      ).toBeTruthy();
    });

    it("exibe o título 'Meu Desempenho'", () => {
      render(<PerformanceCard summary={mockSummary} />);
      expect(screen.getByText("Meu Desempenho")).toBeTruthy();
    });

    it("exibe o total de acertos", () => {
      render(<PerformanceCard summary={mockSummary} />);
      expect(screen.getByText("12")).toBeTruthy();
    });

    it("exibe o aproveitamento como percentual arredondado", () => {
      render(<PerformanceCard summary={mockSummary} />);
      expect(screen.getByText("25%")).toBeTruthy();
    });

    it("exibe maior sequência de acertos (longestStreak)", () => {
      render(<PerformanceCard summary={mockSummary} />);
      expect(screen.getByText("4")).toBeTruthy();
    });

    it("exibe total de palpites (gamesPredicted)", () => {
      render(<PerformanceCard summary={mockSummary} />);
      expect(screen.getByText("48")).toBeTruthy();
    });

    it("exibe labels de sub-métricas conforme contrato §3.7", () => {
      render(<PerformanceCard summary={mockSummary} />);
      expect(screen.getByText("Acertos")).toBeTruthy();
      expect(screen.getByText("Aproveitamento")).toBeTruthy();
      expect(screen.getByText("Maior sequência")).toBeTruthy();
      expect(screen.getByText("Palpites")).toBeTruthy();
    });
  });

  describe("com accuracy fracionada", () => {
    it("arredonda a accuracy corretamente", () => {
      render(
        <PerformanceCard
          summary={{ ...mockSummary, accuracy: 33.33 }}
        />,
      );
      expect(screen.getByText("33%")).toBeTruthy();
    });
  });

  describe("com totalCorrect = 0", () => {
    it("exibe 0 acertos e 0% aproveitamento", () => {
      render(
        <PerformanceCard
          summary={{ totalCorrect: 0, accuracy: 0, longestStreak: 0, gamesPredicted: 0 }}
        />,
      );
      // Múltiplos zeros presentes — verificar por getAllByText
      expect(screen.getAllByText("0").length).toBeGreaterThan(0);
      expect(screen.getByText("0%")).toBeTruthy();
    });
  });
});

describe("PerformanceCardSkeleton", () => {
  it("tem role='status' e aria-busy='true'", () => {
    render(<PerformanceCardSkeleton />);
    const el = screen.getByRole("status");
    expect(el).toBeTruthy();
    expect(el.getAttribute("aria-busy")).toBe("true");
  });

  it("tem aria-label 'Carregando Meu Desempenho'", () => {
    render(<PerformanceCardSkeleton />);
    expect(
      screen.getByRole("status", { name: "Carregando Meu Desempenho" }),
    ).toBeTruthy();
  });
});
