// @vitest-environment jsdom
/**
 * Testes do CupOnlyNotice (TASK-10) — aviso "recurso só para copas".
 *
 * Contrato relevante: renderiza a mensagem, expõe `role="status"` (SR anuncia),
 * ícone `aria-hidden` (decorativo), ícone default Trophy substituível e merge de
 * className extra sobre as classes base.
 */

import { render, screen } from "@testing-library/react";
import { Swords } from "lucide-react";
import { describe, expect, it } from "vitest";

import { CupOnlyNotice } from "../CupOnlyNotice";

describe("CupOnlyNotice", () => {
  it("renderiza a mensagem fornecida", () => {
    render(<CupOnlyNotice message="Só para copas." />);
    expect(screen.getByText("Só para copas.")).toBeTruthy();
  });

  it("expõe role='status' para leitores de tela", () => {
    render(<CupOnlyNotice message="x" />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("marca o ícone como aria-hidden (decorativo)", () => {
    const { container } = render(<CupOnlyNotice message="x" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("usa Trophy como ícone default", () => {
    const { container } = render(<CupOnlyNotice message="x" />);
    // lucide anexa a classe lucide-trophy no <svg> do ícone default
    expect(container.querySelector("svg.lucide-trophy")).toBeTruthy();
  });

  it("aceita ícone customizado", () => {
    const { container } = render(<CupOnlyNotice message="x" icon={Swords} />);
    expect(container.querySelector("svg.lucide-swords")).toBeTruthy();
    expect(container.querySelector("svg.lucide-trophy")).toBeNull();
  });

  it("faz merge do className extra sobre as classes base", () => {
    render(<CupOnlyNotice message="x" className="my-custom-class" />);
    const root = screen.getByRole("status");
    expect(root.className).toContain("my-custom-class");
    // classe base preservada
    expect(root.className).toContain("items-center");
  });
});
