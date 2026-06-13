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

const resultExato: RecentResult = {
  matchId: "match-001",
  kickoffAt: "2026-06-10T15:00:00Z",
  homeTeam: { name: "Brasil", flagUrl: undefined },
  awayTeam: { name: "França", flagUrl: undefined },
  matchHomeScore: 2,
  matchAwayScore: 1,
  userPrediction: { homeScore: 2, awayScore: 1 }, // placar exato → 10 pts
  points: 10,
};

// Regressão do bug: acertou o vencedor (placar errado) vale 5 pts — antes
// caía em "Errou".
const resultVencedor: RecentResult = {
  matchId: "match-002",
  kickoffAt: "2026-06-11T15:00:00Z",
  homeTeam: { name: "Portugal", flagUrl: undefined },
  awayTeam: { name: "Gana", flagUrl: undefined },
  matchHomeScore: 3,
  matchAwayScore: 1,
  userPrediction: { homeScore: 2, awayScore: 0 }, // vencedor certo, placar errado → 5 pts
  points: 5,
};

const resultErrou: RecentResult = {
  matchId: "match-003",
  kickoffAt: "2026-06-11T18:00:00Z",
  homeTeam: { name: "Alemanha", flagUrl: undefined },
  awayTeam: { name: "Japão", flagUrl: undefined },
  matchHomeScore: 0,
  matchAwayScore: 0,
  userPrediction: { homeScore: 1, awayScore: 0 }, // errou → 0 pts
  points: 0,
};

const resultSemPalpite: RecentResult = {
  matchId: "match-004",
  kickoffAt: "2026-06-12T15:00:00Z",
  homeTeam: { name: "Argentina", flagUrl: undefined },
  awayTeam: { name: "Espanha", flagUrl: undefined },
  matchHomeScore: 1,
  matchAwayScore: 1,
  userPrediction: null, // sem palpite
  points: 0,
};

// ---------------------------------------------------------------------------
// Testes: com dados
// ---------------------------------------------------------------------------

describe("LastResultsCard", () => {
  describe("com dados", () => {
    it("T1: renderiza article com aria-label 'Últimos Resultados'", () => {
      render(<LastResultsCard results={[resultExato]} />);
      expect(screen.getByRole("article", { name: "Últimos Resultados" })).toBeTruthy();
    });

    it("T2: exibe título 'Últimos Resultados'", () => {
      render(<LastResultsCard results={[resultExato]} />);
      expect(screen.getByText("Últimos Resultados")).toBeTruthy();
    });

    it("T3: exibe lista com aria-label", () => {
      render(<LastResultsCard results={[resultExato]} />);
      expect(
        screen.getByRole("list", { name: "Lista de resultados recentes" }),
      ).toBeTruthy();
    });

    it("T4: exibe nome de ambas as seleções no resultado", () => {
      render(<LastResultsCard results={[resultExato]} />);
      expect(screen.getByText("Brasil")).toBeTruthy();
      expect(screen.getByText("França")).toBeTruthy();
    });

    it("T5: exibe placar com separador ' – '", () => {
      render(<LastResultsCard results={[resultExato]} />);
      expect(screen.getByText("2 – 1")).toBeTruthy();
    });

    it("T6: exibe múltiplos resultados", () => {
      render(<LastResultsCard results={[resultExato, resultErrou, resultSemPalpite]} />);
      expect(screen.getByText("Brasil")).toBeTruthy();
      expect(screen.getByText("Alemanha")).toBeTruthy();
      expect(screen.getByText("Argentina")).toBeTruthy();
    });

    it("T7: limita a 5 resultados mesmo que receba mais de 5", () => {
      const manyResults: RecentResult[] = Array.from({ length: 7 }, (_, i) => ({
        ...resultExato,
        matchId: `match-${i}`,
        homeTeam: { name: `Time ${i}`, flagUrl: undefined },
      }));
      render(<LastResultsCard results={manyResults} />);
      const items = screen.getAllByRole("listitem");
      expect(items.length).toBe(5);
    });
  });

  describe("badge ResultBadge — placar exato (10 pts)", () => {
    it("T8: exibe badge '+10 pts' quando points é 10", () => {
      render(<LastResultsCard results={[resultExato]} />);
      expect(screen.getByText("+10 pts")).toBeTruthy();
    });

    it("T9: badge de 10 pts tem classes de win (bg-win-bg text-win)", () => {
      render(<LastResultsCard results={[resultExato]} />);
      const badge = screen.getByText("+10 pts");
      expect(badge.className).toContain("bg-win-bg");
      expect(badge.className).toContain("text-win");
    });
  });

  describe("badge ResultBadge — acertou o vencedor (5 pts)", () => {
    it("T8b: exibe badge '+5 pts' quando points é 5 (regressão do bug)", () => {
      render(<LastResultsCard results={[resultVencedor]} />);
      expect(screen.getByText("+5 pts")).toBeTruthy();
      // Não deve mais exibir o antigo "Errou" para palpite de vencedor.
      expect(screen.queryByText("Errou")).toBeNull();
    });

    it("T9b: badge de 5 pts tem classe lime distinta de win/loss", () => {
      render(<LastResultsCard results={[resultVencedor]} />);
      const badge = screen.getByText("+5 pts");
      expect(badge.className).toContain("text-lime-700");
      expect(badge.className).not.toContain("bg-win-bg");
      expect(badge.className).not.toContain("bg-loss-bg");
    });
  });

  describe("badge ResultBadge — errou (0 pts)", () => {
    it("T10: exibe badge '0 pts' quando points é 0 e há palpite", () => {
      render(<LastResultsCard results={[resultErrou]} />);
      expect(screen.getByText("0 pts")).toBeTruthy();
    });

    it("T11: badge de 0 pts tem classes de loss (bg-loss-bg text-loss)", () => {
      render(<LastResultsCard results={[resultErrou]} />);
      const badge = screen.getByText("0 pts");
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

    it("T13b: '0 pts' (errou) é distinto de 'Sem palpite'", () => {
      render(<LastResultsCard results={[resultSemPalpite]} />);
      // Sem palpite NÃO deve renderizar badge de pontos.
      expect(screen.queryByText("0 pts")).toBeNull();
    });
  });

  describe("mistura de badges no mesmo card", () => {
    it("T14: exibe +10, +5, 0 pts e Sem palpite na mesma lista", () => {
      render(
        <LastResultsCard
          results={[resultExato, resultVencedor, resultErrou, resultSemPalpite]}
        />,
      );
      expect(screen.getByText("+10 pts")).toBeTruthy();
      expect(screen.getByText("+5 pts")).toBeTruthy();
      expect(screen.getByText("0 pts")).toBeTruthy();
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
      render(<LastResultsCard results={[resultExato]} isLoading />);
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
