// @vitest-environment jsdom
/**
 * Testes dos componentes da tela Lista de Palpites (TASK-08).
 *
 * Cobre:
 * - PredictionFilters: 5 chips, single-select, aria-pressed, localStorage, SSR-safe
 * - PredictionListCard: bandeiras, nomes, placar, badge com texto
 * - PredictionList: loading/skeletons, empty total, empty filtrado, error+retry, itens
 * - Filtro em memória: aplicar filtro por status reduz itens corretamente
 *
 * Padrão: espelha PredictionComponents.test.tsx (TASK-07)
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

// ── mocks declarados antes dos imports do módulo (hoisting) ──────────────────

vi.mock("@/firebase", () => ({
  firebaseAuth: {},
  firestore: {},
}));

vi.mock("@/features/predictions/hooks/usePredictionsList");

// ── imports pós-mock ──────────────────────────────────────────────────────────

import type { PredictionListItem } from "../../hooks/usePredictionsList";
import type { PredictionDisplayStatus } from "@/features/predictions/lib";
import {
  PREDICTION_DISPLAY_STATUS_LABEL,
  PREDICTION_DISPLAY_STATUS_COLOR,
} from "@/features/predictions/lib";

import { PredictionFilters, readStoredFilter } from "../PredictionFilters";
import type { FilterChip } from "../PredictionFilters";
import { PredictionListCard } from "../PredictionListCard";
import { PredictionList } from "../PredictionList";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeItem(
  overrides: Partial<PredictionListItem> = {},
): PredictionListItem {
  return {
    matchId: "match-001",
    kickoffAt: "2026-06-14T16:00:00Z",
    homeTeam: { name: "Brasil", flagUrl: "https://example.com/br.png" },
    awayTeam: { name: "França", flagUrl: "https://example.com/fr.png" },
    prediction: { homeScore: 2, awayScore: 1 },
    displayStatus: "pendente" as PredictionDisplayStatus,
    isManual: false,
    ...overrides,
  };
}

// ── Helpers de localStorage mockado ──────────────────────────────────────────

function setupLocalStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((k) => delete store[k]);
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
}

// ===========================================================================
// PredictionFilters
// ===========================================================================

describe("PredictionFilters — chips renderizados", () => {
  it("T1: renderiza os 7 chips de filtro", () => {
    render(<PredictionFilters activeFilter="todos" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Todos" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pendentes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Acertos" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Vencedor" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Empates" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Erros" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bloqueados" })).toBeTruthy();
  });

  it("T1b: chip 'Vencedor' chama onChange com 'acertou_vencedor'", () => {
    const onChange = vi.fn();
    render(<PredictionFilters activeFilter="todos" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Vencedor" }));
    expect(onChange).toHaveBeenCalledWith("acertou_vencedor");
  });

  it("T1c: chip 'Empates' chama onChange com 'acertou_empate'", () => {
    const onChange = vi.fn();
    render(<PredictionFilters activeFilter="todos" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Empates" }));
    expect(onChange).toHaveBeenCalledWith("acertou_empate");
  });

  it("T2: wrapper tem role=group com aria-label='Filtrar palpites'", () => {
    render(<PredictionFilters activeFilter="todos" onChange={vi.fn()} />);
    expect(screen.getByRole("group", { name: "Filtrar palpites" })).toBeTruthy();
  });
});

describe("PredictionFilters — single-select e aria-pressed", () => {
  it("T3: chip ativo tem aria-pressed=true", () => {
    render(<PredictionFilters activeFilter="pendente" onChange={vi.fn()} />);
    const btn = screen.getByRole("button", { name: "Pendentes" }) as HTMLButtonElement;
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("T4: chips inativos têm aria-pressed=false", () => {
    render(<PredictionFilters activeFilter="todos" onChange={vi.fn()} />);
    const pendente = screen.getByRole("button", { name: "Pendentes" }) as HTMLButtonElement;
    const acertos = screen.getByRole("button", { name: "Acertos" }) as HTMLButtonElement;
    const erros = screen.getByRole("button", { name: "Erros" }) as HTMLButtonElement;
    const bloqueados = screen.getByRole("button", { name: "Bloqueados" }) as HTMLButtonElement;
    expect(pendente.getAttribute("aria-pressed")).toBe("false");
    expect(acertos.getAttribute("aria-pressed")).toBe("false");
    expect(erros.getAttribute("aria-pressed")).toBe("false");
    expect(bloqueados.getAttribute("aria-pressed")).toBe("false");
  });

  it("T4b: chip 'Empates' tem aria-pressed=true quando activeFilter='acertou_empate'", () => {
    render(<PredictionFilters activeFilter="acertou_empate" onChange={vi.fn()} />);
    const empates = screen.getByRole("button", { name: "Empates" }) as HTMLButtonElement;
    expect(empates.getAttribute("aria-pressed")).toBe("true");
  });

  it("T4c: chip 'Empates' tem aria-pressed=false quando outro filtro está ativo", () => {
    render(<PredictionFilters activeFilter="todos" onChange={vi.fn()} />);
    const empates = screen.getByRole("button", { name: "Empates" }) as HTMLButtonElement;
    expect(empates.getAttribute("aria-pressed")).toBe("false");
  });

  it("T5: clicar em chip inativo chama onChange com o valor correto", () => {
    const onChange = vi.fn();
    render(<PredictionFilters activeFilter="todos" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Acertos" }));
    expect(onChange).toHaveBeenCalledWith("acertou");
  });

  it("T6: clicar em chip 'Pendentes' chama onChange com 'pendente'", () => {
    const onChange = vi.fn();
    render(<PredictionFilters activeFilter="todos" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Pendentes" }));
    expect(onChange).toHaveBeenCalledWith("pendente");
  });

  it("T7: clicar em chip 'Erros' chama onChange com 'errou'", () => {
    const onChange = vi.fn();
    render(<PredictionFilters activeFilter="todos" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Erros" }));
    expect(onChange).toHaveBeenCalledWith("errou");
  });

  it("T8: clicar em chip 'Bloqueados' chama onChange com 'bloqueado'", () => {
    const onChange = vi.fn();
    render(<PredictionFilters activeFilter="todos" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Bloqueados" }));
    expect(onChange).toHaveBeenCalledWith("bloqueado");
  });

  it("T9: chip ativo 'Todos' tem aria-pressed=true ao renderizar com activeFilter='todos'", () => {
    render(<PredictionFilters activeFilter="todos" onChange={vi.fn()} />);
    const todos = screen.getByRole("button", { name: "Todos" }) as HTMLButtonElement;
    expect(todos.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("PredictionFilters — persistência em localStorage", () => {
  let localStorageMock: ReturnType<typeof setupLocalStorageMock>;

  beforeEach(() => {
    localStorageMock = setupLocalStorageMock();
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("T10: clicar em chip chama localStorage.setItem com a key 'predictions_filter'", () => {
    const onChange = vi.fn();
    render(<PredictionFilters activeFilter="todos" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Pendentes" }));
    expect(localStorageMock.setItem).toHaveBeenCalledWith("predictions_filter", "pendente");
  });

  it("T10b: clicar em 'Empates' persiste 'acertou_empate' no localStorage", () => {
    const onChange = vi.fn();
    render(<PredictionFilters activeFilter="todos" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Empates" }));
    expect(localStorageMock.setItem).toHaveBeenCalledWith("predictions_filter", "acertou_empate");
  });

  it("T11: readStoredFilter retorna 'todos' quando localStorage não tem o valor", () => {
    localStorageMock.getItem.mockReturnValue(null);
    const result = readStoredFilter();
    expect(result).toBe("todos");
  });

  it("T12: readStoredFilter retorna valor salvo quando válido", () => {
    localStorageMock.getItem.mockReturnValue("acertou");
    const result = readStoredFilter();
    expect(result).toBe("acertou");
  });

  it("T13: readStoredFilter retorna 'todos' para valor inválido no storage", () => {
    localStorageMock.getItem.mockReturnValue("valor_invalido");
    const result = readStoredFilter();
    expect(result).toBe("todos");
  });

  it("T14: readStoredFilter retorna 'bloqueado' quando salvo", () => {
    localStorageMock.getItem.mockReturnValue("bloqueado");
    const result = readStoredFilter();
    expect(result).toBe("bloqueado");
  });

  it("T15: readStoredFilter retorna 'errou' quando salvo", () => {
    localStorageMock.getItem.mockReturnValue("errou");
    const result = readStoredFilter();
    expect(result).toBe("errou");
  });

  it("T15b: readStoredFilter retorna 'acertou_vencedor' quando salvo", () => {
    localStorageMock.getItem.mockReturnValue("acertou_vencedor");
    const result = readStoredFilter();
    expect(result).toBe("acertou_vencedor");
  });

  it("T15c: readStoredFilter retorna 'acertou_empate' quando salvo", () => {
    localStorageMock.getItem.mockReturnValue("acertou_empate");
    const result = readStoredFilter();
    expect(result).toBe("acertou_empate");
  });
});

describe("PredictionFilters — SSR safety", () => {
  it("T16: readStoredFilter não lança quando localStorage está indisponível (SSR)", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

    Object.defineProperty(globalThis, "localStorage", {
      get() {
        throw new Error("localStorage is not defined");
      },
      configurable: true,
    });

    expect(() => readStoredFilter()).not.toThrow();
    const result = readStoredFilter();
    expect(result).toBe("todos");

    if (originalDescriptor) {
      Object.defineProperty(globalThis, "localStorage", originalDescriptor);
    }
  });

  it("T17: readStoredFilter retorna 'todos' quando localStorage lança exceção", () => {
    const localStorageMockThrows = setupLocalStorageMock();
    localStorageMockThrows.getItem.mockImplementation(() => {
      throw new Error("Storage access denied");
    });

    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMockThrows,
      writable: true,
      configurable: true,
    });

    const result = readStoredFilter();
    expect(result).toBe("todos");
  });
});

// ===========================================================================
// PredictionListCard
// ===========================================================================

describe("PredictionListCard — renderização básica", () => {
  it("T18: exibe nome do time mandante", () => {
    render(<PredictionListCard item={makeItem()} />);
    expect(screen.getAllByText("Brasil").length).toBeGreaterThan(0);
  });

  it("T19: exibe nome do time visitante", () => {
    render(<PredictionListCard item={makeItem()} />);
    expect(screen.getAllByText("França").length).toBeGreaterThan(0);
  });

  it("T20: exibe bandeira do time mandante como img", () => {
    render(<PredictionListCard item={makeItem()} />);
    const imgs = document.querySelectorAll("img");
    const brasilImg = Array.from(imgs).find((img) => img.alt === "Brasil");
    expect(brasilImg).toBeTruthy();
    expect(brasilImg?.getAttribute("src")).toBe("https://example.com/br.png");
  });

  it("T21: exibe bandeira do time visitante como img", () => {
    render(<PredictionListCard item={makeItem()} />);
    const imgs = document.querySelectorAll("img");
    const francaImg = Array.from(imgs).find((img) => img.alt === "França");
    expect(francaImg).toBeTruthy();
    expect(francaImg?.getAttribute("src")).toBe("https://example.com/fr.png");
  });

  it("T22: exibe inicial/iniciais quando flagUrl é undefined (fallback aria-label)", () => {
    render(
      <PredictionListCard
        item={makeItem({
          homeTeam: { name: "Brasil", flagUrl: undefined },
          awayTeam: { name: "França", flagUrl: undefined },
        })}
      />,
    );
    // Fallback: span com aria-label contendo o nome do time (sem bandeira)
    const brasilFallback = document.querySelector('span[aria-label="Brasil"]');
    const francaFallback = document.querySelector('span[aria-label="França"]');
    expect(brasilFallback).toBeTruthy();
    expect(francaFallback).toBeTruthy();
  });
});

describe("PredictionListCard — placar palpitado", () => {
  it("T23: exibe texto 'Meu palpite:'", () => {
    render(<PredictionListCard item={makeItem()} />);
    expect(screen.getByText(/Meu palpite:/)).toBeTruthy();
  });

  it("T24: exibe homeScore palpitado em negrito", () => {
    render(<PredictionListCard item={makeItem({ prediction: { homeScore: 3, awayScore: 1 } })} />);
    // Deve haver um elemento com o texto '3' (homeScore)
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
  });

  it("T25: exibe awayScore palpitado em negrito", () => {
    render(<PredictionListCard item={makeItem({ prediction: { homeScore: 2, awayScore: 0 } })} />);
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
  });

  it("T26: article tem aria-label com nomes dos times", () => {
    render(<PredictionListCard item={makeItem()} />);
    const article = screen.getByRole("article", { name: "Brasil vs França" });
    expect(article).toBeTruthy();
  });
});

describe("PredictionListCard — badge de status", () => {
  const statuses: PredictionDisplayStatus[] = [
    "pendente",
    "acertou",
    "acertou_vencedor",
    "acertou_empate",
    "errou",
    "bloqueado",
  ];

  statuses.forEach((status) => {
    it(`T27/${status}: badge exibe o texto correto para status '${status}'`, () => {
      render(<PredictionListCard item={makeItem({ displayStatus: status })} />);
      const expectedLabel = PREDICTION_DISPLAY_STATUS_LABEL[status];
      expect(screen.getByText(expectedLabel)).toBeTruthy();
    });
  });

  it("T28: badge 'Pendente' tem texto (não apenas cor)", () => {
    render(<PredictionListCard item={makeItem({ displayStatus: "pendente" })} />);
    expect(screen.getByText("Pendente")).toBeTruthy();
  });

  it("T29: badge 'Acertou' tem texto (não apenas cor)", () => {
    render(<PredictionListCard item={makeItem({ displayStatus: "acertou" })} />);
    expect(screen.getByText("Acertou")).toBeTruthy();
  });

  it("T30: badge 'Errou' tem texto (não apenas cor)", () => {
    render(<PredictionListCard item={makeItem({ displayStatus: "errou" })} />);
    expect(screen.getByText("Errou")).toBeTruthy();
  });

  it("T31: badge 'Bloqueado' tem texto (não apenas cor)", () => {
    render(<PredictionListCard item={makeItem({ displayStatus: "bloqueado" })} />);
    expect(screen.getByText("Bloqueado")).toBeTruthy();
  });

  it("T31b: badge 'Acertou o vencedor' tem texto (3º estado, +5)", () => {
    render(<PredictionListCard item={makeItem({ displayStatus: "acertou_vencedor" })} />);
    expect(screen.getByText("Acertou o vencedor")).toBeTruthy();
  });

  it("T31c: label e cor existem para 'acertou_vencedor' (exhaustiveness)", () => {
    expect(PREDICTION_DISPLAY_STATUS_LABEL["acertou_vencedor"]).toBe("Acertou o vencedor");
    expect(PREDICTION_DISPLAY_STATUS_COLOR["acertou_vencedor"]).toBeTruthy();
  });

  it("T31d: badge 'Acertou o empate' tem texto (empate parcial, +5)", () => {
    render(<PredictionListCard item={makeItem({ displayStatus: "acertou_empate" })} />);
    expect(screen.getByText("Acertou o empate")).toBeTruthy();
  });

  it("T31e: label e cor existem para 'acertou_empate', cor distinta de 'acertou_vencedor'", () => {
    expect(PREDICTION_DISPLAY_STATUS_LABEL["acertou_empate"]).toBe("Acertou o empate");
    expect(PREDICTION_DISPLAY_STATUS_COLOR["acertou_empate"]).toBeTruthy();
    expect(PREDICTION_DISPLAY_STATUS_COLOR["acertou_empate"]).not.toBe(
      PREDICTION_DISPLAY_STATUS_COLOR["acertou_vencedor"],
    );
  });

  it("T32: badge aplica classe de cor de PREDICTION_DISPLAY_STATUS_COLOR", () => {
    render(<PredictionListCard item={makeItem({ displayStatus: "acertou" })} />);
    const badge = screen.getByText("Acertou").closest("span");
    expect(badge).toBeTruthy();
    // Verifica que a classe de cor está presente
    const colorClass = PREDICTION_DISPLAY_STATUS_COLOR["acertou"];
    expect(badge?.className).toContain(colorClass.split(" ")[0]);
  });
});

describe("PredictionListCard — badge origem manual (PRD-12 TASK-05)", () => {
  it("T-M1: exibe 'Lançado pelo admin' quando isManual=true", () => {
    render(<PredictionListCard item={makeItem({ isManual: true })} />);
    expect(screen.getByText("Lançado pelo admin")).toBeTruthy();
  });

  it("T-M2: NÃO exibe badge de origem quando isManual=false", () => {
    render(<PredictionListCard item={makeItem({ isManual: false })} />);
    expect(screen.queryByText("Lançado pelo admin")).toBeNull();
  });

  it("T-M3: badge de origem coexiste com o badge de status", () => {
    render(
      <PredictionListCard item={makeItem({ isManual: true, displayStatus: "acertou" })} />,
    );
    expect(screen.getByText("Lançado pelo admin")).toBeTruthy();
    expect(screen.getByText("Acertou")).toBeTruthy();
  });
});

// ===========================================================================
// PredictionList
// ===========================================================================

describe("PredictionList — estado loading", () => {
  it("T33: exibe skeletons quando isLoading=true", () => {
    render(
      <PredictionList items={[]} isLoading={true} isError={false} onRetry={vi.fn()} />,
    );
    const skeletons = screen.getAllByRole("status");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("T34: skeletons têm aria-busy=true", () => {
    render(
      <PredictionList items={[]} isLoading={true} isError={false} onRetry={vi.fn()} />,
    );
    const skeletons = screen.getAllByRole("status");
    skeletons.forEach((skeleton) => {
      if (skeleton.getAttribute("aria-label") === "Carregando palpite") {
        expect(skeleton.getAttribute("aria-busy")).toBe("true");
      }
    });
  });

  it("T35: NÃO exibe 'Nenhum palpite ainda' quando está carregando", () => {
    render(
      <PredictionList items={[]} isLoading={true} isError={false} onRetry={vi.fn()} />,
    );
    expect(screen.queryByText("Nenhum palpite ainda")).toBeNull();
  });

  it("T36: NÃO exibe botão 'Tentar novamente' quando está carregando", () => {
    render(
      <PredictionList items={[]} isLoading={true} isError={false} onRetry={vi.fn()} />,
    );
    expect(screen.queryByText("Tentar novamente")).toBeNull();
  });
});

describe("PredictionList — estado error", () => {
  it("T37: exibe botão 'Tentar novamente' quando isError=true", () => {
    render(
      <PredictionList items={[]} isLoading={false} isError={true} onRetry={vi.fn()} />,
    );
    expect(screen.getByText("Tentar novamente")).toBeTruthy();
  });

  it("T38: clicar em 'Tentar novamente' chama onRetry", () => {
    const onRetry = vi.fn();
    render(
      <PredictionList items={[]} isLoading={false} isError={true} onRetry={onRetry} />,
    );
    fireEvent.click(screen.getByText("Tentar novamente"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("T39: NÃO exibe 'Nenhum palpite ainda' quando isError=true", () => {
    render(
      <PredictionList items={[]} isLoading={false} isError={true} onRetry={vi.fn()} />,
    );
    expect(screen.queryByText("Nenhum palpite ainda")).toBeNull();
  });

  it("T40: NÃO exibe skeleton quando isError=true", () => {
    render(
      <PredictionList items={[]} isLoading={false} isError={true} onRetry={vi.fn()} />,
    );
    const skeletonsWithAriaLabel = screen.queryAllByRole("status", {
      name: "Carregando palpite",
    });
    expect(skeletonsWithAriaLabel).toHaveLength(0);
  });
});

describe("PredictionList — estado vazio total", () => {
  it("T41: exibe 'Nenhum palpite ainda' quando items=[] sem filtro ativo", () => {
    render(
      <PredictionList
        items={[]}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        hasActiveFilter={false}
      />,
    );
    expect(screen.getByText("Nenhum palpite ainda")).toBeTruthy();
  });

  it("T42: exibe mensagem descritiva no empty state total", () => {
    render(
      <PredictionList
        items={[]}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        hasActiveFilter={false}
      />,
    );
    expect(
      screen.getByText("Registre seus palpites nos jogos para acompanhá-los aqui."),
    ).toBeTruthy();
  });
});

describe("PredictionList — estado vazio filtrado", () => {
  it("T43: exibe 'Nenhum palpite com este status' quando hasActiveFilter=true", () => {
    render(
      <PredictionList
        items={[]}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        hasActiveFilter={true}
      />,
    );
    expect(screen.getByText("Nenhum palpite com este status")).toBeTruthy();
  });

  it("T44: exibe mensagem secundária de filtro vazio", () => {
    render(
      <PredictionList
        items={[]}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        hasActiveFilter={true}
      />,
    );
    expect(screen.getByText("Experimente outro filtro.")).toBeTruthy();
  });
});

describe("PredictionList — renderização de itens", () => {
  it("T45: renderiza cards quando há itens", () => {
    const items = [
      makeItem({ matchId: "match-001" }),
      makeItem({
        matchId: "match-002",
        homeTeam: { name: "Argentina", flagUrl: undefined },
        awayTeam: { name: "Alemanha", flagUrl: undefined },
      }),
    ];
    render(
      <PredictionList items={items} isLoading={false} isError={false} onRetry={vi.fn()} />,
    );
    expect(screen.getAllByText("Brasil").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Argentina").length).toBeGreaterThan(0);
  });

  it("T46: renderiza article para cada item", () => {
    const items = [makeItem({ matchId: "match-001" }), makeItem({ matchId: "match-002" })];
    render(
      <PredictionList items={items} isLoading={false} isError={false} onRetry={vi.fn()} />,
    );
    expect(screen.getAllByRole("article").length).toBe(2);
  });

  it("T47: NÃO exibe 'Nenhum palpite ainda' quando há itens", () => {
    const items = [makeItem()];
    render(
      <PredictionList items={items} isLoading={false} isError={false} onRetry={vi.fn()} />,
    );
    expect(screen.queryByText("Nenhum palpite ainda")).toBeNull();
  });

  it("T48: NÃO exibe skeleton quando há itens", () => {
    const items = [makeItem()];
    render(
      <PredictionList items={items} isLoading={false} isError={false} onRetry={vi.fn()} />,
    );
    expect(screen.queryAllByRole("status", { name: "Carregando palpite" })).toHaveLength(0);
  });
});

// ===========================================================================
// Filtro em memória — integração
// ===========================================================================

describe("Filtro em memória — integração PredictionFilters + lógica de filtro", () => {
  // Simula a lógica de filtro da página (filtro puro em memória)
  function applyFilter(items: PredictionListItem[], filter: FilterChip): PredictionListItem[] {
    if (filter === "todos") return items;
    return items.filter((item) => item.displayStatus === filter);
  }

  const allItems: PredictionListItem[] = [
    makeItem({ matchId: "m1", displayStatus: "pendente" }),
    makeItem({ matchId: "m2", displayStatus: "acertou" }),
    makeItem({ matchId: "m3", displayStatus: "errou" }),
    makeItem({ matchId: "m4", displayStatus: "bloqueado" }),
    makeItem({ matchId: "m5", displayStatus: "pendente" }),
    makeItem({ matchId: "m6", displayStatus: "acertou_vencedor" }),
  ];

  it("T49: filtro 'todos' retorna todos os itens", () => {
    expect(applyFilter(allItems, "todos")).toHaveLength(6);
  });

  it("T49b: filtro 'acertou_vencedor' retorna apenas o item do 3º estado", () => {
    const filtered = applyFilter(allItems, "acertou_vencedor");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.matchId).toBe("m6");
  });

  it("T49c: filtro 'acertou_empate' retorna zero itens quando nenhum tem esse status", () => {
    const filtered = applyFilter(allItems, "acertou_empate");
    expect(filtered).toHaveLength(0);
  });

  it("T49d: filtro 'acertou_empate' retorna apenas itens com esse status quando existem", () => {
    const itemsComEmpate: PredictionListItem[] = [
      ...allItems,
      makeItem({ matchId: "m7", displayStatus: "acertou_empate" }),
      makeItem({ matchId: "m8", displayStatus: "acertou_empate" }),
    ];
    const filtered = applyFilter(itemsComEmpate, "acertou_empate");
    expect(filtered).toHaveLength(2);
    filtered.forEach((item) => expect(item.displayStatus).toBe("acertou_empate"));
  });

  it("T50: filtro 'pendente' retorna apenas itens com displayStatus='pendente'", () => {
    const filtered = applyFilter(allItems, "pendente");
    expect(filtered).toHaveLength(2);
    filtered.forEach((item) => expect(item.displayStatus).toBe("pendente"));
  });

  it("T51: filtro 'acertou' retorna apenas itens com displayStatus='acertou'", () => {
    const filtered = applyFilter(allItems, "acertou");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.matchId).toBe("m2");
  });

  it("T52: filtro 'errou' retorna apenas itens com displayStatus='errou'", () => {
    const filtered = applyFilter(allItems, "errou");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.matchId).toBe("m3");
  });

  it("T53: filtro 'bloqueado' retorna apenas itens com displayStatus='bloqueado'", () => {
    const filtered = applyFilter(allItems, "bloqueado");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.matchId).toBe("m4");
  });

  it("T54: filtro por status reduz quantidade de itens corretamente", () => {
    const todosCount = applyFilter(allItems, "todos").length;
    const pendenteCount = applyFilter(allItems, "pendente").length;
    expect(pendenteCount).toBeLessThan(todosCount);
  });

  it("T55: filtro em chip refletido no aria-pressed do componente", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PredictionFilters activeFilter="todos" onChange={onChange} />,
    );

    // Simula mudança de filtro para 'acertou'
    rerender(<PredictionFilters activeFilter="acertou" onChange={onChange} />);

    const acertos = screen.getByRole("button", { name: "Acertos" }) as HTMLButtonElement;
    const todos = screen.getByRole("button", { name: "Todos" }) as HTMLButtonElement;

    expect(acertos.getAttribute("aria-pressed")).toBe("true");
    expect(todos.getAttribute("aria-pressed")).toBe("false");
  });

  it("T56: lista renderiza apenas itens filtrados corretamente", () => {
    const filteredItems = applyFilter(allItems, "acertou");
    render(
      <PredictionList
        items={filteredItems}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        hasActiveFilter={true}
      />,
    );
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });
});

// ===========================================================================
// Helpers exportados — sem any
// ===========================================================================

describe("Tipos — confirma ausência de any", () => {
  it("T57: FilterChip é um tipo union correto", () => {
    const validFilters: FilterChip[] = [
      "todos",
      "pendente",
      "acertou",
      "acertou_vencedor",
      "acertou_empate",
      "errou",
      "bloqueado",
    ];
    expect(validFilters).toHaveLength(7);
  });

  it("T58: makeItem retorna PredictionListItem corretamente tipado", () => {
    const item = makeItem();
    // Verificação estrutural de tipo — sem 'as any'
    const typed: PredictionListItem = item;
    expect(typed.matchId).toBe("match-001");
  });
});

// Exportação de tipo necessária para o import de UseQueryResult
export type {};
