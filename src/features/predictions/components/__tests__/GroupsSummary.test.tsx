// @vitest-environment jsdom
/**
 * Testes da tela Resumo dos 12 Grupos (TASK-11 · PRD03-05).
 *
 * Cobre:
 * - Helper puro `buildGroupsSummary` (agrupamento, completude, classificados,
 *   normalização de groupId, allComplete).
 * - Componente apresentacional `GroupsSummary` (estados loading/error/empty,
 *   render de grupos, ✓ de concluído, badge de candidato a 3º, CTA bloqueado/liberado).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MatchWithId, Prediction, TeamWithId } from "@/types";

import { GroupsSummary } from "@/features/predictions/components/GroupsSummary";
import {
  buildGroupsSummary,
  normalizeGroupId,
  type GroupSummaryItem,
} from "@/features/predictions/components/groupsSummaryData";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMatch(overrides: Partial<MatchWithId> & { id: string }): MatchWithId {
  return {
    homeTeamId: "BRA",
    awayTeamId: "FRA",
    kickoffAt: "2026-06-14T16:00:00Z",
    stage: "grupos",
    round: 1,
    groupId: "Group A",
    venue: null,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    ...overrides,
  };
}

function makePred(matchId: string, homeScore: number, awayScore: number): Prediction {
  return { uid: "u1", matchId, homeScore, awayScore };
}

function makeTeam(id: string, name: string): TeamWithId {
  return { id, name, code: id.slice(0, 3).toUpperCase() };
}

/**
 * Constrói um grupo de 4 times (6 jogos round-robin) com placares que produzem
 * uma ordem determinística: t1 > t2 > t3 > t4.
 */
function buildCompleteGroup(
  gid: string,
  teams: [string, string, string, string],
): { matches: MatchWithId[]; predictions: Prediction[] } {
  const [a, b, c, d] = teams;
  const pairs: Array<[string, string]> = [
    [a, b],
    [a, c],
    [a, d],
    [b, c],
    [b, d],
    [c, d],
  ];
  const matches: MatchWithId[] = [];
  const predictions: Prediction[] = [];
  pairs.forEach(([home, away], idx) => {
    const id = `${gid}-${idx}`;
    matches.push(
      makeMatch({ id, groupId: `Group ${gid}`, homeTeamId: home, awayTeamId: away }),
    );
    // 'a' vence todos; 'b' vence c e d; 'c' vence d. → a>b>c>d
    let hs = 1;
    let as_ = 0;
    if (home === a) {
      hs = 3;
      as_ = 0;
    } else if (home === b && (away === c || away === d)) {
      hs = 2;
      as_ = 0;
    } else if (home === c && away === d) {
      hs = 1;
      as_ = 0;
    }
    predictions.push(makePred(id, hs, as_));
  });
  return { matches, predictions };
}

const teamsCatalog: TeamWithId[] = [
  makeTeam("BRA", "Brasil"),
  makeTeam("NED", "Holanda"),
  makeTeam("ARG", "Argentina"),
  makeTeam("MEX", "México"),
];

// ---------------------------------------------------------------------------
// Helper puro — buildGroupsSummary
// ---------------------------------------------------------------------------

describe("normalizeGroupId", () => {
  it("T1: remove prefixo 'Group ' e uppercase", () => {
    expect(normalizeGroupId("Group A")).toBe("A");
  });
  it("T2: remove prefixo 'Grupo '", () => {
    expect(normalizeGroupId("Grupo b")).toBe("B");
  });
  it("T3: aceita id já curto", () => {
    expect(normalizeGroupId("c")).toBe("C");
  });
});

describe("buildGroupsSummary — agrupamento e completude", () => {
  it("T4: ignora partidas que não são de fase de grupos", () => {
    const matches = [
      makeMatch({ id: "ko-1", stage: "oitavas", groupId: null }),
    ];
    const result = buildGroupsSummary(matches, [], teamsCatalog);
    expect(result.groups).toHaveLength(0);
  });

  it("T5: ignora partidas de grupo sem groupId", () => {
    const matches = [makeMatch({ id: "x", groupId: null })];
    const result = buildGroupsSummary(matches, [], teamsCatalog);
    expect(result.groups).toHaveLength(0);
  });

  it("T6: agrupa por groupId normalizado e ordena A→L", () => {
    const matches = [
      makeMatch({ id: "b1", groupId: "Group B" }),
      makeMatch({ id: "a1", groupId: "Group A" }),
    ];
    const result = buildGroupsSummary(matches, [], teamsCatalog);
    expect(result.groups.map((g) => g.groupId)).toEqual(["A", "B"]);
    expect(result.groups[0]?.label).toBe("Grupo A");
  });

  it("T7: grupo incompleto não expõe classificados e marca isComplete=false", () => {
    const matches = [
      makeMatch({ id: "a1", groupId: "Group A" }),
      makeMatch({ id: "a2", groupId: "Group A" }),
    ];
    const result = buildGroupsSummary(matches, [makePred("a1", 1, 0)], teamsCatalog);
    const groupA = result.groups[0]!;
    expect(groupA.isComplete).toBe(false);
    expect(groupA.filled).toBe(1);
    expect(groupA.total).toBe(2);
    expect(groupA.first).toBeUndefined();
  });

  it("T8: grupo completo expõe 1º/2º/3º com nomes resolvidos", () => {
    const { matches, predictions } = buildCompleteGroup("A", [
      "BRA",
      "NED",
      "ARG",
      "MEX",
    ]);
    const result = buildGroupsSummary(matches, predictions, teamsCatalog);
    const groupA = result.groups[0]!;
    expect(groupA.isComplete).toBe(true);
    expect(groupA.first?.name).toBe("Brasil");
    expect(groupA.second?.name).toBe("Holanda");
    expect(groupA.third?.name).toBe("Argentina");
    expect(groupA.third?.position).toBe(3);
  });

  it("T9: nome de time não catalogado faz fallback para o teamId", () => {
    const { matches, predictions } = buildCompleteGroup("A", [
      "BRA",
      "NED",
      "ARG",
      "MEX",
    ]);
    const result = buildGroupsSummary(matches, predictions, []); // sem catálogo
    expect(result.groups[0]?.first?.name).toBe("BRA");
  });

  it("T10: allComplete=true quando todos os grupos estão completos", () => {
    const g1 = buildCompleteGroup("A", ["BRA", "NED", "ARG", "MEX"]);
    const g2 = buildCompleteGroup("B", ["BRA", "NED", "ARG", "MEX"]);
    const result = buildGroupsSummary(
      [...g1.matches, ...g2.matches],
      [...g1.predictions, ...g2.predictions],
      teamsCatalog,
    );
    expect(result.completeCount).toBe(2);
    expect(result.allComplete).toBe(true);
  });

  it("T11: allComplete=false quando ao menos um grupo está incompleto", () => {
    const g1 = buildCompleteGroup("A", ["BRA", "NED", "ARG", "MEX"]);
    const incompleteB = [makeMatch({ id: "b1", groupId: "Group B" })];
    const result = buildGroupsSummary(
      [...g1.matches, ...incompleteB],
      g1.predictions,
      teamsCatalog,
    );
    expect(result.allComplete).toBe(false);
    expect(result.completeCount).toBe(1);
  });

  it("T12: lista vazia → allComplete=false", () => {
    const result = buildGroupsSummary([], [], teamsCatalog);
    expect(result.allComplete).toBe(false);
    expect(result.completeCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Componente — GroupsSummary
// ---------------------------------------------------------------------------

const completeGroup: GroupSummaryItem = {
  groupId: "A",
  label: "Grupo A",
  first: { teamId: "BRA", name: "Brasil", position: 1 },
  second: { teamId: "NED", name: "Holanda", position: 2 },
  third: { teamId: "ARG", name: "Argentina", position: 3 },
  filled: 6,
  total: 6,
  isComplete: true,
};

const incompleteGroup: GroupSummaryItem = {
  groupId: "B",
  label: "Grupo B",
  filled: 2,
  total: 6,
  isComplete: false,
};

function baseProps(overrides: Partial<React.ComponentProps<typeof GroupsSummary>> = {}) {
  return {
    groups: [completeGroup],
    allComplete: true,
    completeCount: 1,
    continueHref: "/predictions/melhores-terceiros",
    isLoading: false,
    isError: false,
    onRetry: vi.fn(),
    ...overrides,
  };
}

describe("GroupsSummary — estado loading", () => {
  it("T13: exibe skeleton com role=status", () => {
    render(<GroupsSummary {...baseProps({ isLoading: true })} />);
    expect(
      screen.getByRole("status", { name: "Carregando resumo dos grupos" }),
    ).toBeTruthy();
  });

  it("T14: não exibe cards de grupo durante loading", () => {
    render(<GroupsSummary {...baseProps({ isLoading: true })} />);
    expect(screen.queryByText("Brasil")).toBeNull();
  });
});

describe("GroupsSummary — estado error", () => {
  it("T15: exibe mensagem de erro", () => {
    render(<GroupsSummary {...baseProps({ isError: true })} />);
    expect(screen.getByText("Erro ao carregar o resumo dos grupos")).toBeTruthy();
  });

  it("T16: clicar em 'Tentar novamente' chama onRetry", () => {
    const onRetry = vi.fn();
    render(<GroupsSummary {...baseProps({ isError: true, onRetry })} />);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("GroupsSummary — estado empty", () => {
  it("T17: exibe 'Nenhum grupo encontrado' quando groups vazio", () => {
    render(<GroupsSummary {...baseProps({ groups: [], allComplete: false })} />);
    expect(screen.getByText("Nenhum grupo encontrado")).toBeTruthy();
  });
});

describe("GroupsSummary — estado sucesso", () => {
  it("T18: renderiza o título 'Resumo dos Grupos'", () => {
    render(<GroupsSummary {...baseProps()} />);
    expect(screen.getByRole("heading", { name: "Resumo dos Grupos", level: 1 })).toBeTruthy();
  });

  it("T19: grupo completo exibe 1º/2º/3º com nomes", () => {
    render(<GroupsSummary {...baseProps()} />);
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("Holanda")).toBeTruthy();
    expect(screen.getByText("Argentina")).toBeTruthy();
  });

  it("T20: grupo completo exibe selo 'Concluído'", () => {
    render(<GroupsSummary {...baseProps()} />);
    expect(screen.getByText("Concluído")).toBeTruthy();
  });

  it("T21: 3º colocado recebe badge 'candidato a 3º'", () => {
    render(<GroupsSummary {...baseProps()} />);
    expect(screen.getByText("candidato a 3º")).toBeTruthy();
  });

  it("T22: cada grupo é uma section com aria-label do grupo", () => {
    render(<GroupsSummary {...baseProps()} />);
    expect(screen.getByRole("region", { name: "Grupo A" })).toBeTruthy();
  });
});

describe("GroupsSummary — grupo incompleto", () => {
  it("T23: exibe progresso 'X / Y jogos' e 'em andamento', sem classificados", () => {
    render(
      <GroupsSummary
        {...baseProps({ groups: [incompleteGroup], allComplete: false, completeCount: 0 })}
      />,
    );
    expect(screen.getByText("2 / 6 jogos")).toBeTruthy();
    expect(screen.getByText("em andamento")).toBeTruthy();
    expect(screen.queryByText("Concluído")).toBeNull();
  });
});

describe("GroupsSummary — CTA Ver Melhores Terceiros", () => {
  it("T24: habilitado e navegável quando allComplete=true", () => {
    render(<GroupsSummary {...baseProps({ allComplete: true })} />);
    const link = screen.getByRole("link", { name: "Ver Melhores Terceiros" });
    expect(link.getAttribute("href")).toBe("/predictions/melhores-terceiros");
  });

  it("T25: desabilitado quando há grupo incompleto e mostra contagem", () => {
    render(
      <GroupsSummary
        {...baseProps({
          groups: [completeGroup, incompleteGroup],
          allComplete: false,
          completeCount: 1,
        })}
      />,
    );
    // Não há link navegável quando bloqueado
    expect(screen.queryByRole("link", { name: "Ver Melhores Terceiros" })).toBeNull();
    const btn = screen.getByRole("button", { name: "Ver Melhores Terceiros" });
    expect(btn.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/1 \/ 12 grupos concluídos/)).toBeTruthy();
  });
});
