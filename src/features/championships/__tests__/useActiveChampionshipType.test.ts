// @vitest-environment jsdom

/**
 * Testes do reader de TIPO do campeonato ativo (multi-championship TASK-10).
 *
 * `useActiveChampionshipType` / `useIsCupActive` resolvem o `type` do campeonato
 * ATIVO a partir do catálogo estático (`getChampionship(id).type`), com fallback
 * `"cup"` (compat legado: id desconhecido nunca esconde as telas de copa).
 *
 * Estratégia: mock só de `./useActiveChampionship` (controla o id ativo); catálogo
 * real (ids `fifa.world` = cup, `bra.1-2026` = league).
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { activeChampMock } = vi.hoisted(() => ({ activeChampMock: vi.fn() }));

vi.mock("../useActiveChampionship", () => ({
  useActiveChampionship: () => activeChampMock(),
}));

import {
  useActiveChampionshipType,
  useIsCupActive,
} from "../useActiveChampionshipType";

function setActive(id: string): void {
  activeChampMock.mockReturnValue({ activeChampionshipId: id });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useActiveChampionshipType", () => {
  it("id de copa (fifa.world) → 'cup'", () => {
    setActive("fifa.world");
    const { result } = renderHook(() => useActiveChampionshipType());
    expect(result.current).toBe("cup");
  });

  it("id de liga (bra.1-2026) → 'league'", () => {
    setActive("bra.1-2026");
    const { result } = renderHook(() => useActiveChampionshipType());
    expect(result.current).toBe("league");
  });

  it("id fora do catálogo → fallback 'cup' (compat legado)", () => {
    setActive("des.conhecido");
    const { result } = renderHook(() => useActiveChampionshipType());
    expect(result.current).toBe("cup");
  });
});

describe("useIsCupActive", () => {
  it("copa → true", () => {
    setActive("fifa.world");
    const { result } = renderHook(() => useIsCupActive());
    expect(result.current).toBe(true);
  });

  it("liga → false", () => {
    setActive("bra.1-2026");
    const { result } = renderHook(() => useIsCupActive());
    expect(result.current).toBe(false);
  });

  it("id desconhecido → true (fallback cup)", () => {
    setActive("nada.aqui");
    const { result } = renderHook(() => useIsCupActive());
    expect(result.current).toBe(true);
  });
});
