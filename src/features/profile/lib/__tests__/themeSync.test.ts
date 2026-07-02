import { describe, expect, it } from "vitest";

import {
  shouldSyncTheme,
  themeLabel,
  THEME_OPTIONS,
} from "@/features/profile/lib/themeSync";
import type { ThemePreference } from "@/types";

// TASK-03 — lógica pura de sincronização de tema (dark theme).
// Testada antes da implementação (TDD): a regra anti-loop é o núcleo de risco.

describe("shouldSyncTheme (hidratação cross-device, anti-loop)", () => {
  it("retorna o valor do perfil quando difere do tema atual", () => {
    expect(shouldSyncTheme("dark", "light")).toBe("dark");
    expect(shouldSyncTheme("system", "dark")).toBe("system");
    expect(shouldSyncTheme("light", "system")).toBe("light");
  });

  it("retorna null quando o perfil já bate com o tema atual (sem loop)", () => {
    expect(shouldSyncTheme("dark", "dark")).toBeNull();
    expect(shouldSyncTheme("light", "light")).toBeNull();
    expect(shouldSyncTheme("system", "system")).toBeNull();
  });

  it("retorna null quando o perfil não tem preferência salva", () => {
    expect(shouldSyncTheme(undefined, "light")).toBeNull();
    expect(shouldSyncTheme(undefined, "dark")).toBeNull();
  });

  it("retorna o valor do perfil quando o tema atual ainda é indeterminado", () => {
    // Pré-mount: next-themes pode expor theme=undefined; se há preferência
    // salva, ela deve ser aplicada.
    expect(shouldSyncTheme("dark", undefined)).toBe("dark");
    expect(shouldSyncTheme("system", undefined)).toBe("system");
  });

  it("é idempotente: reaplicar o resultado não gera nova sincronização", () => {
    const pref: ThemePreference = "dark";
    const first = shouldSyncTheme(pref, "light");
    expect(first).toBe("dark");
    // Após aplicar (theme vira "dark"), a próxima checagem não sincroniza.
    expect(shouldSyncTheme(pref, first ?? "light")).toBeNull();
  });
});

describe("THEME_OPTIONS", () => {
  it("expõe exatamente as 3 opções na ordem light, dark, system", () => {
    expect(THEME_OPTIONS.map((o) => o.value)).toEqual([
      "light",
      "dark",
      "system",
    ]);
  });

  it("cada opção tem rótulo e descrição em pt-BR não vazios", () => {
    for (const opt of THEME_OPTIONS) {
      expect(opt.label.length).toBeGreaterThan(0);
      expect(opt.description.length).toBeGreaterThan(0);
    }
  });

  it("rótulos correspondem aos valores esperados", () => {
    const byValue = Object.fromEntries(
      THEME_OPTIONS.map((o) => [o.value, o.label]),
    );
    expect(byValue.light).toBe("Claro");
    expect(byValue.dark).toBe("Escuro");
    expect(byValue.system).toBe("Automático");
  });
});

describe("themeLabel", () => {
  it("mapeia cada valor para o rótulo pt-BR", () => {
    expect(themeLabel("light")).toBe("Claro");
    expect(themeLabel("dark")).toBe("Escuro");
    expect(themeLabel("system")).toBe("Automático");
  });
});
