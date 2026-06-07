// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AccuracyCard,
  AccuracyCardSkeleton,
} from "@/features/home/components/AccuracyCard";

describe("AccuracyCard", () => {
  describe("com dados", () => {
    it("renderiza o aria-label correto no article", () => {
      render(<AccuracyCard accuracy={25} />);
      expect(
        screen.getByRole("article", { name: "Aproveitamento" }),
      ).toBeTruthy();
    });

    it("exibe o percentual arredondado com '%'", () => {
      render(<AccuracyCard accuracy={25} />);
      expect(screen.getByText("25%")).toBeTruthy();
    });

    it("arredonda o percentual corretamente", () => {
      render(<AccuracyCard accuracy={33.33} />);
      expect(screen.getByText("33%")).toBeTruthy();
    });

    it("exibe o label 'Aproveitamento'", () => {
      render(<AccuracyCard accuracy={25} />);
      // O label uppercase e o aria-label têm o mesmo texto base
      const labels = screen.getAllByText("Aproveitamento");
      // article aria-label é no DOM como atributo, mas o texto do span também existe
      expect(labels.length).toBeGreaterThanOrEqual(1);
    });

    it("exibe 0% quando accuracy é 0", () => {
      render(<AccuracyCard accuracy={0} />);
      expect(screen.getByText("0%")).toBeTruthy();
    });
  });

  describe("sem dados (accuracy null)", () => {
    it("exibe '--' quando accuracy é null", () => {
      render(<AccuracyCard accuracy={null} />);
      expect(screen.getByText("--")).toBeTruthy();
    });

    it("não exibe '%' quando accuracy é null", () => {
      render(<AccuracyCard accuracy={null} />);
      expect(screen.queryByText(/%/)).toBeNull();
    });
  });
});

describe("AccuracyCardSkeleton", () => {
  it("tem role='status' e aria-busy='true'", () => {
    render(<AccuracyCardSkeleton />);
    const el = screen.getByRole("status");
    expect(el).toBeTruthy();
    expect(el.getAttribute("aria-busy")).toBe("true");
  });

  it("tem aria-label 'Carregando Aproveitamento'", () => {
    render(<AccuracyCardSkeleton />);
    expect(
      screen.getByRole("status", { name: "Carregando Aproveitamento" }),
    ).toBeTruthy();
  });
});
