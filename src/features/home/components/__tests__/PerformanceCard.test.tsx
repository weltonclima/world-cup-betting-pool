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
  gamesPredicted: null,
  wrong: null,
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

    it("exibe '—' para jogos palpitados quando gamesPredicted é null (MVP D1)", () => {
      render(<PerformanceCard summary={mockSummary} />);
      const dashes = screen.getAllByText("—");
      expect(dashes.length).toBeGreaterThanOrEqual(2);
    });

    it("exibe labels de sub-métricas", () => {
      render(<PerformanceCard summary={mockSummary} />);
      expect(screen.getByText("Acertos")).toBeTruthy();
      expect(screen.getByText("Aproveitamento")).toBeTruthy();
      expect(screen.getByText("Jogos palpitados")).toBeTruthy();
      expect(screen.getByText("Erros")).toBeTruthy();
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
          summary={{ totalCorrect: 0, accuracy: 0, gamesPredicted: null, wrong: null }}
        />,
      );
      expect(screen.getByText("0")).toBeTruthy();
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
