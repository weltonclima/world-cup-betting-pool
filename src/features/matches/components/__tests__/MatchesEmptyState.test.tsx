// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MatchesEmptyState } from "@/features/matches/components/MatchesEmptyState";

describe("MatchesEmptyState", () => {
  it("T1: exibe mensagem default 'Nenhum jogo encontrado'", () => {
    render(<MatchesEmptyState />);
    expect(screen.getByText("Nenhum jogo encontrado")).toBeTruthy();
  });

  it("T2: aceita message customizada", () => {
    render(<MatchesEmptyState message="Nenhum resultado para esta fase" />);
    expect(screen.getByText("Nenhum resultado para esta fase")).toBeTruthy();
  });

  it("T3: exibe subtítulo quando fornecido", () => {
    render(<MatchesEmptyState subtitle="Tente ajustar os filtros" />);
    expect(screen.getByText("Tente ajustar os filtros")).toBeTruthy();
  });

  it("T4: não exibe subtítulo quando não fornecido", () => {
    render(<MatchesEmptyState />);
    expect(screen.queryByText(/Tente/)).toBeNull();
  });

  it("T5: tem role='status'", () => {
    render(<MatchesEmptyState />);
    expect(screen.getByRole("status")).toBeTruthy();
  });
});
