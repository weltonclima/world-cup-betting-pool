// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeSync } from "@/features/profile/components/ThemeSync";
import type { ThemePreference } from "@/types";

const setTheme = vi.fn();
const themeState = { theme: "light" as string | undefined };
const authState = {
  profile: null as { themePreference?: ThemePreference } | null,
};

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: themeState.theme, setTheme }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

beforeEach(() => {
  setTheme.mockReset();
  themeState.theme = "light";
  authState.profile = null;
});

describe("ThemeSync — hidratação cross-device", () => {
  it("aplica o tema salvo no perfil quando difere do atual", () => {
    themeState.theme = "light";
    authState.profile = { themePreference: "dark" };
    render(<ThemeSync />);
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("não sincroniza quando o perfil já bate com o tema atual (sem loop)", () => {
    themeState.theme = "dark";
    authState.profile = { themePreference: "dark" };
    render(<ThemeSync />);
    expect(setTheme).not.toHaveBeenCalled();
  });

  it("não sincroniza quando não há preferência salva", () => {
    authState.profile = { themePreference: undefined };
    render(<ThemeSync />);
    expect(setTheme).not.toHaveBeenCalled();
  });

  it("não renderiza UI", () => {
    const { container } = render(<ThemeSync />);
    expect(container.firstChild).toBeNull();
  });
});
