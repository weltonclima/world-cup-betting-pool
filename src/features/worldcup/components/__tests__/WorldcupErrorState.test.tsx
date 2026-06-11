// @vitest-environment jsdom
/**
 * Testes do WorldcupErrorState (TASK-07).
 *
 * Verifica: mensagem default exata, botão "Tentar novamente", callback onRetry,
 * min-h-[44px] no botão.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorldcupErrorState } from "@/features/worldcup/components/WorldcupErrorState";

describe("WorldcupErrorState", () => {
  it("T1: exibe mensagem default exata 'Erro ao carregar informações.'", () => {
    render(<WorldcupErrorState onRetry={vi.fn()} />);
    expect(screen.getByText("Erro ao carregar informações.")).toBeTruthy();
  });

  it("T2: aceita message customizada", () => {
    render(<WorldcupErrorState onRetry={vi.fn()} message="Falha na rede." />);
    expect(screen.getByText("Falha na rede.")).toBeTruthy();
  });

  it("T3: exibe botão 'Tentar novamente'", () => {
    render(<WorldcupErrorState onRetry={vi.fn()} />);
    expect(screen.getByText("Tentar novamente")).toBeTruthy();
  });

  it("T4: chama onRetry ao clicar no botão", () => {
    const handler = vi.fn();
    render(<WorldcupErrorState onRetry={handler} />);
    screen.getByText("Tentar novamente").click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("T5: botão tem min-h-[44px] (área de toque mínima)", () => {
    render(<WorldcupErrorState onRetry={vi.fn()} />);
    const button = screen.getByText("Tentar novamente");
    expect(button.className).toMatch(/min-h-\[44px\]/);
  });

  it("T6: não exibe a mensagem default quando message customizada fornecida", () => {
    render(<WorldcupErrorState onRetry={vi.fn()} message="Falha na rede." />);
    expect(screen.queryByText("Erro ao carregar informações.")).toBeNull();
  });
});
