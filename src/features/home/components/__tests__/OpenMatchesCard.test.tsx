// @vitest-environment jsdom
/**
 * Testes do OpenMatchesCard (TASK-02 home-revamp).
 * Componente presentacional puro — assertions estruturais, sem snapshot.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  OpenMatchesResult,
  OpenMatchSummary,
  SystemNotice,
} from "@/features/home/lib/homeDashboardHelpers";

import { OpenMatchesCard } from "../OpenMatchesCard";

// ── fixtures ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<OpenMatchSummary> = {}): OpenMatchSummary {
  return {
    matchId: "match-1",
    kickoffAt: "2026-06-20T18:00:00.000Z",
    homeTeam: { name: "Brasil", flagUrl: undefined },
    awayTeam: { name: "Sérvia", flagUrl: undefined },
    deadlineLabel: "Fecha em 1h 30m",
    isUrgent: false,
    predictHref: "/matches/match-1/predict",
    ...overrides,
  };
}

function makeResult(
  items: OpenMatchSummary[],
  totalOpen = items.length,
): OpenMatchesResult {
  return { items, totalOpen };
}

// ── suítes ────────────────────────────────────────────────────────────────────

describe("OpenMatchesCard — lista de jogos", () => {
  it("renderiza times e deadline de cada jogo", () => {
    render(<OpenMatchesCard openMatches={makeResult([makeItem()])} notices={[]} />);

    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("Sérvia")).toBeTruthy();
    expect(screen.getByText("Fecha em 1h 30m")).toBeTruthy();
  });

  it("CTA 'Palpitar' é um link para predictHref com aria-label contextual", () => {
    render(<OpenMatchesCard openMatches={makeResult([makeItem()])} notices={[]} />);

    const cta = screen.getByRole("link", {
      name: "Palpitar em Brasil contra Sérvia",
    });
    expect(cta.getAttribute("href")).toBe("/matches/match-1/predict");
  });

  it("renderiza um CTA por jogo", () => {
    const items = [
      makeItem({ matchId: "m-1", predictHref: "/matches/m-1/predict" }),
      makeItem({ matchId: "m-2", predictHref: "/matches/m-2/predict" }),
    ];
    render(<OpenMatchesCard openMatches={makeResult(items)} notices={[]} />);

    expect(screen.getAllByRole("link", { name: /Palpitar/ })).toHaveLength(2);
  });
});

describe("OpenMatchesCard — rodapé '+ N outros'", () => {
  it("exibe '+ N outros jogos abertos' quando totalOpen > items.length", () => {
    render(
      <OpenMatchesCard openMatches={makeResult([makeItem()], 5)} notices={[]} />,
    );
    expect(screen.getByText("+ 4 outros jogos abertos")).toBeTruthy();
  });

  it("usa singular quando resta exatamente 1 jogo", () => {
    render(
      <OpenMatchesCard openMatches={makeResult([makeItem()], 2)} notices={[]} />,
    );
    expect(screen.getByText("+ 1 outro jogo aberto")).toBeTruthy();
  });

  it("não exibe rodapé quando totalOpen === items.length", () => {
    render(<OpenMatchesCard openMatches={makeResult([makeItem()])} notices={[]} />);
    expect(screen.queryByText(/outros? jogos? aberto/)).toBeNull();
  });
});

describe("OpenMatchesCard — empty state", () => {
  it("exibe mensagem positiva quando não há jogos abertos", () => {
    render(<OpenMatchesCard openMatches={makeResult([], 0)} notices={[]} />);

    expect(screen.getByText("Você está em dia!")).toBeTruthy();
    expect(screen.getByText("Nenhum jogo aberto para palpitar.")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("OpenMatchesCard — faixa de avisos", () => {
  const notices: SystemNotice[] = [
    { id: "n1", message: "Palpites encerram em breve.", severity: "warning" },
    { id: "n2", message: "Cadastros encerrados.", severity: "info" },
  ];

  it("renderiza os avisos quando notices não está vazio", () => {
    render(
      <OpenMatchesCard openMatches={makeResult([makeItem()])} notices={notices} />,
    );
    expect(screen.getByText("Palpites encerram em breve.")).toBeTruthy();
    expect(screen.getByText("Cadastros encerrados.")).toBeTruthy();
  });

  it("renderiza avisos mesmo no empty state", () => {
    render(<OpenMatchesCard openMatches={makeResult([], 0)} notices={notices} />);
    expect(screen.getByText("Palpites encerram em breve.")).toBeTruthy();
    expect(screen.getByText("Você está em dia!")).toBeTruthy();
  });

  it("não renderiza avisos quando notices é vazio", () => {
    render(<OpenMatchesCard openMatches={makeResult([makeItem()])} notices={[]} />);
    expect(screen.queryByText("Cadastros encerrados.")).toBeNull();
  });
});

describe("OpenMatchesCard — acessibilidade", () => {
  it("expõe article com aria-label", () => {
    render(<OpenMatchesCard openMatches={makeResult([makeItem()])} notices={[]} />);

    const card = screen.getByRole("article", {
      name: "Jogos abertos para palpitar",
    });
    expect(within(card).getByRole("link", { name: /Palpitar/ })).toBeTruthy();
  });
});
