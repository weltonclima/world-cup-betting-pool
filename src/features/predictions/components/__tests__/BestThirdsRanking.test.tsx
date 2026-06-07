// @vitest-environment jsdom
/**
 * Testes da tela Ranking dos Melhores Terceiros (TASK-12, PRD03-06).
 *
 * Cobre:
 * - buildThirdsRanking (pura): agrupa por groupId, computa standings, ranqueia
 *   os 8 melhores 3ºs (ordem FIFA), groupId de origem, completude dos grupos.
 * - BestThirdsRanking: tabela ranqueada (scope/caption), CTA habilitado vs.
 *   bloqueado (com contagem), estados loading/error/empty, acessibilidade.
 *
 * Padrão de asserção: espelha PredictedStandings.test.tsx (toBeTruthy /
 * getAttribute). Componente apresentacional puro; sem mock de hooks.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MatchWithId, Prediction } from "@/types";
import type { ResolvedTeam } from "@/features/matches/lib/matchesHelpers";

import {
  BestThirdsRanking,
  buildThirdsRanking,
  type ThirdRankingEntry,
} from "../BestThirdsRanking";

// ── Fixtures de domínio ─────────────────────────────────────────────────────

let matchCounter = 0;

function match(
  groupId: string,
  homeTeamId: string,
  awayTeamId: string,
): MatchWithId {
  matchCounter += 1;
  return {
    id: `m-${groupId}-${matchCounter}`,
    homeTeamId,
    awayTeamId,
    kickoffAt: "2026-06-11T18:00:00-06:00",
    stage: "grupos",
    groupId,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
  };
}

/** 6 jogos round-robin de um grupo de 4 times (A,B,C,D). */
function groupMatches(
  groupId: string,
  t: [string, string, string, string],
): MatchWithId[] {
  const [a, b, c, d] = t;
  return [
    match(groupId, a, b),
    match(groupId, a, c),
    match(groupId, a, d),
    match(groupId, b, c),
    match(groupId, b, d),
    match(groupId, c, d),
  ];
}

function pred(matchId: string, h: number, a: number): Prediction {
  return { uid: "u1", matchId, homeScore: h, awayScore: a };
}

/**
 * Preenche TODOS os 6 jogos de um grupo de modo que a ordem final seja
 * a > b > c > d (1º, 2º, 3º, 4º). O 3º colocado é `c`.
 */
function fullyPredictGroup(ms: MatchWithId[]): Prediction[] {
  // ms order: a-b, a-c, a-d, b-c, b-d, c-d
  return [
    pred(ms[0]!.id, 3, 0), // a bate b
    pred(ms[1]!.id, 3, 0), // a bate c
    pred(ms[2]!.id, 3, 0), // a bate d
    pred(ms[3]!.id, 2, 0), // b bate c
    pred(ms[4]!.id, 2, 0), // b bate d
    pred(ms[5]!.id, 1, 0), // c bate d
  ];
}

const TEAM_NAMES: Record<string, string> = {
  JPN: "Japão",
  CAN: "Canadá",
  EGY: "Egito",
  UKR: "Ucrânia",
};

function resolveTeamName(teamId: string): ResolvedTeam {
  return { name: TEAM_NAMES[teamId] ?? teamId, flagUrl: undefined };
}

// ── buildThirdsRanking ──────────────────────────────────────────────────────

describe("buildThirdsRanking", () => {
  it("extrai o 3º de cada grupo e ranqueia; mantém groupId de origem", () => {
    const gA = groupMatches("A", ["A1", "A2", "A3", "A4"]);
    const gB = groupMatches("B", ["B1", "B2", "B3", "B4"]);
    const matches = [...gA, ...gB];
    const predictions = [
      ...fullyPredictGroup(gA),
      ...fullyPredictGroup(gB),
    ];

    const result = buildThirdsRanking(matches, predictions);

    // 2 grupos → 2 terceiros (A3 e B3)
    expect(result.thirds).toHaveLength(2);
    const teamIds = result.thirds.map((t) => t.entry.teamId).sort();
    expect(teamIds).toEqual(["A3", "B3"]);

    // groupId de origem preservado
    const a3 = result.thirds.find((t) => t.entry.teamId === "A3");
    expect(a3?.groupId).toBe("A");
    // rank é 1-based e contíguo
    expect(result.thirds.map((t) => t.rank).sort()).toEqual([1, 2]);
  });

  it("conta grupos completos e deriva allGroupsComplete", () => {
    const gA = groupMatches("A", ["A1", "A2", "A3", "A4"]);
    const gB = groupMatches("B", ["B1", "B2", "B3", "B4"]);
    const matches = [...gA, ...gB];

    // Só A está completo; B fica sem palpites.
    const partial = buildThirdsRanking(matches, fullyPredictGroup(gA));
    expect(partial.totalGroupsCount).toBe(2);
    expect(partial.completedGroupsCount).toBe(1);
    expect(partial.allGroupsComplete).toBe(false);

    // Ambos completos.
    const full = buildThirdsRanking(matches, [
      ...fullyPredictGroup(gA),
      ...fullyPredictGroup(gB),
    ]);
    expect(full.completedGroupsCount).toBe(2);
    expect(full.allGroupsComplete).toBe(true);
  });

  it("ignora partidas fora de grupos e sem groupId; vazio quando sem dados", () => {
    const result = buildThirdsRanking([], []);
    expect(result.thirds).toHaveLength(0);
    expect(result.totalGroupsCount).toBe(0);
    expect(result.allGroupsComplete).toBe(false);
  });

  it("limita o ranking a 8 terceiros", () => {
    const all: MatchWithId[] = [];
    const allPreds: Prediction[] = [];
    // 10 grupos completos → 10 terceiros, mas só 8 entram.
    for (let i = 0; i < 10; i++) {
      const gid = String.fromCharCode(65 + i); // A..J
      const g = groupMatches(gid, [`${gid}1`, `${gid}2`, `${gid}3`, `${gid}4`]);
      all.push(...g);
      allPreds.push(...fullyPredictGroup(g));
    }
    const result = buildThirdsRanking(all, allPreds);
    expect(result.thirds).toHaveLength(8);
    expect(result.completedGroupsCount).toBe(10);
  });
});

// ── BestThirdsRanking — render ──────────────────────────────────────────────

function makeThirds(): ThirdRankingEntry[] {
  const base = {
    played: 3,
    wins: 1,
    draws: 0,
    losses: 2,
    goalsAgainst: 4,
    position: 3,
  };
  return [
    {
      rank: 1,
      groupId: "A",
      entry: { teamId: "JPN", points: 6, goalDifference: 2, goalsFor: 5, ...base },
    },
    {
      rank: 2,
      groupId: "B",
      entry: { teamId: "CAN", points: 4, goalDifference: -1, goalsFor: 3, ...base },
    },
    {
      rank: 3,
      groupId: "C",
      entry: { teamId: "EGY", points: 3, goalDifference: 0, goalsFor: 2, ...base },
    },
  ];
}

function renderRanking(
  overrides: Partial<React.ComponentProps<typeof BestThirdsRanking>> = {},
) {
  const props: React.ComponentProps<typeof BestThirdsRanking> = {
    thirds: makeThirds(),
    resolveTeamName,
    allGroupsComplete: true,
    completedGroupsCount: 12,
    totalGroupsCount: 12,
    bracketHref: "/predictions/chave/dezesseis-avos",
    isLoading: false,
    isError: false,
    onRetry: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<BestThirdsRanking {...props} />) };
}

describe("BestThirdsRanking — render", () => {
  it("renderiza tabela com header (scope=col) e uma linha por terceiro", () => {
    renderRanking();
    expect(screen.getByRole("table")).toBeTruthy();
    const colHeaders = screen.getAllByRole("columnheader");
    expect(colHeaders).toHaveLength(6); // Pos, Seleção, Grupo, Pts, SG, GP
    colHeaders.forEach((h) => expect(h.getAttribute("scope")).toBe("col"));

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(1 + 3); // header + 3 terceiros
  });

  it("exibe Pos, nome, grupo, Pts, SG com sinal e GP por linha", () => {
    renderRanking();
    const rows = screen.getAllByRole("row").slice(1); // pula header
    const first = within(rows[0]!);
    expect(first.getByText("Japão")).toBeTruthy();
    expect(first.getByText("Grupo A")).toBeTruthy();
    expect(first.getByText("6")).toBeTruthy(); // Pts
    expect(first.getByText("+2")).toBeTruthy(); // SG com sinal
    // 3º com SG zero
    const third = within(rows[2]!);
    expect(third.getByText("0")).toBeTruthy();
  });

  it("badge de posição tem aria-label de melhor terceiro", () => {
    renderRanking();
    expect(screen.getByLabelText("1º melhor terceiro")).toBeTruthy();
    expect(screen.getByLabelText("3º melhor terceiro")).toBeTruthy();
  });

  it("tabela tem caption acessível", () => {
    renderRanking();
    expect(
      screen.getByText("Ranking dos melhores terceiros colocados"),
    ).toBeTruthy();
  });
});

// ── CTA habilitado vs. bloqueado ────────────────────────────────────────────

describe("BestThirdsRanking — CTA Gerar 16 Avos", () => {
  it("habilitado (link) quando allGroupsComplete=true", () => {
    renderRanking({ allGroupsComplete: true });
    const link = screen.getByRole("link", {
      name: "Gerar a chave dos 16 avos de final",
    });
    expect(link.getAttribute("href")).toBe(
      "/predictions/chave/dezesseis-avos",
    );
    // Sem botão desabilitado nem texto de contagem.
    expect(screen.queryByText(/Complete os 12 grupos/)).toBeNull();
  });

  it("bloqueado (botão disabled + contagem) quando allGroupsComplete=false", () => {
    renderRanking({
      allGroupsComplete: false,
      completedGroupsCount: 7,
      totalGroupsCount: 12,
    });
    expect(screen.queryByRole("link")).toBeNull();
    const btn = screen.getByRole("button", {
      name: "Gerar 16 Avos — complete os 12 grupos primeiro",
    });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText(/7 de 12 grupos prontos/)).toBeTruthy();
  });
});

// ── Estados ──────────────────────────────────────────────────────────────────

describe("BestThirdsRanking — estados", () => {
  it("loading → skeleton com role=status; sem tabela", () => {
    renderRanking({ isLoading: true });
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("error → alerta + retry chama onRetry", () => {
    const onRetry = vi.fn();
    renderRanking({ isError: true, onRetry });
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("empty (thirds vazio) → mensagem orientando preencher; sem tabela", () => {
    renderRanking({ thirds: [] });
    expect(
      screen.getByText(/Preencha os jogos dos grupos/),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
