// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RankingCard, RankingCardSkeleton } from "@/features/home/components/RankingCard";
import type { RankingSummary } from "@/features/home/lib/homeDashboardHelpers";

const mockSummary: RankingSummary = {
  position: 4,
  totalParticipants: 28,
  points: 12,
};

describe("RankingCard", () => {
  describe("com dados", () => {
    it("renderiza o aria-label correto no article", () => {
      render(<RankingCard summary={mockSummary} />);
      expect(
        screen.getByRole("article", { name: "Ranking Geral" }),
      ).toBeTruthy();
    });

    it("exibe a posição formatada como #N", () => {
      render(<RankingCard summary={mockSummary} />);
      expect(screen.getByText("#4")).toBeTruthy();
    });

    it("exibe o total de participantes", () => {
      render(<RankingCard summary={mockSummary} />);
      expect(screen.getByText("de 28 participantes")).toBeTruthy();
    });

    it("exibe os pontos do usuário", () => {
      render(<RankingCard summary={mockSummary} />);
      expect(screen.getByText("12 pontos")).toBeTruthy();
    });

    it("exibe o label 'RANKING' (uppercase via CSS, texto base 'Ranking')", () => {
      render(<RankingCard summary={mockSummary} />);
      expect(screen.getByText("Ranking")).toBeTruthy();
    });
  });

  describe("sem dados (summary null)", () => {
    it("exibe dash '--' no lugar da posição", () => {
      render(<RankingCard summary={null} />);
      expect(screen.getByText("--")).toBeTruthy();
    });

    it("exibe fallback de participantes", () => {
      render(<RankingCard summary={null} />);
      expect(screen.getByText("de -- participantes")).toBeTruthy();
    });

    it("não exibe pontos quando summary é null", () => {
      render(<RankingCard summary={null} />);
      expect(screen.queryByText(/pontos/)).toBeNull();
    });
  });
});

describe("RankingCardSkeleton", () => {
  it("tem role='status' e aria-busy='true'", () => {
    render(<RankingCardSkeleton />);
    const el = screen.getByRole("status");
    expect(el).toBeTruthy();
    expect(el.getAttribute("aria-busy")).toBe("true");
  });

  it("tem aria-label 'Carregando Ranking Geral'", () => {
    render(<RankingCardSkeleton />);
    expect(
      screen.getByRole("status", { name: "Carregando Ranking Geral" }),
    ).toBeTruthy();
  });
});
