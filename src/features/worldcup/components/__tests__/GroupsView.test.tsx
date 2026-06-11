// @vitest-environment jsdom
/**
 * Testes do GroupsView (TASK-07).
 *
 * Estratégia: mock de useGroups retornando estados controlados.
 * Verifica: pending→skeleton, error→estado de erro+retry, vazio→empty state,
 * sucesso→seletor+tabela, troca de grupo muda a tabela exibida.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GroupsView } from "@/features/worldcup/components/GroupsView";
import type { GroupsResponse } from "@/types/worldcup";

// ---------------------------------------------------------------------------
// Mock do hook useGroups
// ---------------------------------------------------------------------------

const mockUseGroups = vi.fn();

vi.mock("@/features/worldcup/hooks/useGroups", () => ({
  useGroups: () => mockUseGroups(),
}));

// ---------------------------------------------------------------------------
// Dados de fixture
// ---------------------------------------------------------------------------

const GROUPS_RESPONSE: GroupsResponse = {
  hasLiveGroupMatch: false,
  groups: [
    {
      groupId: "A",
      standings: [
        {
          position: 1,
          team: { id: "bra", name: "Brasil", code: "BRA" },
          played: 3,
          wins: 3,
          draws: 0,
          losses: 0,
          goalsFor: 7,
          goalsAgainst: 1,
          goalDifference: 6,
          points: 9,
          qualification: "classificado",
        },
        {
          position: 2,
          team: { id: "fra", name: "França", code: "FRA" },
          played: 3,
          wins: 2,
          draws: 0,
          losses: 1,
          goalsFor: 5,
          goalsAgainst: 3,
          goalDifference: 2,
          points: 6,
          qualification: "classificado",
        },
      ],
    },
    {
      groupId: "B",
      standings: [
        {
          position: 1,
          team: { id: "arg", name: "Argentina", code: "ARG" },
          played: 3,
          wins: 3,
          draws: 0,
          losses: 0,
          goalsFor: 8,
          goalsAgainst: 2,
          goalDifference: 6,
          points: 9,
          qualification: "classificado",
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("GroupsView — estado pending", () => {
  it("T1: exibe skeleton quando isPending=true", () => {
    mockUseGroups.mockReturnValue({ isPending: true, isError: false, data: undefined, refetch: vi.fn() });
    render(<GroupsView />);
    // Skeleton tem role="status" aria-busy="true"
    const status = screen.getByRole("status");
    expect(status).toBeTruthy();
    expect(status.getAttribute("aria-busy")).toBe("true");
  });
});

describe("GroupsView — estado error", () => {
  it("T2: exibe estado de erro quando isError=true", () => {
    mockUseGroups.mockReturnValue({ isPending: false, isError: true, data: undefined, refetch: vi.fn() });
    render(<GroupsView />);
    expect(screen.getByText("Erro ao carregar informações.")).toBeTruthy();
    expect(screen.getByText("Tentar novamente")).toBeTruthy();
  });

  it("T3: clicar em 'Tentar novamente' chama refetch", async () => {
    const refetch = vi.fn();
    mockUseGroups.mockReturnValue({ isPending: false, isError: true, data: undefined, refetch });
    render(<GroupsView />);
    await userEvent.click(screen.getByText("Tentar novamente"));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe("GroupsView — estado vazio", () => {
  it("T4: exibe empty state quando groups.length === 0", () => {
    mockUseGroups.mockReturnValue({
      isPending: false,
      isError: false,
      data: { groups: [], hasLiveGroupMatch: false },
      refetch: vi.fn(),
    });
    render(<GroupsView />);
    expect(screen.getByText("Nenhuma informação disponível.")).toBeTruthy();
  });
});

describe("GroupsView — sucesso", () => {
  it("T5: exibe seletor de grupos com os ids corretos", () => {
    mockUseGroups.mockReturnValue({ isPending: false, isError: false, data: GROUPS_RESPONSE, refetch: vi.fn() });
    render(<GroupsView />);
    expect(screen.getByRole("button", { name: "Grupo A" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Grupo B" })).toBeTruthy();
  });

  it("T6: exibe tabela do grupo A por default", () => {
    mockUseGroups.mockReturnValue({ isPending: false, isError: false, data: GROUPS_RESPONSE, refetch: vi.fn() });
    render(<GroupsView />);
    // Caption da tabela do grupo A (sr-only)
    expect(screen.getByText("Classificação do Grupo A")).toBeTruthy();
    // Times do grupo A
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("França")).toBeTruthy();
    // Time do grupo B não deve aparecer
    expect(screen.queryByText("Argentina")).toBeNull();
  });

  it("T7: clicar no chip 'Grupo B' muda a tabela exibida", async () => {
    mockUseGroups.mockReturnValue({ isPending: false, isError: false, data: GROUPS_RESPONSE, refetch: vi.fn() });
    render(<GroupsView />);

    // Estado inicial: tabela A visível
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.queryByText("Argentina")).toBeNull();

    // Clicar em Grupo B
    await userEvent.click(screen.getByRole("button", { name: "Grupo B" }));

    // Agora tabela B visível
    expect(screen.getByText("Argentina")).toBeTruthy();
    // Caption mudou para Grupo B
    expect(screen.getByText("Classificação do Grupo B")).toBeTruthy();
    // Times do grupo A não aparecem
    expect(screen.queryByText("Brasil")).toBeNull();
  });

  it("T8: exibe legenda abaixo da tabela", () => {
    mockUseGroups.mockReturnValue({ isPending: false, isError: false, data: GROUPS_RESPONSE, refetch: vi.fn() });
    render(<GroupsView />);
    expect(screen.getByText(/J Jogos/)).toBeTruthy();
  });
});

describe("GroupsView — slice ausente (defensivo)", () => {
  it("T9: exibe empty state quando grupo selecionado não existe nos dados", () => {
    // Grupo com ID diferente de "A" — o useState default é "A" mas os dados têm apenas "X"
    mockUseGroups.mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        hasLiveGroupMatch: false,
        groups: [
          {
            groupId: "X",
            standings: [],
          },
        ],
      },
      refetch: vi.fn(),
    });
    render(<GroupsView />);
    // useState default é "A", mas os dados têm apenas grupo "X" → empty state
    expect(screen.getByText("Nenhuma informação disponível.")).toBeTruthy();
  });
});
