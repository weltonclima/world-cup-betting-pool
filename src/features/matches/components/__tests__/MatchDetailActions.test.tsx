// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MatchDetailActions } from "@/features/matches/components/MatchDetailActions";

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("MatchDetailActions — pendente + scheduled", () => {
  it("T1: exibe 'Enviar Palpite' (disabled)", () => {
    render(<MatchDetailActions predictionStatus="pendente" matchStatus="scheduled" />);
    const btn = screen.getByText("Enviar Palpite");
    expect(btn).toBeTruthy();
  });

  it("T2: exibe 'Ver Informações da Partida' (disabled)", () => {
    render(<MatchDetailActions predictionStatus="pendente" matchStatus="scheduled" />);
    expect(screen.getByText("Ver Informações da Partida")).toBeTruthy();
  });

  it("T3: botões têm aria-disabled=true", () => {
    render(<MatchDetailActions predictionStatus="pendente" matchStatus="scheduled" />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    buttons.forEach((btn) => {
      expect(btn.getAttribute("aria-disabled")).toBe("true");
    });
  });

  it("T4: botões estão desabilitados (disabled prop)", () => {
    render(<MatchDetailActions predictionStatus="pendente" matchStatus="scheduled" />);
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn).toHaveProperty("disabled", true);
    });
  });
});

describe("MatchDetailActions — enviado + scheduled", () => {
  it("T5: exibe 'Editar Palpite'", () => {
    render(<MatchDetailActions predictionStatus="enviado" matchStatus="scheduled" />);
    expect(screen.getByText("Editar Palpite")).toBeTruthy();
  });

  it("T6: exibe 'Visualizar Palpite'", () => {
    render(<MatchDetailActions predictionStatus="enviado" matchStatus="scheduled" />);
    expect(screen.getByText("Visualizar Palpite")).toBeTruthy();
  });

  it("T7: exibe 'Ver Informações da Partida'", () => {
    render(<MatchDetailActions predictionStatus="enviado" matchStatus="scheduled" />);
    expect(screen.getByText("Ver Informações da Partida")).toBeTruthy();
  });

  it("T8: todos os botões têm aria-disabled=true", () => {
    render(<MatchDetailActions predictionStatus="enviado" matchStatus="scheduled" />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(3);
    buttons.forEach((btn) => {
      expect(btn.getAttribute("aria-disabled")).toBe("true");
    });
  });
});

describe("MatchDetailActions — bloqueado + finished", () => {
  it("T9: exibe 'Visualizar Palpite'", () => {
    render(<MatchDetailActions predictionStatus="bloqueado" matchStatus="finished" />);
    expect(screen.getByText("Visualizar Palpite")).toBeTruthy();
  });

  it("T10: exibe 'Ver Informações da Partida'", () => {
    render(<MatchDetailActions predictionStatus="bloqueado" matchStatus="finished" />);
    expect(screen.getByText("Ver Informações da Partida")).toBeTruthy();
  });

  it("T11: exibe 'Visualizar Resultado & Estatísticas' apenas para finished", () => {
    render(<MatchDetailActions predictionStatus="bloqueado" matchStatus="finished" />);
    expect(screen.getByText("Visualizar Resultado & Estatísticas")).toBeTruthy();
  });

  it("T12: todos os botões têm aria-disabled=true", () => {
    render(<MatchDetailActions predictionStatus="bloqueado" matchStatus="finished" />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(3);
    buttons.forEach((btn) => {
      expect(btn.getAttribute("aria-disabled")).toBe("true");
    });
  });
});

describe("MatchDetailActions — bloqueado + live", () => {
  it("T13: exibe 'Visualizar Palpite' mas NÃO exibe 'Visualizar Resultado & Estatísticas'", () => {
    render(<MatchDetailActions predictionStatus="bloqueado" matchStatus="live" />);
    expect(screen.getByText("Visualizar Palpite")).toBeTruthy();
    expect(screen.queryByText("Visualizar Resultado & Estatísticas")).toBeNull();
  });

  it("T14: exibe 'Ver Informações da Partida'", () => {
    render(<MatchDetailActions predictionStatus="bloqueado" matchStatus="live" />);
    expect(screen.getByText("Ver Informações da Partida")).toBeTruthy();
  });
});
