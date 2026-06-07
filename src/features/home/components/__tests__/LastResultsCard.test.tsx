// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  LastResultsCard,
  LastResultsCardSkeleton,
} from "@/features/home/components/LastResultsCard";
import type { RecentResult } from "@/features/home/lib/homeDashboardHelpers";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const resultAcertou: RecentResult = {
  matchId: "match-001",
  kickoffAt: "2026-06-10T15:00:00Z",
  homeTeam: { name: "Brasil", flagUrl: undefined },
  awayTeam: { name: "França", flagUrl: undefined },
  matchHomeScore: 2,
  matchAwayScore: 1,
  userPrediction: { homeScore: 2, awayScore: 1 }, // placar exato → acertou
  isCorrect: true,
};

const resultErrou: RecentResult = {
  matchId: "match-002",
  kickoffAt: "2026-06-11T15:00:00Z",
  homeTeam: { name: "Alemanha", flagUrl: undefined },
  awayTeam: { name: "Japão", flagUrl: undefined },
  matchHomeScore: 0,
  matchAwayScore: 0,
  userPrediction: { homeScore: 1, awayScore: 0 }, // errou
  isCorrect: false,
};

const resultSemPalpite: RecentResult = {
  matchId: "match-003",
  kickoffAt: "2026-06-12T15:00:00Z",
  homeTeam: { name: "Argentina", flagUrl: undefined },
  awayTeam: { name: "Espanha", flagUrl: undefined },
  matchHomeScore: 1,
  matchAwayScore: 1,
  userPrediction: null, // sem palpite
  isCorrect: false,
};

// ---------------------------------------------------------------------------
// Testes: com dados
// ---------------------------------------------------------------------------

describe("LastResultsCard", () => {
  describe("com dados", () => {
    it("T1: renderiza article com aria-label 'Últimos Resultados'", () => {
      render(<LastResultsCard results={[resultAcertou]} />);
      expect(screen.getByRole("article", { name: "Últimos Resultados" })).toBeTruthy();
    });

    it("T2: exibe título 'Últimos Resultados'", () => {
      render(<LastResultsCard results={[resultAcertou]} />);
      expect(screen.getByText("Últimos Resultados")).toBeTruthy();
    });

    it("T3: exibe lista com aria-label", () => {
      render(<LastResultsCard results={[resultAcertou]} />);
      expect(
        screen.getByRole("list", { name: "Lista de resultados recentes" }),
      ).toBeTruthy();
    });

    it("T4: exibe nome de ambas as seleções no resultado", () => {
      render(<LastResultsCard results={[resultAcertou]} />);
      expect(screen.getByText("Brasil")).toBeTruthy();
      expect(screen.getByText("França")).toBeTruthy();
    });

    it("T5: exibe placar com separador ' – '", () => {
      render(<LastResultsCard results={[resultAcertou]} />);
      expect(screen.getByText("2 – 1")).toBeTruthy();
    });

    it("T6: exibe múltiplos resultados", () => {
      render(<LastResultsCard results={[resultAcertou, resultErrou, resultSemPalpite]} />);
      expect(screen.getByText("Brasil")).toBeTruthy();
      expect(screen.getByText("Alemanha")).toBeTruthy();
      expect(screen.getByText("Argentina")).toBeTruthy();
    });

    it("T7: limita a 5 resultados mesmo que receba mais de 5", () => {
      const manyResults: RecentResult[] = Array.from({ length: 7 }, (_, i) => ({
        ...resultAcertou,
        matchId: `match-${i}`,
        homeTeam: { name: `Time ${i}`, flagUrl: undefined },
      }));
      render(<LastResultsCard results={manyResults} />);
      const items = screen.getAllByRole("listitem");
      expect(items.length).toBe(5);
    });
  });

  describe("badge ResultBadge — acertou", () => {
    it("T8: exibe badge 'Acertou' quando isCorrect é true", () => {
      render(<LastResultsCard results={[resultAcertou]} />);
      expect(screen.getByText("Acertou")).toBeTruthy();
    });

    it("T9: badge 'Acertou' tem classes de win (bg-win-bg text-win)", () => {
      render(<LastResultsCard results={[resultAcertou]} />);
      const badge = screen.getByText("Acertou");
      expect(badge.className).toContain("bg-win-bg");
      expect(badge.className).toContain("text-win");
    });
  });

  describe("badge ResultBadge — errou", () => {
    it("T10: exibe badge 'Errou' quando isCorrect é false e há palpite", () => {
      render(<LastResultsCard results={[resultErrou]} />);
      expect(screen.getByText("Errou")).toBeTruthy();
    });

    it("T11: badge 'Errou' tem classes de loss (bg-loss-bg text-loss)", () => {
      render(<LastResultsCard results={[resultErrou]} />);
      const badge = screen.getByText("Errou");
      expect(badge.className).toContain("bg-loss-bg");
      expect(badge.className).toContain("text-loss");
    });
  });

  describe("badge ResultBadge — sem palpite", () => {
    it("T12: exibe badge 'Sem palpite' quando userPrediction é null", () => {
      render(<LastResultsCard results={[resultSemPalpite]} />);
      expect(screen.getByText("Sem palpite")).toBeTruthy();
    });

    it("T13: badge 'Sem palpite' tem classes neutras (bg-muted text-muted-foreground)", () => {
      render(<LastResultsCard results={[resultSemPalpite]} />);
      const badge = screen.getByText("Sem palpite");
      expect(badge.className).toContain("bg-muted");
      expect(badge.className).toContain("text-muted-foreground");
    });
  });

  describe("mistura de badges no mesmo card", () => {
    it("T14: exibe Acertou, Errou e Sem palpite na mesma lista", () => {
      render(
        <LastResultsCard
          results={[resultAcertou, resultErrou, resultSemPalpite]}
        />,
      );
      expect(screen.getByText("Acertou")).toBeTruthy();
      expect(screen.getByText("Errou")).toBeTruthy();
      expect(screen.getByText("Sem palpite")).toBeTruthy();
    });
  });

  describe("estado empty", () => {
    it("T15: renderiza article com aria-label quando results é []", () => {
      render(<LastResultsCard results={[]} />);
      expect(screen.getByRole("article", { name: "Últimos Resultados" })).toBeTruthy();
    });

    it("T16: exibe mensagem 'Nenhum resultado disponível'", () => {
      render(<LastResultsCard results={[]} />);
      expect(screen.getByText("Nenhum resultado disponível")).toBeTruthy();
    });

    it("T17: não exibe lista no estado empty", () => {
      render(<LastResultsCard results={[]} />);
      expect(screen.queryByRole("list")).toBeNull();
    });
  });

  describe("estado loading", () => {
    it("T18: renderiza skeleton quando isLoading é true", () => {
      render(<LastResultsCard results={[]} isLoading />);
      expect(
        screen.getByRole("status", { name: "Carregando Últimos Resultados" }),
      ).toBeTruthy();
    });

    it("T19: skeleton tem aria-busy='true'", () => {
      render(<LastResultsCard results={[]} isLoading />);
      const skeleton = screen.getByRole("status");
      expect(skeleton.getAttribute("aria-busy")).toBe("true");
    });

    it("T20: não exibe conteúdo real enquanto isLoading é true", () => {
      render(<LastResultsCard results={[resultAcertou]} isLoading />);
      expect(screen.queryByText("Últimos Resultados")).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Testes: LastResultsCardSkeleton standalone
// ---------------------------------------------------------------------------

describe("LastResultsCardSkeleton", () => {
  it("T21: tem role='status' e aria-busy='true'", () => {
    render(<LastResultsCardSkeleton />);
    const el = screen.getByRole("status");
    expect(el).toBeTruthy();
    expect(el.getAttribute("aria-busy")).toBe("true");
  });

  it("T22: tem aria-label 'Carregando Últimos Resultados'", () => {
    render(<LastResultsCardSkeleton />);
    expect(
      screen.getByRole("status", { name: "Carregando Últimos Resultados" }),
    ).toBeTruthy();
  });
});
