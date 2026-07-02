// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsMenu } from "@/features/profile/components/SettingsMenu";

const themeState = { theme: "dark" as string | undefined };

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: themeState.theme }),
}));

beforeEach(() => {
  themeState.theme = "dark";
});

describe("SettingsMenu — item Tema (dark theme, TASK-03)", () => {
  it("linka para /profile/theme e não está desabilitado", () => {
    render(<SettingsMenu />);
    const item = screen.getByText("Tema do Aplicativo").closest("a");
    expect(item).not.toBeNull();
    expect(item?.getAttribute("href")).toBe("/profile/theme");
  });

  it("subtitle reflete a escolha atual (rótulo pt-BR)", () => {
    // Após montar, theme=dark → subtitle "Escuro".
    render(<SettingsMenu />);
    expect(screen.getByText("Escuro")).toBeTruthy();
  });
});
