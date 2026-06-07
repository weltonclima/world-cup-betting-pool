// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  NextMatchCard,
  NextMatchCardSkeleton,
} from "@/features/home/components/NextMatchCard";
import type {
  NextMatchSummary,
  ResolvedTeam,
} from "@/features/home/lib/homeDashboardHelpers";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const homeTeam: ResolvedTeam = {
  name: "Brasil",
  flagUrl: "https://example.com/br.png",
};

const awayTeam: ResolvedTeam = {
  name: "França",
  flagUrl: "https://example.com/fr.png",
};

const baseMatch: NextMatchSummary = {
  matchId: "match-001",
  kickoffAt: "2026-06-14T18:00:00Z",
  homeTeam,
  awayTeam,
  predictionStatus: "pendente",
  userPrediction: null,
};

// ---------------------------------------------------------------------------
// Testes: com dados
// ---------------------------------------------------------------------------

describe("NextMatchCard", () => {
  describe("com dados — status pendente", () => {
    it("T1: renderiza article com aria-label 'Próximo Jogo'", () => {
      render(<NextMatchCard nextMatch={baseMatch} />);
      expect(screen.getByRole("article", { name: "Próximo Jogo" })).toBeTruthy();
    });

    it("T2: exibe título 'Próximo Jogo'", () => {
      render(<NextMatchCard nextMatch={baseMatch} />);
      expect(screen.getByText("Próximo Jogo")).toBeTruthy();
    });

    it("T3: exibe nome das duas seleções", () => {
      render(<NextMatchCard nextMatch={baseMatch} />);
      expect(screen.getByText("Brasil")).toBeTruthy();
      expect(screen.getByText("França")).toBeTruthy();
    });

    it("T4: exibe separador 'VS'", () => {
      render(<NextMatchCard nextMatch={baseMatch} />);
      expect(screen.getByText("VS")).toBeTruthy();
    });

    it("T5: exibe badge 'Sem palpite' para status pendente", () => {
      render(<NextMatchCard nextMatch={baseMatch} />);
      expect(screen.getByText("Sem palpite")).toBeTruthy();
    });

    it("T6: exibe CTA 'Enviar Palpite' para status pendente", () => {
      render(<NextMatchCard nextMatch={baseMatch} />);
      expect(screen.getByText("Enviar Palpite")).toBeTruthy();
    });

    it("T7: exibe data formatada em pt-BR com mês e horário", () => {
      render(<NextMatchCard nextMatch={baseMatch} />);
      // Data: "2026-06-14T18:00:00Z" → deve conter "jun" e separador "·"
      // Hora varia por timezone do ambiente (UTC±); verificamos apenas o formato.
      const dateEl = screen.getByText(/jun/i);
      expect(dateEl).toBeTruthy();
      // Verifica o separador canônico do formato "EEE, d MMM · HH:mm"
      expect(dateEl.textContent).toMatch(/·/);
    });

    it("T8: bandeiras são renderizadas como <img> quando flagUrl está disponível", () => {
      render(<NextMatchCard nextMatch={baseMatch} />);
      const imgs = screen.getAllByRole("img");
      // Ao menos 2 imgs (uma por seleção)
      expect(imgs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("status enviado", () => {
    const matchEnviado: NextMatchSummary = {
      ...baseMatch,
      predictionStatus: "enviado",
      userPrediction: { homeScore: 2, awayScore: 1 },
    };

    it("T9: exibe badge 'Palpite enviado'", () => {
      render(<NextMatchCard nextMatch={matchEnviado} />);
      expect(screen.getByText("Palpite enviado")).toBeTruthy();
    });

    it("T10: exibe CTA 'Editar Palpite'", () => {
      render(<NextMatchCard nextMatch={matchEnviado} />);
      expect(screen.getByText("Editar Palpite")).toBeTruthy();
    });
  });

  describe("status bloqueado", () => {
    const matchBloqueado: NextMatchSummary = {
      ...baseMatch,
      predictionStatus: "bloqueado",
    };

    it("T11: exibe badge 'Encerrado' para status bloqueado", () => {
      render(<NextMatchCard nextMatch={matchBloqueado} />);
      expect(screen.getByText("Encerrado")).toBeTruthy();
    });

    it("T12: exibe CTA 'Ver Jogo' para status bloqueado", () => {
      render(<NextMatchCard nextMatch={matchBloqueado} />);
      expect(screen.getByText("Ver Jogo")).toBeTruthy();
    });
  });

  describe("fallback de bandeira sem flagUrl", () => {
    it("T13: exibe iniciais quando flagUrl é undefined", () => {
      const matchSemBandeira: NextMatchSummary = {
        ...baseMatch,
        homeTeam: { name: "Brasil", flagUrl: undefined },
        awayTeam: { name: "França", flagUrl: undefined },
      };
      render(<NextMatchCard nextMatch={matchSemBandeira} />);
      // Iniciais: BRA, FRA — ou primeiras letras de cada palavra
      expect(screen.getByLabelText("Brasil")).toBeTruthy();
      expect(screen.getByLabelText("França")).toBeTruthy();
    });
  });

  describe("estado empty (nextMatch null)", () => {
    it("T14: renderiza article com aria-label quando nextMatch é null", () => {
      render(<NextMatchCard nextMatch={null} />);
      expect(screen.getByRole("article", { name: "Próximo Jogo" })).toBeTruthy();
    });

    it("T15: exibe mensagem 'Nenhum jogo agendado' (contrato §3.4.3)", () => {
      render(<NextMatchCard nextMatch={null} />);
      expect(screen.getByText("Nenhum jogo agendado")).toBeTruthy();
    });

    it("T16: não exibe 'VS' no estado empty", () => {
      render(<NextMatchCard nextMatch={null} />);
      expect(screen.queryByText("VS")).toBeNull();
    });
  });

  describe("estado loading", () => {
    it("T17: renderiza skeleton quando isLoading é true", () => {
      render(<NextMatchCard nextMatch={null} isLoading />);
      expect(screen.getByRole("status", { name: "Carregando Próximo Jogo" })).toBeTruthy();
    });

    it("T18: skeleton tem aria-busy='true'", () => {
      render(<NextMatchCard nextMatch={null} isLoading />);
      const skeleton = screen.getByRole("status");
      expect(skeleton.getAttribute("aria-busy")).toBe("true");
    });

    it("T19: não exibe conteúdo real enquanto isLoading é true", () => {
      render(<NextMatchCard nextMatch={baseMatch} isLoading />);
      expect(screen.queryByText("Próximo Jogo")).toBeNull();
    });
  });

  describe("CTA com handler onClick", () => {
    it("T20: chama onCtaClick ao clicar no botão", async () => {
      const handler = vi.fn();
      render(<NextMatchCard nextMatch={baseMatch} onCtaClick={handler} />);
      const button = screen.getByText("Enviar Palpite");
      button.click();
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("CTA com ctaHref (Link path — WR-02)", () => {
    it("T23: passa ctaHref → renderiza âncora (role link) com href correto", () => {
      render(<NextMatchCard nextMatch={baseMatch} ctaHref="/partidas/match-001" />);
      const link = screen.getByRole("link", { name: "Enviar Palpite" });
      expect(link).toBeTruthy();
      expect(link.getAttribute("href")).toBe("/partidas/match-001");
    });

    it("T24: âncora CTA possui classe min-h-[44px] (área de toque mínima)", () => {
      render(<NextMatchCard nextMatch={baseMatch} ctaHref="/partidas/match-001" />);
      const link = screen.getByRole("link", { name: "Enviar Palpite" });
      expect(link.className).toContain("min-h-[44px]");
    });
  });
});

// ---------------------------------------------------------------------------
// Testes: NextMatchCardSkeleton standalone
// ---------------------------------------------------------------------------

describe("NextMatchCardSkeleton", () => {
  it("T21: tem role='status' e aria-busy='true'", () => {
    render(<NextMatchCardSkeleton />);
    const el = screen.getByRole("status");
    expect(el).toBeTruthy();
    expect(el.getAttribute("aria-busy")).toBe("true");
  });

  it("T22: tem aria-label 'Carregando Próximo Jogo'", () => {
    render(<NextMatchCardSkeleton />);
    expect(
      screen.getByRole("status", { name: "Carregando Próximo Jogo" }),
    ).toBeTruthy();
  });
});
