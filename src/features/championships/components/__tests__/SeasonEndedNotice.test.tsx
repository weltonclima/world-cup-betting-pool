// @vitest-environment jsdom
/**
 * Testes do SeasonEndedNotice (bugfix "temporada encerrada").
 *
 * Contrato: sempre oferece o atalho "Ver Histórico"; o atalho "Habilitar novo
 * campeonato" é gateado por papel (admin do grupo) por default, com override
 * explícito via `showEnableCta`. `role="status"` p/ leitor de tela.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: useAuthMock }));

import { SeasonEndedNotice } from "../SeasonEndedNotice";

function setRole(role: string | null) {
  useAuthMock.mockReturnValue({ profile: role ? { role } : {} });
}

beforeEach(() => {
  vi.clearAllMocks();
  setRole(null);
});
afterEach(() => vi.restoreAllMocks());

describe("SeasonEndedNotice", () => {
  it("sempre mostra o atalho 'Ver Histórico' apontando para /rankings/history", () => {
    render(<SeasonEndedNotice />);
    const link = screen.getByText("Ver Histórico").closest("a");
    expect(link?.getAttribute("href")).toBe("/rankings/history");
  });

  it("expõe role='status' para leitores de tela", () => {
    render(<SeasonEndedNotice />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("participante comum NÃO vê 'Habilitar novo campeonato' (auto por papel)", () => {
    setRole("member");
    render(<SeasonEndedNotice />);
    expect(screen.queryByText("Habilitar novo campeonato")).toBeNull();
  });

  it("admin do grupo VÊ 'Habilitar novo campeonato' (auto por papel)", () => {
    setRole("group_admin");
    render(<SeasonEndedNotice />);
    const link = screen.getByText("Habilitar novo campeonato").closest("a");
    expect(link?.getAttribute("href")).toBe("/group/settings");
  });

  it("super_admin também vê o atalho de reativação", () => {
    setRole("super_admin");
    render(<SeasonEndedNotice />);
    expect(screen.getByText("Habilitar novo campeonato")).toBeTruthy();
  });

  it("override showEnableCta=false esconde o atalho mesmo para admin", () => {
    setRole("group_admin");
    render(<SeasonEndedNotice showEnableCta={false} />);
    expect(screen.queryByText("Habilitar novo campeonato")).toBeNull();
  });
});
