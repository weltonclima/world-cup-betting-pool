// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useGeneralRankingMock } = vi.hoisted(() => ({
  useGeneralRankingMock: vi.fn(),
}));

// Mocka o barrel só para o hook (o componente importa useGeneralRanking dele).
vi.mock("@/features/rankings", () => ({
  useGeneralRanking: useGeneralRankingMock,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ firebaseUser: { uid: "u-me" } }),
}));

// Import por path direto p/ não cair no mock do barrel.
import { GeneralRanking } from "@/features/rankings/components/GeneralRanking";

function entry(uid: string, position: number, points: number, name: string) {
  return { uid, nickname: name.toLowerCase(), name, position, points, accuracy: 50 };
}

const entries = [
  entry("u1", 1, 98, "Joao Silva"),
  entry("u2", 2, 95, "Maria Souza"),
  entry("u3", 3, 90, "Pedro Lima"),
  entry("u-me", 4, 87, "Voce Mesmo"),
  entry("u5", 5, 82, "Lucas Pereira"),
];

beforeEach(() => {
  vi.clearAllMocks();
  useGeneralRankingMock.mockReturnValue({
    data: { scope: "geral", updatedAt: "2026-06-05T02:00:00Z", entries },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
});
afterEach(() => vi.clearAllMocks());

describe("GeneralRanking", () => {
  it("mostra pódio top-3 e a lista a partir de #4", () => {
    render(<GeneralRanking />);
    expect(screen.getByText("Joao Silva")).toBeTruthy(); // pódio 1º
    expect(screen.getByText("Maria Souza")).toBeTruthy(); // pódio 2º
    expect(screen.getByText("Lucas Pereira")).toBeTruthy(); // lista #5
  });

  it("destaca o usuário logado com badge 'Você'", () => {
    render(<GeneralRanking />);
    expect(screen.getByText("Você")).toBeTruthy();
    expect(screen.getByText("Voce Mesmo")).toBeTruthy();
  });

  it("estado vazio quando não há entries", () => {
    useGeneralRankingMock.mockReturnValue({
      data: { scope: "geral", updatedAt: "x", entries: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<GeneralRanking />);
    expect(screen.getByText("Nenhum participante encontrado")).toBeTruthy();
  });
});
