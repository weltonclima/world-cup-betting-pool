// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MatchStatusBadge } from "@/features/matches/components/MatchStatusBadge";

describe("MatchStatusBadge", () => {
  it("T1: renderiza 'Palpite Enviado' para status enviado", () => {
    render(<MatchStatusBadge status="enviado" />);
    expect(screen.getByText("Palpite Enviado")).toBeTruthy();
  });

  it("T2: renderiza 'Palpite Pendente' para status pendente", () => {
    render(<MatchStatusBadge status="pendente" />);
    expect(screen.getByText("Palpite Pendente")).toBeTruthy();
  });

  it("T3: renderiza 'Palpite Bloqueado' para status bloqueado", () => {
    render(<MatchStatusBadge status="bloqueado" />);
    expect(screen.getByText("Palpite Bloqueado")).toBeTruthy();
  });

  it("T4: aplica classe de cor verde para status enviado", () => {
    const { container } = render(<MatchStatusBadge status="enviado" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toMatch(/green/);
  });

  it("T5: aplica classe de cor âmbar para status pendente", () => {
    const { container } = render(<MatchStatusBadge status="pendente" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toMatch(/amber/);
  });

  it("T6: aplica classe de cor cinza para status bloqueado", () => {
    const { container } = render(<MatchStatusBadge status="bloqueado" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toMatch(/gray/);
  });

  it("T7: aceita className adicional", () => {
    const { container } = render(<MatchStatusBadge status="enviado" className="test-extra" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("test-extra");
  });
});
