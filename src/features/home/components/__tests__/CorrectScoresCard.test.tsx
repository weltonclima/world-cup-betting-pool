// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  CorrectScoresCard,
  CorrectScoresCardSkeleton,
} from "@/features/home/components/CorrectScoresCard";

describe("CorrectScoresCard", () => {
  describe("com dados", () => {
    it("renderiza o aria-label correto no article", () => {
      render(<CorrectScoresCard totalCorrect={12} />);
      expect(screen.getByRole("article", { name: "Acertos" })).toBeTruthy();
    });

    it("exibe o número de acertos", () => {
      render(<CorrectScoresCard totalCorrect={12} />);
      expect(screen.getByText("12")).toBeTruthy();
    });

    it("exibe o label 'Placares exatos'", () => {
      render(<CorrectScoresCard totalCorrect={12} />);
      expect(screen.getByText("Placares exatos")).toBeTruthy();
    });

    it("exibe 0 acertos corretamente", () => {
      render(<CorrectScoresCard totalCorrect={0} />);
      expect(screen.getByText("0")).toBeTruthy();
    });
  });

  describe("sem dados (totalCorrect null)", () => {
    it("exibe '--' quando totalCorrect é null", () => {
      render(<CorrectScoresCard totalCorrect={null} />);
      expect(screen.getByText("--")).toBeTruthy();
    });

    it("ainda exibe o label 'Placares exatos'", () => {
      render(<CorrectScoresCard totalCorrect={null} />);
      expect(screen.getByText("Placares exatos")).toBeTruthy();
    });
  });
});

describe("CorrectScoresCardSkeleton", () => {
  it("tem role='status' e aria-busy='true'", () => {
    render(<CorrectScoresCardSkeleton />);
    const el = screen.getByRole("status");
    expect(el).toBeTruthy();
    expect(el.getAttribute("aria-busy")).toBe("true");
  });

  it("tem aria-label 'Carregando Acertos'", () => {
    render(<CorrectScoresCardSkeleton />);
    expect(
      screen.getByRole("status", { name: "Carregando Acertos" }),
    ).toBeTruthy();
  });
});
