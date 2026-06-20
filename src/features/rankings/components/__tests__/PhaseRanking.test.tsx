// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const { usePoolRankingByScopeMock, useGroupRankingMock } = vi.hoisted(() => ({
  usePoolRankingByScopeMock: vi.fn(),
  useGroupRankingMock: vi.fn(),
}));

// Mocka o barrel só para os hooks (o componente os importa dele).
// StageRankingCard usa usePoolRankingByScope (fase recortada ao pool — PRD-09 Tela 03).
vi.mock("@/features/rankings", () => ({
  usePoolRankingByScope: usePoolRankingByScopeMock,
  useGroupRanking: useGroupRankingMock,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ firebaseUser: { uid: "u-me" } }),
}));

// Import por path direto p/ não cair no mock do barrel.
import { PhaseRanking } from "@/features/rankings/components/PhaseRanking";

function entry(
  uid: string,
  position: number,
  points: number,
  name: string,
  accuracy = 50,
  avatarUrl?: string,
) {
  return {
    uid,
    nickname: name.toLowerCase(),
    name,
    position,
    points,
    accuracy,
    ...(avatarUrl !== undefined ? { avatarUrl } : {}),
  };
}

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const okQuery = (data: unknown) => ({
  data,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
  // Por padrão, cada fase tem a entry do usuário logado.
  usePoolRankingByScopeMock.mockImplementation((scope: string) =>
    okQuery({
      scope,
      updatedAt: "2026-06-05T02:00:00Z",
      entries: [
        entry("u1", 1, 10, "Joao Silva"),
        entry("u-me", 2, 6, "Voce Mesmo", 75),
      ],
    }),
  );
  useGroupRankingMock.mockReturnValue(
    okQuery({
      groupId: "A",
      updatedAt: "2026-06-05T02:00:00Z",
      entries: [
        entry("u1", 1, 8, "Joao Silva"),
        entry("u-me", 2, 5, "Voce Mesmo", 60),
      ],
    }),
  );
});
afterEach(() => vi.clearAllMocks());

describe("PhaseRanking — StageRankingCard", () => {
  it("mostra #posição e acertos quando a entry do usuário existe", () => {
    renderWithClient(<PhaseRanking />);
    // 5 cards, todos com a mesma entry mockada → #2 e 6 acertos.
    expect(screen.getAllByText("#2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("6").length).toBeGreaterThanOrEqual(1);
  });

  it("mostra placeholder quando o usuário não tem entry na fase", () => {
    usePoolRankingByScopeMock.mockImplementation((scope: string) =>
      okQuery({
        scope,
        updatedAt: "2026-06-05T02:00:00Z",
        entries: [entry("u1", 1, 10, "Joao Silva")],
      }),
    );
    renderWithClient(<PhaseRanking />);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("#2")).toBeNull();
  });
});

describe("PhaseRanking — GroupRankingView", () => {
  it("aplica o destaque 'Você' à linha do usuário logado", () => {
    renderWithClient(<PhaseRanking />);
    // A aba "Por Grupo" renderiza junto (TabsPanel montado); badge "Você" presente.
    expect(screen.getByText("Você")).toBeTruthy();
    expect(screen.getByText("Voce Mesmo")).toBeTruthy();
  });

  // TASK-07: foto real na linha do grupo. O `<img>` do base-ui só monta no
  // evento `load` do browser (jsdom não dispara) → testar o caminho testável:
  // linha aceita `avatarUrl` sem quebrar e cai nas iniciais (fallback).
  it("aceita avatarUrl na linha do grupo e mantém iniciais como fallback", () => {
    useGroupRankingMock.mockReturnValue(
      okQuery({
        groupId: "A",
        updatedAt: "2026-06-05T02:00:00Z",
        entries: [
          entry("u1", 1, 8, "Joao Silva", 70, "data:image/jpeg;base64,QUJD"),
          entry("u-me", 2, 5, "Voce Mesmo", 60),
        ],
      }),
    );
    renderWithClient(<PhaseRanking />);
    expect(screen.getByText("Joao Silva")).toBeTruthy();
    // Sem foto (jsdom) → fallback de iniciais "JS".
    expect(screen.getByText("JS")).toBeTruthy();
  });
});
