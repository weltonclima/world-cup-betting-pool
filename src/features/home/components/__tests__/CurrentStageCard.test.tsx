// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  CurrentStageCard,
  CurrentStageCardSkeleton,
} from "@/features/home/components/CurrentStageCard";
import type { CurrentStageSummary } from "@/features/home/lib/homeDashboardHelpers";

// ---------------------------------------------------------------------------
// Fixtures de stage
// ---------------------------------------------------------------------------

/** Mapa de stage → label pt-BR esperado (espelho do STAGE_LABEL no componente). */
const EXPECTED_LABELS: Record<string, string> = {
  grupos: "Fase de Grupos",
  "dezesseis-avos": "Dezesseis Avos de Final",
  oitavas: "Oitavas de Final",
  quartas: "Quartas de Final",
  semifinal: "Semifinal",
  terceiro: "Disputa do 3º Lugar",
  final: "Final",
};

// ---------------------------------------------------------------------------
// Testes: com dados
// ---------------------------------------------------------------------------

describe("CurrentStageCard", () => {
  describe("com dados — fase grupos", () => {
    const gruposStage: CurrentStageSummary = {
      stage: "grupos",
      roundLabel: "Rodada 2 de 3",
    };

    it("T1: renderiza article com aria-label 'Fase Atual'", () => {
      render(<CurrentStageCard currentStage={gruposStage} />);
      expect(screen.getByRole("article", { name: "Fase Atual" })).toBeTruthy();
    });

    it("T2: exibe título 'Fase Atual' no cabeçalho", () => {
      render(<CurrentStageCard currentStage={gruposStage} />);
      expect(screen.getByText("Fase Atual")).toBeTruthy();
    });

    it("T3: exibe nome da fase em pt-BR 'Fase de Grupos'", () => {
      render(<CurrentStageCard currentStage={gruposStage} />);
      expect(screen.getByText("Fase de Grupos")).toBeTruthy();
    });

    it("T4: exibe 'Rodada 2 de 3' quando roundLabel está disponível", () => {
      render(<CurrentStageCard currentStage={gruposStage} />);
      expect(screen.getByText("Rodada 2 de 3")).toBeTruthy();
    });
  });

  describe("mapeamento de stages para pt-BR", () => {
    // Testa cada stage individualmente
    it.each(Object.entries(EXPECTED_LABELS))(
      "T5-%s: exibe '%s' como '%s'",
      (stage, expectedLabel) => {
        const summary: CurrentStageSummary = {
          stage: stage as CurrentStageSummary["stage"],
          roundLabel: null,
        };
        render(<CurrentStageCard currentStage={summary} />);
        expect(screen.getByText(expectedLabel)).toBeTruthy();
      },
    );
  });

  describe("roundLabel ausente", () => {
    const semifinalStage: CurrentStageSummary = {
      stage: "semifinal",
      roundLabel: null,
    };

    it("T6: exibe fase sem roundLabel quando roundLabel é null", () => {
      render(<CurrentStageCard currentStage={semifinalStage} />);
      expect(screen.getByText("Semifinal")).toBeTruthy();
    });

    it("T7: não exibe texto 'Rodada' quando roundLabel é null", () => {
      render(<CurrentStageCard currentStage={semifinalStage} />);
      expect(screen.queryByText(/Rodada/)).toBeNull();
    });
  });

  describe("estado empty (stage null)", () => {
    const emptyStage: CurrentStageSummary = {
      stage: null,
      roundLabel: null,
    };

    it("T8: renderiza article com aria-label quando stage é null", () => {
      render(<CurrentStageCard currentStage={emptyStage} />);
      expect(screen.getByRole("article", { name: "Fase Atual" })).toBeTruthy();
    });

    it("T9: exibe mensagem 'Fase não definida'", () => {
      render(<CurrentStageCard currentStage={emptyStage} />);
      expect(screen.getByText("Fase não definida")).toBeTruthy();
    });

    it("T10: não exibe 'Rodada' no estado empty", () => {
      render(<CurrentStageCard currentStage={emptyStage} />);
      expect(screen.queryByText(/Rodada/)).toBeNull();
    });
  });

  describe("estado loading", () => {
    const anyStage: CurrentStageSummary = { stage: "final", roundLabel: null };

    it("T11: renderiza skeleton quando isLoading é true", () => {
      render(<CurrentStageCard currentStage={anyStage} isLoading />);
      expect(
        screen.getByRole("status", { name: "Carregando Fase Atual" }),
      ).toBeTruthy();
    });

    it("T12: skeleton tem aria-busy='true'", () => {
      render(<CurrentStageCard currentStage={anyStage} isLoading />);
      const skeleton = screen.getByRole("status");
      expect(skeleton.getAttribute("aria-busy")).toBe("true");
    });

    it("T13: não exibe conteúdo real enquanto isLoading é true", () => {
      render(<CurrentStageCard currentStage={anyStage} isLoading />);
      expect(screen.queryByText("Final")).toBeNull();
    });
  });

  describe("roundLabel com valor completo", () => {
    it("T14: exibe 'Rodada 1 de 1' para fase final", () => {
      const finalStage: CurrentStageSummary = {
        stage: "final",
        roundLabel: "Rodada 1 de 1",
      };
      render(<CurrentStageCard currentStage={finalStage} />);
      expect(screen.getByText("Final")).toBeTruthy();
      expect(screen.getByText("Rodada 1 de 1")).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// Testes: CurrentStageCardSkeleton standalone
// ---------------------------------------------------------------------------

describe("CurrentStageCardSkeleton", () => {
  it("T15: tem role='status' e aria-busy='true'", () => {
    render(<CurrentStageCardSkeleton />);
    const el = screen.getByRole("status");
    expect(el).toBeTruthy();
    expect(el.getAttribute("aria-busy")).toBe("true");
  });

  it("T16: tem aria-label 'Carregando Fase Atual'", () => {
    render(<CurrentStageCardSkeleton />);
    expect(
      screen.getByRole("status", { name: "Carregando Fase Atual" }),
    ).toBeTruthy();
  });
});
