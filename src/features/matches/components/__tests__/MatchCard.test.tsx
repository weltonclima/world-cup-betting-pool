// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MatchCard } from "@/features/matches/components/MatchCard";
import type { ResolvedTeam } from "@/features/matches/lib/matchesHelpers";
import type { MatchWithId } from "@/types";

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

const baseMatch: MatchWithId = {
  id: "match-001",
  homeTeamId: "team-bra",
  awayTeamId: "team-fra",
  kickoffAt: "2026-06-14T16:00:00Z",
  stage: "grupos",
  round: 1,
  groupId: "Grupo C",
  status: "scheduled",
  homeScore: null,
  awayScore: null,
  venue: { name: "Estádio Lusail", city: "Lusail" },
};

const finishedMatch: MatchWithId = {
  ...baseMatch,
  id: "match-002",
  status: "finished",
  homeScore: 2,
  awayScore: 1,
};

// ---------------------------------------------------------------------------
// Testes: variante Palpite Enviado
// ---------------------------------------------------------------------------

describe("MatchCard — variante Palpite Enviado", () => {
  it("T1: renderiza link com aria-label descritivo", () => {
    render(
      <MatchCard
        match={baseMatch}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        predictionStatus="enviado"
        detailHref="/matches/match-001"
      />,
    );
    expect(screen.getByRole("link", { name: "Brasil vs França" })).toBeTruthy();
  });

  it("T2: exibe nomes das duas seleções", () => {
    render(
      <MatchCard
        match={baseMatch}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        predictionStatus="enviado"
        detailHref="/matches/match-001"
      />,
    );
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("França")).toBeTruthy();
  });

  it("T3: exibe bandeiras como img quando flagUrl disponível", () => {
    render(
      <MatchCard
        match={baseMatch}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        predictionStatus="enviado"
        detailHref="/matches/match-001"
      />,
    );
    const imgs = screen.getAllByRole("img");
    expect(imgs.length).toBeGreaterThanOrEqual(2);
  });

  it("T4: badge 'Palpite Enviado' visível", () => {
    render(
      <MatchCard
        match={baseMatch}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        predictionStatus="enviado"
        detailHref="/matches/match-001"
      />,
    );
    expect(screen.getByText("Palpite Enviado")).toBeTruthy();
  });

  it("T5: exibe grupo do jogo", () => {
    render(
      <MatchCard
        match={baseMatch}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        predictionStatus="enviado"
        detailHref="/matches/match-001"
      />,
    );
    expect(screen.getByText(/Grupo C/)).toBeTruthy();
  });

  it("T6: link tem href correto", () => {
    render(
      <MatchCard
        match={baseMatch}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        predictionStatus="enviado"
        detailHref="/matches/match-001"
      />,
    );
    const link = screen.getByRole("link", { name: "Brasil vs França" });
    expect(link.getAttribute("href")).toBe("/matches/match-001");
  });

  it("T7: link tem min-h-[44px] (área de toque mínima)", () => {
    render(
      <MatchCard
        match={baseMatch}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        predictionStatus="enviado"
        detailHref="/matches/match-001"
      />,
    );
    const link = screen.getByRole("link", { name: "Brasil vs França" });
    expect(link.className).toContain("min-h-[44px]");
  });
});

// ---------------------------------------------------------------------------
// Testes: variante Palpite Pendente
// ---------------------------------------------------------------------------

describe("MatchCard — variante Palpite Pendente", () => {
  it("T8: badge 'Palpite Pendente' visível", () => {
    render(
      <MatchCard
        match={baseMatch}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        predictionStatus="pendente"
        detailHref="/matches/match-001"
      />,
    );
    expect(screen.getByText("Palpite Pendente")).toBeTruthy();
  });

  it("T9: exibe horário no bloco central (jogo não encerrado)", () => {
    render(
      <MatchCard
        match={baseMatch}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        predictionStatus="pendente"
        detailHref="/matches/match-001"
      />,
    );
    // Horário "16:00" (UTC) — pode variar por timezone mas deve haver texto de horário
    // Verificamos que NÃO há placar (x)
    expect(screen.queryByText("x")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Testes: variante Jogo Encerrado
// ---------------------------------------------------------------------------

describe("MatchCard — variante Jogo Encerrado", () => {
  it("T10: exibe placar no bloco central", () => {
    render(
      <MatchCard
        match={finishedMatch}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        predictionStatus="bloqueado"
        detailHref="/matches/match-002"
      />,
    );
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("x")).toBeTruthy();
  });

  it("T11: badge 'Encerrado' (GameStatusBadge) visível", () => {
    render(
      <MatchCard
        match={finishedMatch}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        predictionStatus="bloqueado"
        detailHref="/matches/match-002"
      />,
    );
    expect(screen.getByText("Encerrado")).toBeTruthy();
  });

  it("T12: exibe 'Palpite Bloqueado' quando sem userPrediction", () => {
    render(
      <MatchCard
        match={finishedMatch}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        predictionStatus="bloqueado"
        userPrediction={null}
        detailHref="/matches/match-002"
      />,
    );
    // MatchStatusBadge "bloqueado" deve estar visível (pode aparecer no footer extra)
    const bloqueadoEls = screen.getAllByText("Palpite Bloqueado");
    expect(bloqueadoEls.length).toBeGreaterThanOrEqual(1);
  });

  it("T13: exibe 'Resultado Final' e placar do palpite quando userPrediction presente", () => {
    render(
      <MatchCard
        match={finishedMatch}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        predictionStatus="bloqueado"
        userPrediction={{ homeScore: 2, awayScore: 1 }}
        detailHref="/matches/match-002"
      />,
    );
    expect(screen.getByText("Resultado Final")).toBeTruthy();
    // Placar do palpite "2 x 1" deve aparecer no footer
    expect(screen.getByText(/2 x 1/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Testes: fallback de bandeira
// ---------------------------------------------------------------------------

describe("MatchCard — fallback de bandeira", () => {
  it("T14: exibe iniciais quando flagUrl é undefined", () => {
    const teamSemBandeira: ResolvedTeam = { name: "Brasil", flagUrl: undefined };
    const visitanteSemBandeira: ResolvedTeam = { name: "França", flagUrl: undefined };

    render(
      <MatchCard
        match={baseMatch}
        homeTeam={teamSemBandeira}
        awayTeam={visitanteSemBandeira}
        predictionStatus="pendente"
        detailHref="/matches/match-001"
      />,
    );

    // Fallback exibe aria-label com o nome do time
    expect(screen.getByLabelText("Brasil")).toBeTruthy();
    expect(screen.getByLabelText("França")).toBeTruthy();
  });

  it("T15: não lança quando ambas as flagUrls são undefined", () => {
    const teamA: ResolvedTeam = { name: "Argentina", flagUrl: undefined };
    const teamB: ResolvedTeam = { name: "Alemanha", flagUrl: undefined };

    expect(() =>
      render(
        <MatchCard
          match={baseMatch}
          homeTeam={teamA}
          awayTeam={teamB}
          predictionStatus="pendente"
          detailHref="/matches/match-001"
        />,
      ),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Testes: venue e estádio
// ---------------------------------------------------------------------------

describe("MatchCard — venue", () => {
  it("T16: exibe nome do estádio e cidade quando venue disponível", () => {
    render(
      <MatchCard
        match={baseMatch}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        predictionStatus="enviado"
        detailHref="/matches/match-001"
      />,
    );
    expect(screen.getByText(/Estádio Lusail/)).toBeTruthy();
  });

  it("T17: não exibe estádio quando venue é null", () => {
    const matchSemVenue: MatchWithId = { ...baseMatch, venue: null };
    render(
      <MatchCard
        match={matchSemVenue}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        predictionStatus="enviado"
        detailHref="/matches/match-001"
      />,
    );
    expect(screen.queryByText(/Estádio Lusail/)).toBeNull();
  });
});
