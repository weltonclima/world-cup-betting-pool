// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { usePoolRankingMock, useAuthMock } = vi.hoisted(() => ({
  usePoolRankingMock: vi.fn(),
  useAuthMock: vi.fn(),
}));

// Mocka o barrel só para o hook (o componente importa usePoolRanking dele).
vi.mock("@/features/rankings", () => ({
  usePoolRanking: usePoolRankingMock,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: useAuthMock,
}));
// RecalcGroupRankingButton importa o serviço (barrel → firebase client). Mocka só a
// função usada para o teste não carregar o env do Firebase.
vi.mock("@/services", () => ({
  triggerGroupRankingRecalc: vi.fn(),
}));

// Import por path direto p/ não cair no mock do barrel.
import { GeneralRanking } from "@/features/rankings/components/GeneralRanking";

// Contagens default A=4 V=3 E=2 (placar exato / vencedor / empate). Determinístico
// → as assertions de A/V/E batem em todas as entries criadas pelo helper.
function entry(
  uid: string,
  position: number,
  points: number,
  name: string,
  avatarUrl?: string,
) {
  return {
    uid,
    nickname: name.toLowerCase(),
    name,
    position,
    points,
    accuracy: 50,
    correct: 4,
    winner: 3,
    draw: 2,
    ...(avatarUrl !== undefined ? { avatarUrl } : {}),
  };
}

/** Frase a11y da decomposição A/V/E (igual ao hitLabel do componente). */
const aveLabel = (a: number, v: number, e: number) =>
  `${a} placares exatos, ${v} acertos de vencedor, ${e} acertos de empate`;

const entries = [
  entry("u1", 1, 98, "Joao Silva"),
  entry("u2", 2, 95, "Maria Souza"),
  entry("u3", 3, 90, "Pedro Lima"),
  entry("u-me", 4, 87, "Voce Mesmo"),
  entry("u5", 5, 82, "Lucas Pereira"),
];

function okRanking() {
  return {
    data: { scope: "geral", updatedAt: "2026-06-05T02:00:00Z", entries },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Por padrão: usuário COM pool.
  useAuthMock.mockReturnValue({ firebaseUser: { uid: "u-me" }, profile: { groupId: "pool-1" } });
  usePoolRankingMock.mockReturnValue(okRanking());
});
afterEach(() => vi.clearAllMocks());

describe("GeneralRanking", () => {
  it("mostra pódio top-3 e a lista a partir de #4", () => {
    render(<GeneralRanking />);
    // Nome de exibição compacto: primeiro nome + inicial do sobrenome.
    expect(screen.getByText("Joao S.")).toBeTruthy(); // pódio 1º
    expect(screen.getByText("Maria S.")).toBeTruthy(); // pódio 2º
    expect(screen.getByText("Lucas P.")).toBeTruthy(); // lista #5
  });

  it("destaca o usuário logado com badge 'Você'", () => {
    render(<GeneralRanking />);
    expect(screen.getByText("Você")).toBeTruthy();
    expect(screen.getByText("Voce M.")).toBeTruthy();
  });

  it("abrevia sobrenome (primeiro nome + iniciais) ignorando conectores", () => {
    const named = [
      entry("u1", 1, 98, "Welton da Silva Lima"), // conectores "da" caem
      entry("u2", 2, 95, "Maria Eduarda Santos"), // pódio multi-sobrenome
      entry("u3", 3, 90, "Ana"), // nome único: inalterado
      entry("u-me", 4, 87, "Joao de Souza"), // lista: "de" cai
    ];
    usePoolRankingMock.mockReturnValue({
      data: { scope: "geral", updatedAt: "x", entries: named },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<GeneralRanking />);
    expect(screen.getByText("Welton S. L.")).toBeTruthy();
    expect(screen.getByText("Maria E. S.")).toBeTruthy();
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("Joao S.")).toBeTruthy();
    // a11y: aria-label preserva o nome completo.
    expect(
      screen.getByLabelText(
        `1º lugar: Welton da Silva Lima, 98 pontos, ${aveLabel(4, 3, 2)}`,
      ),
    ).toBeTruthy();
  });

  it("estado vazio quando não há entries", () => {
    usePoolRankingMock.mockReturnValue({
      data: { scope: "geral", updatedAt: "x", entries: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<GeneralRanking />);
    expect(screen.getByText("Nenhum participante encontrado")).toBeTruthy();
  });

  it("usuário SEM pool vê estado dedicado e não chama o ranking", () => {
    useAuthMock.mockReturnValue({ firebaseUser: { uid: "u-me" }, profile: { groupId: undefined } });
    render(<GeneralRanking />);
    expect(screen.getByText("Você ainda não está em um grupo")).toBeTruthy();
    // hook é chamado (regras de hooks) mas desabilitado via enabled:false — aqui
    // garantimos só que a tela não renderiza lista/pódio.
    expect(screen.queryByText("Joao Silva")).toBeNull();
  });
});

// ── TASK-06: redesign do pódio (posição visível + foto/fallback) ────────────
// Nota: o `<img>` do base-ui só monta no status "loaded" (load event do
// browser); jsdom não dispara load → a foto cai sempre no fallback aqui. A
// renderização real da imagem é coberta pelo /ui-review. Estes testes cobrem a
// lógica testável: indicador de posição, aproveitamento, aria-label e fallback.
describe("RankingPodium (TASK-06)", () => {
  it("mostra o indicador de posição 1º/2º/3º nos três cards do pódio", () => {
    render(<GeneralRanking />);
    expect(screen.getByText("1º")).toBeTruthy();
    expect(screen.getByText("2º")).toBeTruthy();
    expect(screen.getByText("3º")).toBeTruthy();
  });

  it("expõe posição + nome + pontos + decomposição A/V/E no aria-label do card", () => {
    render(<GeneralRanking />);
    expect(
      screen.getByLabelText(
        `1º lugar: Joao Silva, 98 pontos, ${aveLabel(4, 3, 2)}`,
      ),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        `2º lugar: Maria Souza, 95 pontos, ${aveLabel(4, 3, 2)}`,
      ),
    ).toBeTruthy();
  });

  it("renderiza as iniciais (fallback) quando o usuário não tem foto", () => {
    render(<GeneralRanking />);
    // Joao Silva → "JS" no fallback do avatar do pódio.
    expect(screen.getByText("JS")).toBeTruthy();
  });

  it("aceita avatarUrl nas entries sem quebrar o pódio", () => {
    const withPhotos = [
      entry("u1", 1, 98, "Joao Silva", "data:image/jpeg;base64,QUJD"),
      entry("u2", 2, 95, "Maria Souza", "data:image/jpeg;base64,QUJD"),
      entry("u3", 3, 90, "Pedro Lima"),
    ];
    usePoolRankingMock.mockReturnValue({
      data: { scope: "geral", updatedAt: "x", entries: withPhotos },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<GeneralRanking />);
    // pódio renderiza posição e nome (compacto) normalmente, com ou sem foto.
    expect(screen.getByText("1º")).toBeTruthy();
    expect(screen.getByText("Joao S.")).toBeTruthy();
    expect(screen.getByText("Pedro L.")).toBeTruthy();
  });

  it("substitui o aproveitamento (%) pela decomposição A/V/E", () => {
    render(<GeneralRanking />);
    // % saiu da tela (pódio + linhas).
    expect(screen.queryByText("50%")).toBeNull();
    // role=img com a frase A/V/E só nas LINHAS (#4+); no pódio é decorativo
    // (aria-hidden) pois o aria-label do card pai já inclui a frase.
    const rows = entries.length - 3; // 3 vão pro pódio
    expect(screen.getAllByLabelText(aveLabel(4, 3, 2)).length).toBe(rows);
    // Letras A/V/E visíveis em TODAS as entries (pódio + linhas).
    expect(screen.getAllByText("A").length).toBe(entries.length);
    expect(screen.getAllByText("V").length).toBe(entries.length);
    expect(screen.getAllByText("E").length).toBe(entries.length);
  });

  it("cai em A0 V0 E0 quando a entry não traz a decomposição (retrocompat)", () => {
    // Entry no formato antigo: sem correct/winner/draw.
    const legacy = [
      { uid: "u1", nickname: "ana", name: "Ana", position: 1, points: 10 },
    ];
    usePoolRankingMock.mockReturnValue({
      data: { scope: "geral", updatedAt: "x", entries: legacy },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<GeneralRanking />);
    expect(screen.getByLabelText(`1º lugar: Ana, 10 pontos, ${aveLabel(0, 0, 0)}`)).toBeTruthy();
  });
});

// ── TASK-07: foto real na linha da lista (#4+) ──────────────────────────────
// Mesmo limite do jsdom (o `<img>` do base-ui não monta sem evento `load`):
// validar que a linha aceita `avatarUrl` e mantém as iniciais como fallback.
describe("RankingRow lista (TASK-07)", () => {
  it("aceita avatarUrl na linha #4+ e mantém iniciais como fallback", () => {
    const withPhotos = [
      entry("u1", 1, 98, "Joao Silva"),
      entry("u2", 2, 95, "Maria Souza"),
      entry("u3", 3, 90, "Pedro Lima"),
      entry("u5", 5, 82, "Lucas Pereira", "data:image/jpeg;base64,QUJD"),
    ];
    usePoolRankingMock.mockReturnValue({
      data: { scope: "geral", updatedAt: "x", entries: withPhotos },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<GeneralRanking />);
    expect(screen.getByText("Lucas P.")).toBeTruthy();
    // Sem foto (jsdom) → fallback de iniciais "LP".
    expect(screen.getByText("LP")).toBeTruthy();
  });
});
