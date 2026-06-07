// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GameStatusBadge } from "@/features/matches/components/GameStatusBadge";

describe("GameStatusBadge", () => {
  it("T1: renderiza 'Agendado' para status scheduled", () => {
    render(<GameStatusBadge status="scheduled" />);
    expect(screen.getByText("Agendado")).toBeTruthy();
  });

  it("T2: renderiza 'Ao Vivo' para status live", () => {
    render(<GameStatusBadge status="live" />);
    expect(screen.getByText("Ao Vivo")).toBeTruthy();
  });

  it("T3: renderiza 'Encerrado' para status finished", () => {
    render(<GameStatusBadge status="finished" />);
    expect(screen.getByText("Encerrado")).toBeTruthy();
  });

  it("T4: renderiza 'Adiado' para status postponed", () => {
    render(<GameStatusBadge status="postponed" />);
    expect(screen.getByText("Adiado")).toBeTruthy();
  });

  it("T5: renderiza 'Cancelado' para status canceled", () => {
    render(<GameStatusBadge status="canceled" />);
    expect(screen.getByText("Cancelado")).toBeTruthy();
  });

  it("T6: aplica classe azul para scheduled", () => {
    const { container } = render(<GameStatusBadge status="scheduled" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toMatch(/blue/);
  });

  it("T7: aplica classe verde para live", () => {
    const { container } = render(<GameStatusBadge status="live" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toMatch(/green/);
  });

  it("T8: aplica classe cinza para finished", () => {
    const { container } = render(<GameStatusBadge status="finished" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toMatch(/gray/);
  });

  it("T9: aceita className adicional", () => {
    const { container } = render(<GameStatusBadge status="scheduled" className="test-extra" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("test-extra");
  });
});
