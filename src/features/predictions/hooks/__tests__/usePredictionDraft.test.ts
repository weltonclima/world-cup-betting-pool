// @vitest-environment jsdom
/**
 * Testes de usePredictionDraft (TASK-05 — spec §8.2).
 *
 * 10 cenários:
 * T1: getDraft sem prévia → undefined
 * T2: setDraft + getDraft → estado React atualizado síncronamente
 * T3: setDraft + avança timer 300ms → localStorage persiste
 * T4: setDraft duas vezes em < 300ms → apenas 1 escrita em localStorage
 * T5: clearDraft → getDraft undefined + localStorage null
 * T6: allDrafts reflete estado atual
 * T7: localStorage corrompido → inicia com {} sem exception
 * T8: SSR (window undefined) → getDraft undefined, setDraft não lança
 * T9: Trocar uid → draft não vaza entre usuários
 * T10: Unmount → timer cancelado (sem erro de atualização de estado desmontado)
 */

import { renderHook, act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/firebase", () => ({
  firebaseAuth: {},
  firestore: {},
}));

import { usePredictionDraft } from "../usePredictionDraft";

// ── helpers ───────────────────────────────────────────────────────────────────

const UID_A = "user-aaa";
const UID_B = "user-bbb";

function draftKey(uid: string) {
  return `palpites-rascunho-${uid}`;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

// ── testes ────────────────────────────────────────────────────────────────────

describe("usePredictionDraft — getDraft", () => {
  it("T1: getDraft sem prévia → undefined", () => {
    const { result } = renderHook(() => usePredictionDraft(UID_A));
    expect(result.current.getDraft("m-01")).toBeUndefined();
  });
});

describe("usePredictionDraft — setDraft (estado React síncrono)", () => {
  it("T2: setDraft → getDraft retorna valor imediatamente (estado React)", () => {
    const { result } = renderHook(() => usePredictionDraft(UID_A));

    act(() => {
      result.current.setDraft("m-01", { homeScore: 2, awayScore: 1 });
    });

    expect(result.current.getDraft("m-01")).toEqual({ homeScore: 2, awayScore: 1 });
  });

  it("T3: setDraft + avança 300ms → localStorage persiste", () => {
    const { result } = renderHook(() => usePredictionDraft(UID_A));

    act(() => {
      result.current.setDraft("m-01", { homeScore: 3, awayScore: 0 });
    });

    // Antes do timer → localStorage ainda não escrito
    expect(localStorage.getItem(draftKey(UID_A))).toBeNull();

    // Avança o timer do debounce
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const stored = localStorage.getItem(draftKey(UID_A));
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!) as Record<string, { homeScore: number; awayScore: number }>;
    expect(parsed["m-01"]).toEqual({ homeScore: 3, awayScore: 0 });
  });

  it("T4: setDraft duas vezes em < 300ms → apenas 1 escrita em localStorage", () => {
    const localStorageSetItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const { result } = renderHook(() => usePredictionDraft(UID_A));

    act(() => {
      result.current.setDraft("m-01", { homeScore: 1, awayScore: 0 });
    });
    // Avança menos que o debounce
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.setDraft("m-01", { homeScore: 2, awayScore: 0 });
    });
    // Avança o tempo restante para disparar
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Deve ter escrito apenas 1 vez (o debounce cancelou a primeira)
    const writeCalls = localStorageSetItemSpy.mock.calls.filter(
      ([key]) => key === draftKey(UID_A),
    );
    expect(writeCalls).toHaveLength(1);

    // O valor final deve ser o segundo setDraft
    const stored = localStorage.getItem(draftKey(UID_A));
    const parsed = JSON.parse(stored!) as Record<string, { homeScore: number; awayScore: number }>;
    expect(parsed["m-01"]).toEqual({ homeScore: 2, awayScore: 0 });

    localStorageSetItemSpy.mockRestore();
  });
});

describe("usePredictionDraft — clearDraft", () => {
  it("T5: clearDraft → getDraft undefined + localStorage null", () => {
    const { result } = renderHook(() => usePredictionDraft(UID_A));

    act(() => {
      result.current.setDraft("m-01", { homeScore: 2, awayScore: 1 });
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Confirma que estava persistido
    expect(localStorage.getItem(draftKey(UID_A))).not.toBeNull();

    act(() => {
      result.current.clearDraft();
    });

    expect(result.current.getDraft("m-01")).toBeUndefined();
    expect(localStorage.getItem(draftKey(UID_A))).toBeNull();
  });
});

describe("usePredictionDraft — allDrafts", () => {
  it("T6: allDrafts reflete estado atual", () => {
    const { result } = renderHook(() => usePredictionDraft(UID_A));

    act(() => {
      result.current.setDraft("m-01", { homeScore: 2, awayScore: 1 });
      result.current.setDraft("m-02", { homeScore: 0, awayScore: 0 });
    });

    expect(result.current.allDrafts).toEqual({
      "m-01": { homeScore: 2, awayScore: 1 },
      "m-02": { homeScore: 0, awayScore: 0 },
    });
  });
});

describe("usePredictionDraft — localStorage corrompido", () => {
  it("T7: JSON inválido em localStorage → inicia com {} sem exception", () => {
    localStorage.setItem(draftKey(UID_A), "INVALID_JSON{{{{");

    // Garantir que o renderHook não lança
    expect(() => {
      renderHook(() => usePredictionDraft(UID_A));
    }).not.toThrow();

    // Re-renderizar para verificar estado após hidratação
    const { result } = renderHook(() => usePredictionDraft(UID_A));

    // Após hidratação com useEffect, o estado deve ser {}
    act(() => {
      vi.advanceTimersByTime(0);
    });

    // getDraft retorna undefined (draft vazio)
    expect(result.current.getDraft("m-01")).toBeUndefined();
    expect(result.current.allDrafts).toEqual({});
  });
});

describe("usePredictionDraft — SSR safety", () => {
  it("T8: setDraft com window.localStorage indisponível não lança exceção", () => {
    // Simular ambiente onde localStorage não existe (ambiente restrito/SSR-like).
    const originalLocalStorage = global.localStorage;
    // @ts-expect-error — simular ausência de localStorage
    delete global.localStorage;

    try {
      const { result } = renderHook(() => usePredictionDraft(UID_A));

      // getDraft retorna undefined (draft vazio pois não há localStorage para ler)
      expect(result.current.getDraft("m-01")).toBeUndefined();

      // setDraft não lança mesmo sem localStorage
      expect(() => {
        act(() => {
          result.current.setDraft("m-01", { homeScore: 1, awayScore: 0 });
        });
        // Avança o timer para tentar a escrita
        act(() => {
          vi.advanceTimersByTime(300);
        });
      }).not.toThrow();
    } finally {
      global.localStorage = originalLocalStorage;
    }
  });
});

describe("usePredictionDraft — isolamento por uid", () => {
  it("T9: trocar uid → draft não vaza entre usuários", () => {
    // Usuário A
    const hookA = renderHook(() => usePredictionDraft(UID_A));
    act(() => {
      hookA.result.current.setDraft("m-01", { homeScore: 3, awayScore: 2 });
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Usuário B não deve ver o draft de A
    const hookB = renderHook(() => usePredictionDraft(UID_B));
    expect(hookB.result.current.getDraft("m-01")).toBeUndefined();
    expect(hookB.result.current.allDrafts).toEqual({});

    // Storage de A não afeta B
    expect(localStorage.getItem(draftKey(UID_B))).toBeNull();
  });
});

describe("usePredictionDraft — ciclo de vida", () => {
  it("T10: unmount → timer cancelado sem erro de estado desmontado", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result, unmount } = renderHook(() => usePredictionDraft(UID_A));

    act(() => {
      result.current.setDraft("m-01", { homeScore: 1, awayScore: 0 });
    });

    // Desmontar antes do timer disparar
    unmount();

    // Avançar o timer após unmount
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Nenhum erro de "Cannot update state on unmounted component"
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining("unmounted"),
    );

    consoleError.mockRestore();
  });
});
