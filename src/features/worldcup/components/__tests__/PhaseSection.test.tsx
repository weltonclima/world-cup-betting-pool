// @vitest-environment jsdom
/**
 * Testes do PhaseSection (TASK-08).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PhaseSection } from "@/features/worldcup/components/PhaseSection";
import type { KnockoutMatch } from "@/types/worldcup";

const MATCHES: KnockoutMatch[] = [
  {
    id: "m73",
    phase: "oitavas",
    homeTeam: { name: "Brasil", code: "BRA", defined: true },
    awayTeam: { name: "Uruguai", code: "URU", defined: true },
    status: "definido",
  },
  {
    id: "m74",
    phase: "oitavas",
    homeTeam: { name: "Argentina", code: "ARG", defined: true },
    awayTeam: { name: "México", code: "MEX", defined: true },
    status: "definido",
  },
];

describe("PhaseSection", () => {
  it("T1: renderiza o rótulo da fase", () => {
    render(<PhaseSection label="Oitavas de Final" matches={MATCHES} />);
    expect(screen.getByRole("heading", { name: "Oitavas de Final" })).toBeTruthy();
  });

  it("T2: renderiza um card por confronto", () => {
    render(<PhaseSection label="Oitavas de Final" matches={MATCHES} />);
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("Uruguai")).toBeTruthy();
    expect(screen.getByText("Argentina")).toBeTruthy();
    expect(screen.getByText("México")).toBeTruthy();
  });

  it("T3: é uma <section> rotulada pelo título", () => {
    render(<PhaseSection label="Oitavas de Final" matches={MATCHES} />);
    expect(screen.getByRole("region", { name: "Oitavas de Final" })).toBeTruthy();
  });

  it("T4: retorna null quando não há confrontos", () => {
    const { container } = render(<PhaseSection label="Final" matches={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
