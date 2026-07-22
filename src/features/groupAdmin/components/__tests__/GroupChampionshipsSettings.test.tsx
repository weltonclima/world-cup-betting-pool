// @vitest-environment jsdom

/**
 * Testes de `GroupChampionshipsSettings` (multi-championship TASK-08).
 *
 * Usa o domínio REAL (`@/lib/poolChampionships` + catálogo curado) — só os hooks
 * de dados e o `Switch` são mockados. Cobre: estado inicial (legacy → só Copa),
 * agrupamento por tipo, toggle→dirty→PATCH parcial, troca de modo de ranking,
 * piso (0 habilitados), teto (switches extras desabilitados em 10), gate de save
 * sem mudança, loading/erro do catálogo, ressync no refetch e acessibilidade do
 * segmented control.
 */

import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  useGroupSettingsMock,
  useUpdateGroupSettingsMock,
  useChampionshipsCatalogMock,
} = vi.hoisted(() => ({
  useGroupSettingsMock: vi.fn(),
  useUpdateGroupSettingsMock: vi.fn(),
  useChampionshipsCatalogMock: vi.fn(),
}));

vi.mock("@/features/groupAdmin/hooks", () => ({
  useGroupSettings: useGroupSettingsMock,
  useUpdateGroupSettings: useUpdateGroupSettingsMock,
  useChampionshipsCatalog: useChampionshipsCatalogMock,
}));

// Switch determinístico (Radix precisa de ambiente real p/ onCheckedChange).
vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    disabled,
    id,
  }: {
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
    disabled?: boolean;
    id?: string;
  }) => (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      id={id}
      onClick={() => onCheckedChange(!checked)}
    />
  ),
}));

import { GroupChampionshipsSettings } from "@/features/groupAdmin/components/GroupChampionshipsSettings";
import type { ChampionshipPublic } from "@/types/championships";
import type { Pool } from "@/types/pools";

// Ids REAIS do catálogo curado (validação de domínio usa o catálogo real).
const CATALOG: ChampionshipPublic[] = [
  { id: "fifa.world", name: "Copa do Mundo FIFA", season: "2026", type: "cup", status: "archived" },
  { id: "conmebol.america-2026", name: "Copa América", season: "2026", type: "cup", status: "upcoming" },
  { id: "uefa.euro-2026", name: "Eurocopa", season: "2026", type: "cup", status: "upcoming" },
  { id: "uefa.nations-2026", name: "Liga das Nações da UEFA", season: "2026", type: "cup", status: "upcoming" },
  { id: "fifa.cwc-2026", name: "Mundial de Clubes FIFA", season: "2026", type: "cup", status: "upcoming" },
  { id: "bra.1-2026", name: "Brasileirão Série A", season: "2026", type: "league", status: "upcoming" },
  { id: "eng.1-2026", name: "Premier League", season: "2026", type: "league", status: "upcoming" },
  { id: "esp.1-2026", name: "LaLiga", season: "2026", type: "league", status: "upcoming" },
  { id: "ita.1-2026", name: "Serie A (Itália)", season: "2026", type: "league", status: "upcoming" },
  { id: "ger.1-2026", name: "Bundesliga", season: "2026", type: "league", status: "upcoming" },
  { id: "fra.1-2026", name: "Ligue 1", season: "2026", type: "league", status: "upcoming" },
  { id: "por.1-2026", name: "Primeira Liga (Portugal)", season: "2026", type: "league", status: "upcoming" },
];

function makePool(overrides?: Partial<Pool>): Pool {
  return {
    id: "pool-1",
    name: "Bolão Teste",
    slug: "bolao-teste",
    status: "active",
    adminId: "uid-admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function setup(opts?: {
  pool?: Pool;
  isPending?: boolean;
  catalog?: Partial<{
    data: ChampionshipPublic[] | undefined;
    isLoading: boolean;
    isError: boolean;
  }>;
  poolState?: Partial<{ isLoading: boolean; isError: boolean }>;
}) {
  const mutateMock = vi.fn();
  const poolRefetch = vi.fn();
  const catalogRefetch = vi.fn();

  useGroupSettingsMock.mockReturnValue({
    data: opts?.pool ?? makePool(),
    isLoading: opts?.poolState?.isLoading ?? false,
    isError: opts?.poolState?.isError ?? false,
    refetch: poolRefetch,
  });
  useUpdateGroupSettingsMock.mockReturnValue({
    mutate: mutateMock,
    isPending: opts?.isPending ?? false,
    isError: false,
    error: null,
  });
  useChampionshipsCatalogMock.mockReturnValue({
    data: opts?.catalog?.data ?? CATALOG,
    isLoading: opts?.catalog?.isLoading ?? false,
    isError: opts?.catalog?.isError ?? false,
    refetch: catalogRefetch,
  });

  const result = render(<GroupChampionshipsSettings />);
  return { mutateMock, poolRefetch, catalogRefetch, ...result };
}

function champSwitch(nameRe: RegExp): HTMLButtonElement {
  return screen.getByRole("switch", { name: nameRe }) as HTMLButtonElement;
}

function saveButton(): HTMLButtonElement {
  return screen.getByRole("button", {
    name: /salvar campeonatos/i,
  }) as HTMLButtonElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("estado inicial", () => {
  it("pool legado (sem campos) → só Copa habilitada, contador 1 de 10", () => {
    setup({ pool: makePool() });
    expect(champSwitch(/Copa do Mundo FIFA/i).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(champSwitch(/Brasileirão/i).getAttribute("aria-checked")).toBe(
      "false",
    );
    expect(screen.getByRole("status").textContent).toMatch(/1 de 10/);
  });

  it("modo de ranking inicial reflete o pool (por-campeonato)", () => {
    setup({ pool: makePool({ rankingMode: "por-campeonato" }) });
    expect(
      screen.getByRole("radio", { name: /Por campeonato/i }).getAttribute(
        "aria-checked",
      ),
    ).toBe("true");
    expect(
      screen.getByRole("radio", { name: /^Geral$/i }).getAttribute(
        "aria-checked",
      ),
    ).toBe("false");
  });
});

describe("agrupamento e badges", () => {
  it("agrupa por tipo (Copas / Ligas) e marca campeonato encerrado", () => {
    setup({ pool: makePool() });
    expect(screen.getByText(/Copas e torneios/i)).toBeTruthy();
    expect(screen.getByText(/Ligas nacionais/i)).toBeTruthy();
    // Copa do Mundo (archived) → badge "Encerrado".
    expect(screen.getByText(/Encerrado/i)).toBeTruthy();
  });
});

describe("toggle → dirty → PATCH parcial", () => {
  it("habilitar um campeonato monta PATCH só com enabledChampionships (ordem do catálogo)", () => {
    const { mutateMock } = setup({ pool: makePool() });
    fireEvent.click(champSwitch(/Brasileirão/i));
    fireEvent.click(saveButton());
    expect(mutateMock).toHaveBeenCalledWith(
      { enabledChampionships: ["fifa.world", "bra.1-2026"] },
      expect.any(Object),
    );
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it("trocar modo de ranking monta PATCH só com rankingMode", () => {
    const { mutateMock } = setup({ pool: makePool() });
    fireEvent.click(screen.getByRole("radio", { name: /Por campeonato/i }));
    fireEvent.click(saveButton());
    expect(mutateMock).toHaveBeenCalledWith(
      { rankingMode: "por-campeonato" },
      expect.any(Object),
    );
  });

  it("sem mudança → Save desabilitado e mutate não chamado", () => {
    const { mutateMock } = setup({ pool: makePool() });
    expect(saveButton().disabled).toBe(true);
    fireEvent.click(saveButton());
    expect(mutateMock).not.toHaveBeenCalled();
  });
});

describe("piso e teto", () => {
  it("piso: desabilitar o último campeonato mostra erro e trava o Save", () => {
    setup({ pool: makePool({ enabledChampionships: ["bra.1-2026"] }) });
    fireEvent.click(champSwitch(/Brasileirão/i));
    expect(screen.getByRole("alert").textContent).toMatch(
      /ao menos um campeonato/i,
    );
    expect(saveButton().disabled).toBe(true);
  });

  it("teto: com 10 habilitados, switch de um 11º fica desabilitado", () => {
    const tenEnabled = [
      "fifa.world",
      "conmebol.america-2026",
      "uefa.euro-2026",
      "uefa.nations-2026",
      "fifa.cwc-2026",
      "bra.1-2026",
      "eng.1-2026",
      "esp.1-2026",
      "ita.1-2026",
      "ger.1-2026",
    ];
    setup({ pool: makePool({ enabledChampionships: tenEnabled }) });
    expect(screen.getByRole("status").textContent).toMatch(/10 de 10/);
    // Ligue 1 (fora dos 10) → desabilitado; um já habilitado continua ativo.
    expect(champSwitch(/Ligue 1/i).disabled).toBe(true);
    expect(champSwitch(/Brasileirão/i).disabled).toBe(false);
  });
});

describe("estados de carga/erro do catálogo", () => {
  it("catálogo carregando → não renderiza linhas de campeonato", () => {
    setup({ catalog: { data: undefined, isLoading: true } });
    expect(screen.queryByRole("switch", { name: /Brasileirão/i })).toBeNull();
  });

  it("catálogo com erro → mostra retry e chama refetch", () => {
    const { catalogRefetch } = setup({
      catalog: { data: undefined, isError: true },
    });
    const retry = screen.getByRole("button", { name: /tentar novamente/i });
    fireEvent.click(retry);
    expect(catalogRefetch).toHaveBeenCalledTimes(1);
  });
});

describe("ressync ao refetch do pool", () => {
  it("reflete novo pool após rerender (habilitados mudam)", () => {
    const { rerender } = setup({ pool: makePool() });
    expect(champSwitch(/Brasileirão/i).getAttribute("aria-checked")).toBe(
      "false",
    );

    useGroupSettingsMock.mockReturnValue({
      data: makePool({ enabledChampionships: ["bra.1-2026"] }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    rerender(<GroupChampionshipsSettings />);

    expect(champSwitch(/Brasileirão/i).getAttribute("aria-checked")).toBe(
      "true",
    );
  });
});

describe("acessibilidade do segmented control", () => {
  it("expõe radiogroup com 2 radios e roving tabindex", () => {
    setup({ pool: makePool() });
    const group = screen.getByRole("radiogroup");
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(2);
    // "geral" selecionado (default) → tabindex 0; outro → -1.
    const selected = radios.find(
      (r) => r.getAttribute("aria-checked") === "true",
    );
    const unselected = radios.find(
      (r) => r.getAttribute("aria-checked") === "false",
    );
    expect(selected?.getAttribute("tabindex")).toBe("0");
    expect(unselected?.getAttribute("tabindex")).toBe("-1");
  });

  it("seta muda a seleção do modo de ranking", () => {
    setup({ pool: makePool() });
    const geral = screen.getByRole("radio", { name: /^Geral$/i });
    fireEvent.keyDown(geral, { key: "ArrowRight" });
    expect(
      screen.getByRole("radio", { name: /Por campeonato/i }).getAttribute(
        "aria-checked",
      ),
    ).toBe("true");
  });

  it("Save mostra aria-busy durante isPending", () => {
    setup({
      pool: makePool({ enabledChampionships: ["bra.1-2026"] }),
      isPending: true,
    });
    expect(saveButton().getAttribute("aria-busy")).toBe("true");
  });
});
