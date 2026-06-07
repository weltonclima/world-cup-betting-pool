// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MatchesErrorState } from "@/features/matches/components/MatchesErrorState";

describe("MatchesErrorState", () => {
  it("T1: exibe mensagem default 'Erro ao carregar jogos'", () => {
    render(<MatchesErrorState onRetry={vi.fn()} />);
    expect(screen.getByText("Erro ao carregar jogos")).toBeTruthy();
  });

  it("T2: aceita message customizada", () => {
    render(<MatchesErrorState onRetry={vi.fn()} message="Falha na conexão" />);
    expect(screen.getByText("Falha na conexão")).toBeTruthy();
  });

  it("T3: exibe botão 'Tentar novamente'", () => {
    render(<MatchesErrorState onRetry={vi.fn()} />);
    expect(screen.getByText("Tentar novamente")).toBeTruthy();
  });

  it("T4: chama onRetry ao clicar no botão", () => {
    const handler = vi.fn();
    render(<MatchesErrorState onRetry={handler} />);
    const button = screen.getByText("Tentar novamente");
    button.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("T5: botão tem min-h-[44px] (área de toque mínima)", () => {
    render(<MatchesErrorState onRetry={vi.fn()} />);
    const button = screen.getByText("Tentar novamente");
    // Verifica via className (Base UI Button propaga via ButtonPrimitive)
    expect(button.className).toMatch(/min-h-\[44px\]/);
  });
});
