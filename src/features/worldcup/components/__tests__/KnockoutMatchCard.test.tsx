// @vitest-environment jsdom
/**
 * Testes do KnockoutMatchCard (TASK-08 + PRD-16 TASK-03).
 *
 * T1–T10: variantes aguardando / definido / encerrado (comportamento original).
 * T11–T18: novos campos kickoffAt, venue, badge vencedor (TASK-03).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KnockoutMatchCard } from "@/features/worldcup/components/KnockoutMatchCard";
import type { KnockoutMatch } from "@/types/worldcup";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENCERRADO: KnockoutMatch = {
  id: "m73",
  phase: "dezesseis-avos",
  homeTeam: { name: "Brasil", code: "BRA", flagUrl: "https://cdn.test/bra.svg", defined: true },
  awayTeam: { name: "França", code: "FRA", flagUrl: "https://cdn.test/fra.svg", defined: true },
  homeScore: 2,
  awayScore: 1,
  status: "encerrado",
};

const DEFINIDO: KnockoutMatch = {
  id: "m74",
  phase: "dezesseis-avos",
  homeTeam: { name: "Argentina", code: "ARG", defined: true },
  awayTeam: { name: "México", code: "MEX", defined: true },
  status: "definido",
};

const AGUARDANDO: KnockoutMatch = {
  id: "m75",
  phase: "dezesseis-avos",
  homeTeam: { name: "Vencedor Jogo 74", defined: false },
  awayTeam: { name: "1º do Grupo A", defined: false },
  status: "aguardando",
};

// Jogo ao vivo (em-andamento) — placar parcial, ambos os lados definidos
const AO_VIVO: KnockoutMatch = {
  id: "m77",
  phase: "quartas",
  homeTeam: { name: "Brasil", code: "BRA", flagUrl: "https://cdn.test/bra.svg", defined: true },
  awayTeam: { name: "Croácia", code: "CRO", flagUrl: "https://cdn.test/cro.svg", defined: true },
  homeScore: 1,
  awayScore: 0,
  status: "em-andamento",
};

// Fixtures PRD-16 TASK-03 — com kickoffAt e venue
const ENCERRADO_WITH_META: KnockoutMatch = {
  ...ENCERRADO,
  kickoffAt: "2026-06-29T19:00:00.000Z", // 16h00 BRT (TZ fixado em America/Sao_Paulo)
  venue: { name: "Estádio do Maracanã", city: "Rio de Janeiro" },
};

// Empate mata-mata (draw) — sem vencedor visual
const ENCERRADO_DRAW: KnockoutMatch = {
  id: "m76",
  phase: "oitavas",
  homeTeam: { name: "França", code: "FRA", defined: true },
  awayTeam: { name: "Alemanha", code: "GER", defined: true },
  homeScore: 1,
  awayScore: 1,
  status: "encerrado",
};

// Decidido nos pênaltis (TASK-04) — empate no tempo, home avança nos pênaltis
const ENCERRADO_PENALTIS: KnockoutMatch = {
  id: "m78",
  phase: "oitavas",
  homeTeam: { name: "Brasil", code: "BRA", defined: true },
  awayTeam: { name: "Argentina", code: "ARG", defined: true },
  homeScore: 1,
  awayScore: 1,
  homeShootout: 4,
  awayShootout: 3,
  outcome: "penalties",
  advanceSide: "home",
  status: "encerrado",
};

// Decidido na prorrogação (TASK-04) — sem pênaltis
const ENCERRADO_PRORROGACAO: KnockoutMatch = {
  id: "m79",
  phase: "oitavas",
  homeTeam: { name: "Brasil", code: "BRA", defined: true },
  awayTeam: { name: "Croácia", code: "CRO", defined: true },
  homeScore: 2,
  awayScore: 1,
  outcome: "overtime",
  advanceSide: "home",
  status: "encerrado",
};

// ---------------------------------------------------------------------------
// Testes existentes — T1–T10 (comportamento original preservado)
// ---------------------------------------------------------------------------

describe("KnockoutMatchCard — encerrado", () => {
  it("T1: exibe placar e nomes das seleções", () => {
    render(<KnockoutMatchCard match={ENCERRADO} />);
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("França")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("T2: tem aria-label com o resultado completo", () => {
    render(<KnockoutMatchCard match={ENCERRADO} />);
    expect(screen.getByLabelText("Brasil 2 x 1 França")).toBeTruthy();
  });

  it("T3: NÃO exibe 'Aguardando definição'", () => {
    render(<KnockoutMatchCard match={ENCERRADO} />);
    expect(screen.queryByText("Aguardando definição")).toBeNull();
  });

  it("T4: renderiza bandeiras via <img> quando flagUrl presente", () => {
    render(<KnockoutMatchCard match={ENCERRADO} />);
    const imgs = screen.getAllByRole("img");
    expect(imgs.some((i) => i.getAttribute("alt") === "Brasil")).toBe(true);
    expect(imgs.some((i) => i.getAttribute("alt") === "França")).toBe(true);
  });
});

describe("KnockoutMatchCard — definido", () => {
  it("T5: exibe nomes das seleções e nenhum placar", () => {
    render(<KnockoutMatchCard match={DEFINIDO} />);
    expect(screen.getByText("Argentina")).toBeTruthy();
    expect(screen.getByText("México")).toBeTruthy();
    expect(screen.getByText("x")).toBeTruthy();
    expect(screen.queryByText("2")).toBeNull();
  });

  it("T6: NÃO exibe 'Aguardando definição'", () => {
    render(<KnockoutMatchCard match={DEFINIDO} />);
    expect(screen.queryByText("Aguardando definição")).toBeNull();
  });

  it("T7: fallback de iniciais quando flagUrl ausente (lado defined)", () => {
    render(<KnockoutMatchCard match={DEFINIDO} />);
    expect(screen.queryByRole("img", { name: "Argentina" })).toBeNull();
    expect(screen.getByLabelText("Argentina")).toBeTruthy();
    expect(screen.getByLabelText("México")).toBeTruthy();
  });
});

describe("KnockoutMatchCard — aguardando", () => {
  it("T8: exibe rótulos placeholder + 'Aguardando definição'", () => {
    render(<KnockoutMatchCard match={AGUARDANDO} />);
    expect(screen.getByText("Vencedor Jogo 74")).toBeTruthy();
    expect(screen.getByText("1º do Grupo A")).toBeTruthy();
    expect(screen.getByText("Aguardando definição")).toBeTruthy();
  });

  it("T9: lado não definido NÃO renderiza <img> de bandeira", () => {
    render(<KnockoutMatchCard match={AGUARDANDO} />);
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("T10: NÃO exibe placar", () => {
    render(<KnockoutMatchCard match={AGUARDANDO} />);
    expect(screen.queryByText("0")).toBeNull();
  });
});

describe("KnockoutMatchCard — em-andamento (ao vivo)", () => {
  it("L1: exibe placar parcial e nomes das seleções", () => {
    render(<KnockoutMatchCard match={AO_VIVO} />);
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("Croácia")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("L2: exibe indicador 'Ao vivo'", () => {
    render(<KnockoutMatchCard match={AO_VIVO} />);
    expect(screen.getByText("Ao vivo")).toBeTruthy();
  });

  it("L3: aria-label inclui o placar parcial", () => {
    render(<KnockoutMatchCard match={AO_VIVO} />);
    expect(screen.getByLabelText("Brasil 1 x 0 Croácia")).toBeTruthy();
  });

  it("L4: NÃO coroa vencedor durante o jogo (sem Trophy nem data-winner)", () => {
    render(<KnockoutMatchCard match={AO_VIVO} />);
    expect(document.querySelector('[data-testid="winner-icon"]')).toBeNull();
    expect(document.querySelector("[data-winner]")).toBeNull();
  });

  it("L5: NÃO exibe 'Aguardando definição'", () => {
    render(<KnockoutMatchCard match={AO_VIVO} />);
    expect(screen.queryByText("Aguardando definição")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Novos testes TASK-03 — T11–T18
// ---------------------------------------------------------------------------

describe("KnockoutMatchCard — metadata: data/hora e venue (TASK-03)", () => {
  it("T11: exibe venue.city quando presente", () => {
    render(<KnockoutMatchCard match={ENCERRADO_WITH_META} />);
    expect(screen.getByText("Rio de Janeiro")).toBeTruthy();
  });

  it("T12: omite venue quando ausente", () => {
    render(<KnockoutMatchCard match={ENCERRADO} />);
    expect(screen.queryByText("Rio de Janeiro")).toBeNull();
  });

  it("T13: data formatada em BRT contém 'Jun' e separador 'h'", () => {
    render(<KnockoutMatchCard match={ENCERRADO_WITH_META} />);
    // Partial match (spec §9 T13): assertar tokens, não a string completa.
    // weekday/month "short" dependem do ICU do Node (varia entre CI/máquina);
    // só a hora é determinística via TZ pin. TZ America/Sao_Paulo: 19h UTC = 16h BRT.
    const dateEl = screen.getByText(
      (content) => content.includes("Jun") && content.includes("16h00"),
    );
    expect(dateEl).toBeTruthy();
  });

  it("T14: exibe 'Data a confirmar' quando kickoffAt ausente (definido)", () => {
    render(<KnockoutMatchCard match={DEFINIDO} />);
    expect(screen.getByText("Data a confirmar")).toBeTruthy();
  });

  it("T18: exibe 'Data a confirmar' quando aguardando (sem kickoffAt)", () => {
    render(<KnockoutMatchCard match={AGUARDANDO} />);
    expect(screen.getByText("Data a confirmar")).toBeTruthy();
  });
});

describe("KnockoutMatchCard — badge vencedor (TASK-03)", () => {
  it("T15: Trophy icon presente quando encerrado com vencedor claro (home 2-1)", () => {
    render(<KnockoutMatchCard match={ENCERRADO} />);
    expect(document.querySelector('[data-testid="winner-icon"]')).toBeTruthy();
  });

  it("T16: sem Trophy nem data-winner quando encerrado em empate (draw)", () => {
    render(<KnockoutMatchCard match={ENCERRADO_DRAW} />);
    expect(document.querySelector('[data-testid="winner-icon"]')).toBeNull();
    expect(document.querySelector("[data-winner]")).toBeNull();
  });

  it("T17: data-winner presente apenas no SideRow vencedor (home 2-1)", () => {
    render(<KnockoutMatchCard match={ENCERRADO} />);
    // Home (Brasil) é vencedor → SideRow tem data-winner
    const winnerSide = document.querySelector("[data-winner]");
    expect(winnerSide).toBeTruthy();
    expect(winnerSide?.textContent).toContain("Brasil");
    expect(winnerSide?.textContent).not.toContain("França");
  });

  it("T15b: Trophy ausente quando status é definido (sem encerramento)", () => {
    render(<KnockoutMatchCard match={DEFINIDO} />);
    expect(document.querySelector('[data-testid="winner-icon"]')).toBeNull();
  });

  it("T15c: Trophy ausente quando status é aguardando", () => {
    render(<KnockoutMatchCard match={AGUARDANDO} />);
    expect(document.querySelector('[data-testid="winner-icon"]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Pênaltis e desfecho (TASK-04) — variante full
// ---------------------------------------------------------------------------

describe("KnockoutMatchCard — pênaltis e desfecho (full)", () => {
  it("P1: exibe o placar com pênaltis entre parênteses ('1 (4)' / '1 (3)')", () => {
    render(<KnockoutMatchCard match={ENCERRADO_PENALTIS} />);
    expect(screen.getByText("1 (4)")).toBeTruthy();
    expect(screen.getByText("1 (3)")).toBeTruthy();
  });

  it("P2: aria-label inclui o placar com pênaltis", () => {
    render(<KnockoutMatchCard match={ENCERRADO_PENALTIS} />);
    expect(screen.getByLabelText("Brasil 1 (4) x 1 (3) Argentina")).toBeTruthy();
  });

  it("P3: coroa o lado que AVANÇOU nos pênaltis apesar do empate no tempo normal", () => {
    render(<KnockoutMatchCard match={ENCERRADO_PENALTIS} />);
    expect(document.querySelector('[data-testid="winner-icon"]')).toBeTruthy();
    const winnerSide = document.querySelector("[data-winner]");
    expect(winnerSide?.textContent).toContain("Brasil");
    expect(winnerSide?.textContent).not.toContain("Argentina");
  });

  it("P4: exibe a legenda 'Decidido nos pênaltis'", () => {
    render(<KnockoutMatchCard match={ENCERRADO_PENALTIS} />);
    expect(screen.getByText("Decidido nos pênaltis")).toBeTruthy();
  });

  it("P5: exibe a legenda 'Após prorrogação' quando outcome=overtime (sem pênaltis)", () => {
    render(<KnockoutMatchCard match={ENCERRADO_PRORROGACAO} />);
    expect(screen.getByText("Após prorrogação")).toBeTruthy();
    // Sem pênaltis → placar simples, sem parênteses.
    expect(screen.queryByText(/\(\d\)/)).toBeNull();
  });

  it("P6: jogo normal não exibe legenda de desfecho nem pênaltis", () => {
    render(<KnockoutMatchCard match={ENCERRADO} />);
    expect(screen.queryByText("Decidido nos pênaltis")).toBeNull();
    expect(screen.queryByText("Após prorrogação")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Variante compact (nó de árvore do chaveamento — PRD-16 TASK-04 v2)
// ---------------------------------------------------------------------------

describe("KnockoutMatchCard — variant=compact", () => {
  it("C1: NÃO exibe os nomes das seleções como texto visível", () => {
    render(<KnockoutMatchCard match={DEFINIDO} variant="compact" />);
    expect(screen.queryByText("Argentina")).toBeNull();
    expect(screen.queryByText("México")).toBeNull();
  });

  it("C2: preserva os nomes no aria-label (acessibilidade) — definido", () => {
    render(<KnockoutMatchCard match={DEFINIDO} variant="compact" />);
    expect(screen.getByLabelText("Argentina x México")).toBeTruthy();
  });

  it("C3: aria-label inclui placar quando encerrado", () => {
    render(<KnockoutMatchCard match={ENCERRADO} variant="compact" />);
    expect(screen.getByLabelText("Brasil 2 x 1 França")).toBeTruthy();
  });

  it("C4: renderiza bandeiras via <img> quando flagUrl presente", () => {
    render(<KnockoutMatchCard match={ENCERRADO} variant="compact" />);
    const imgs = screen.getAllByRole("img");
    expect(imgs.some((i) => i.getAttribute("alt") === "Brasil")).toBe(true);
    expect(imgs.some((i) => i.getAttribute("alt") === "França")).toBe(true);
  });

  it("C5: exibe os placares quando encerrado", () => {
    render(<KnockoutMatchCard match={ENCERRADO} variant="compact" />);
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("C6: NÃO exibe placar quando não encerrado (definido)", () => {
    render(<KnockoutMatchCard match={DEFINIDO} variant="compact" />);
    expect(screen.queryByText("x")).toBeNull();
  });

  it("C7: destaca o lado vencedor com data-winner (home 2-1)", () => {
    render(<KnockoutMatchCard match={ENCERRADO} variant="compact" />);
    const winner = document.querySelector("[data-winner]");
    expect(winner).toBeTruthy();
  });

  it("C8: exibe estádio e cidade quando venue presente", () => {
    render(<KnockoutMatchCard match={ENCERRADO_WITH_META} variant="compact" />);
    expect(screen.getByText("Estádio do Maracanã")).toBeTruthy();
    expect(screen.getByText("Rio de Janeiro")).toBeTruthy();
  });

  it("C9: exibe data/hora formatada quando kickoffAt presente", () => {
    render(<KnockoutMatchCard match={ENCERRADO_WITH_META} variant="compact" />);
    // formatKickoffBr → horário em America/Sao_Paulo (16h00 BRT)
    expect(screen.getByText(/16h00/)).toBeTruthy();
  });

  it("C10: exibe rótulo de status 'Encerrado' para jogo encerrado", () => {
    render(<KnockoutMatchCard match={ENCERRADO} variant="compact" />);
    expect(screen.getByText("Encerrado")).toBeTruthy();
  });

  it("C11: exibe rótulo de status 'Agendado' para jogo definido", () => {
    render(<KnockoutMatchCard match={DEFINIDO} variant="compact" />);
    expect(screen.getByText("Agendado")).toBeTruthy();
  });

  it("C12: exibe rótulo de status 'Aguardando' para jogo aguardando", () => {
    render(<KnockoutMatchCard match={AGUARDANDO} variant="compact" />);
    expect(screen.getByText("Aguardando")).toBeTruthy();
  });

  it("C13: exibe rótulo 'Ao vivo' para jogo em-andamento", () => {
    render(<KnockoutMatchCard match={AO_VIVO} variant="compact" />);
    expect(screen.getByText("Ao vivo")).toBeTruthy();
  });

  it("C14: exibe placar parcial quando em-andamento", () => {
    render(<KnockoutMatchCard match={AO_VIVO} variant="compact" />);
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("C15: aria-label inclui placar parcial quando em-andamento", () => {
    render(<KnockoutMatchCard match={AO_VIVO} variant="compact" />);
    expect(screen.getByLabelText("Brasil 1 x 0 Croácia")).toBeTruthy();
  });

  it("C16: exibe pênaltis '(n)' no placar (compact)", () => {
    render(<KnockoutMatchCard match={ENCERRADO_PENALTIS} variant="compact" />);
    expect(screen.getByText("1 (4)")).toBeTruthy();
    expect(screen.getByText("1 (3)")).toBeTruthy();
  });

  it("C17: aria-label inclui pênaltis (compact)", () => {
    render(<KnockoutMatchCard match={ENCERRADO_PENALTIS} variant="compact" />);
    expect(screen.getByLabelText("Brasil 1 (4) x 1 (3) Argentina")).toBeTruthy();
  });

  it("C18: coroa o lado que avançou nos pênaltis (data-winner, compact)", () => {
    render(<KnockoutMatchCard match={ENCERRADO_PENALTIS} variant="compact" />);
    const winner = document.querySelector("[data-winner]");
    expect(winner).toBeTruthy();
  });
});
