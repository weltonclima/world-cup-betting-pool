// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MatchPredictionStatus } from "@/features/matches/lib/matchesHelpers";
import type { MatchStatus, Prediction } from "@/types";

import { MatchDetailActions } from "@/features/matches/components/MatchDetailActions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const renderActions = (
  predictionStatus: MatchPredictionStatus,
  matchStatus: MatchStatus,
  matchId = "match-001",
  prediction?: Prediction,
) =>
  render(
    <MatchDetailActions
      predictionStatus={predictionStatus}
      matchStatus={matchStatus}
      matchId={matchId}
      prediction={prediction}
    />,
  );

// ---------------------------------------------------------------------------
// pendente + scheduled → CTA "Enviar Palpite" habilitado como link
// ---------------------------------------------------------------------------

describe("MatchDetailActions — pendente + scheduled", () => {
  it("T1: exibe texto 'Enviar Palpite'", () => {
    renderActions("pendente", "scheduled");
    expect(screen.getByText("Enviar Palpite")).toBeTruthy();
  });

  it("T3: CTA 'Enviar Palpite' é um link habilitado (sem aria-disabled)", () => {
    renderActions("pendente", "scheduled");
    // Button asChild com Link renderiza como <a>
    const link = screen.getByRole("link", { name: /enviar palpite/i });
    expect(link).toBeTruthy();
    // Link habilitado NÃO tem aria-disabled
    expect(link.getAttribute("aria-disabled")).toBeNull();
  });

  it("T4: link aponta para /matches/match-001/predict", () => {
    renderActions("pendente", "scheduled");
    const link = screen.getByRole("link", { name: /enviar palpite/i });
    expect(link.getAttribute("href")).toBe("/matches/match-001/predict");
  });

  it("T-NOVO-1: href usa matchId personalizado", () => {
    renderActions("pendente", "scheduled", "jogo-xyz");
    const link = screen.getByRole("link", { name: /enviar palpite/i });
    expect(link.getAttribute("href")).toBe("/matches/jogo-xyz/predict");
  });
});

// ---------------------------------------------------------------------------
// enviado + scheduled → CTA "Editar Palpite" habilitado como link
// ---------------------------------------------------------------------------

describe("MatchDetailActions — enviado + scheduled", () => {
  it("T5: exibe texto 'Editar Palpite'", () => {
    renderActions("enviado", "scheduled");
    expect(screen.getByText("Editar Palpite")).toBeTruthy();
  });

  it("T8: CTA 'Editar Palpite' é um link habilitado (sem aria-disabled)", () => {
    renderActions("enviado", "scheduled");
    const link = screen.getByRole("link", { name: /editar palpite/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute("aria-disabled")).toBeNull();
  });

  it("T-NOVO-2: link aponta para /matches/match-001/predict", () => {
    renderActions("enviado", "scheduled");
    const link = screen.getByRole("link", { name: /editar palpite/i });
    expect(link.getAttribute("href")).toBe("/matches/match-001/predict");
  });
});

// ---------------------------------------------------------------------------
// bloqueado + finished → botão disabled com Lock
// ---------------------------------------------------------------------------

describe("MatchDetailActions — bloqueado + finished", () => {
  it("T12: exibe 'Palpite bloqueado' como botão disabled", () => {
    renderActions("bloqueado", "finished");
    const btn = screen.getByRole("button", { name: /palpite bloqueado/i });
    expect(btn).toBeTruthy();
    expect(btn).toHaveProperty("disabled", true);
  });

  it("T-NOVO-3: botão de lock tem aria-disabled=true", () => {
    renderActions("bloqueado", "finished");
    const btn = screen.getByRole("button", { name: /palpite bloqueado/i });
    expect(btn.getAttribute("aria-disabled")).toBe("true");
  });

  it("T-NOVO-5: finished + enviado → botão 'Palpite bloqueado' disabled", () => {
    renderActions("enviado", "finished");
    const btn = screen.getByRole("button", { name: /palpite bloqueado/i });
    expect(btn).toBeTruthy();
    expect(btn).toHaveProperty("disabled", true);
  });
});

// ---------------------------------------------------------------------------
// bloqueado + live → botão disabled com Lock
// ---------------------------------------------------------------------------

describe("MatchDetailActions — bloqueado + live", () => {
  it("T-NOVO-4: live → botão 'Palpite bloqueado' disabled", () => {
    renderActions("bloqueado", "live");
    const btn = screen.getByRole("button", { name: /palpite bloqueado/i });
    expect(btn).toBeTruthy();
    expect(btn).toHaveProperty("disabled", true);
  });

  it("T13: NÃO exibe 'Visualizar Resultado' nem 'Visualizar Palpite' (removidos)", () => {
    renderActions("bloqueado", "live");
    expect(screen.queryByText("Visualizar Resultado & Estatísticas")).toBeNull();
    expect(screen.queryByText("Visualizar Palpite")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// predictionStatus "pendente" + live → bloqueado (match não-scheduled)
// ---------------------------------------------------------------------------

describe("MatchDetailActions — pendente + live", () => {
  it("exibe 'Palpite bloqueado' quando match está live mesmo com predictionStatus=pendente", () => {
    renderActions("pendente", "live");
    expect(screen.getByText("Palpite bloqueado")).toBeTruthy();
  });
});
