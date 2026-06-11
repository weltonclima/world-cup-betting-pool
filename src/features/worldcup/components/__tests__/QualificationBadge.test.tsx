// @vitest-environment jsdom
/**
 * Testes do QualificationBadge (TASK-07).
 *
 * Verifica: mapeamento qualification → rótulo; indefinido → null (container vazio).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QualificationBadge } from "@/features/worldcup/components/QualificationBadge";

describe("QualificationBadge", () => {
  it("T1: classificado → exibe 'Classificado'", () => {
    render(<QualificationBadge qualification="classificado" />);
    expect(screen.getByText("Classificado")).toBeTruthy();
  });

  it("T2: possivel → exibe 'Possível classificado'", () => {
    render(<QualificationBadge qualification="possivel" />);
    expect(screen.getByText("Possível classificado")).toBeTruthy();
  });

  it("T3: eliminado → exibe 'Eliminado'", () => {
    render(<QualificationBadge qualification="eliminado" />);
    expect(screen.getByText("Eliminado")).toBeTruthy();
  });

  it("T4: indefinido → retorna null (container vazio)", () => {
    const { container } = render(<QualificationBadge qualification="indefinido" />);
    expect(container.firstChild).toBeNull();
  });

  it("T5: classificado → variante 'default' (bg-primary)", () => {
    render(<QualificationBadge qualification="classificado" />);
    const badge = screen.getByText("Classificado");
    // A variante default usa bg-primary (verificável via classe cva)
    expect(badge.className).toMatch(/bg-primary/);
  });

  it("T6: muted → variante 'muted' (bg-muted) para eliminado", () => {
    render(<QualificationBadge qualification="eliminado" />);
    const badge = screen.getByText("Eliminado");
    expect(badge.className).toMatch(/bg-muted/);
  });
});
