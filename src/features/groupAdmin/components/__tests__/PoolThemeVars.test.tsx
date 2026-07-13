// @vitest-environment jsdom

/**
 * PoolThemeVars (TASK-03): sincroniza as CSS vars `--pool-primary*` no <html> a
 * partir das cores do pool (payload de usePoolRanking) e refresca o cookie.
 */

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useAuthMock, usePoolRankingMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  usePoolRankingMock: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: useAuthMock }));
vi.mock("@/features/rankings/hooks", () => ({ usePoolRanking: usePoolRankingMock }));

import { PoolThemeVars } from "@/features/groupAdmin/components/PoolThemeVars";

function setup(
  colors: { primaryColorLight?: string; primaryColorDark?: string } | null | undefined,
  isSuccess = true,
) {
  useAuthMock.mockReturnValue({ profile: { groupId: "pool-1" } });
  usePoolRankingMock.mockReturnValue({ data: colors, isSuccess });
  return render(<PoolThemeVars />);
}

beforeEach(() => {
  vi.clearAllMocks();
  document.documentElement.removeAttribute("style");
  document.cookie = "pool-primary=; path=/; max-age=0";
});

describe("PoolThemeVars", () => {
  it("aplica --pool-primary e foreground quando o pool tem cor clara", () => {
    setup({ primaryColorLight: "#ffff00" });
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--pool-primary")).toBe("#ffff00");
    // amarelo claro → foreground preto (contraste).
    expect(root.style.getPropertyValue("--pool-primary-foreground")).toBe("#000000");
  });

  it("aplica as vars dark quando o pool tem cor escura", () => {
    setup({ primaryColorDark: "#000080" });
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--pool-primary-dark")).toBe("#000080");
    expect(root.style.getPropertyValue("--pool-primary-foreground-dark")).toBe("#ffffff");
  });

  it("remove as vars quando o pool não tem cor (fallback verde)", () => {
    // Começa com uma var setada; sem cor deve limpar.
    document.documentElement.style.setProperty("--pool-primary", "#123456");
    setup(null);
    expect(document.documentElement.style.getPropertyValue("--pool-primary")).toBe("");
  });

  it("refresca o cookie pool-primary com as cores", () => {
    setup({ primaryColorLight: "#112233", primaryColorDark: "#445566" });
    expect(document.cookie).toContain("pool-primary=#112233|#445566");
  });

  it("H2: durante o loading (não resolvido) NÃO apaga a baseline do SSR", () => {
    // Simula SSR: uma var já setada. Query ainda não resolveu (isSuccess=false).
    document.documentElement.style.setProperty("--pool-primary", "#abcabc");
    setup(undefined, false);
    // A var do SSR deve permanecer intacta (sem flash verde).
    expect(document.documentElement.style.getPropertyValue("--pool-primary")).toBe("#abcabc");
  });
});
