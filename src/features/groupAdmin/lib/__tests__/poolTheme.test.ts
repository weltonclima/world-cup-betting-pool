import { describe, expect, it } from "vitest";

import {
  contrastForeground,
  parsePoolThemeCookie,
  poolThemeStyleVars,
  resolveEffectivePrimary,
  serializePoolThemeCookie,
} from "@/features/groupAdmin/lib/poolTheme";

/**
 * TASK-03 (personalizacao-grupo): helpers puros do tema por pool — contraste do
 * foreground, (de)serialização do cookie `pool-primary` e resolução das cores
 * efetivas em CSS vars. Sem DOM.
 */

describe("contrastForeground — preto/branco por luminância (WCAG)", () => {
  it("cor clara (amarelo) → texto preto", () => {
    expect(contrastForeground("#ffff00")).toBe("#000000");
    expect(contrastForeground("#ffffff")).toBe("#000000");
  });

  it("cor escura (azul-marinho/preto) → texto branco", () => {
    expect(contrastForeground("#000080")).toBe("#ffffff");
    expect(contrastForeground("#000000")).toBe("#ffffff");
  });

  it("verde médio-escuro (#2f8f4e) → preto (maior razão de contraste WCAG)", () => {
    // L≈0.208: preto (ratio 5.16) supera branco (ratio 4.07) → preto é mais legível.
    expect(contrastForeground("#2f8f4e")).toBe("#000000");
  });

  it("verde médio (#22c55e) → preto (o limiar simples 0.5 daria branco, < AA)", () => {
    // Caso-chave: L≈0.41. Preto ratio ~9.2 vs branco ~2.3 → preto (evita ilegível).
    expect(contrastForeground("#22c55e")).toBe("#000000");
  });

  it("verde bem escuro (#0a3d1f) → branco", () => {
    expect(contrastForeground("#0a3d1f")).toBe("#ffffff");
  });

  it("aceita hex case-insensitive", () => {
    expect(contrastForeground("#FFFF00")).toBe("#000000");
  });
});

describe("serialize/parsePoolThemeCookie — round-trip e validação", () => {
  it("serializa ambas as cores como 'light|dark'", () => {
    expect(serializePoolThemeCookie("#112233", "#aabbcc")).toBe("#112233|#aabbcc");
  });

  it("serializa só light (dark vazio)", () => {
    expect(serializePoolThemeCookie("#112233", undefined)).toBe("#112233|");
  });

  it("serializa só dark (light vazio)", () => {
    expect(serializePoolThemeCookie(undefined, "#aabbcc")).toBe("|#aabbcc");
  });

  it("ambas ausentes → null (não seta cookie)", () => {
    expect(serializePoolThemeCookie(undefined, undefined)).toBeNull();
  });

  it("cor inválida é ignorada na serialização", () => {
    expect(serializePoolThemeCookie("nope", "#aabbcc")).toBe("|#aabbcc");
    expect(serializePoolThemeCookie("nope", "bad")).toBeNull();
  });

  it("faz round-trip via parse", () => {
    expect(parsePoolThemeCookie("#112233|#aabbcc")).toEqual({
      light: "#112233",
      dark: "#aabbcc",
    });
  });

  it("parse com um lado vazio", () => {
    expect(parsePoolThemeCookie("#112233|")).toEqual({ light: "#112233", dark: undefined });
    expect(parsePoolThemeCookie("|#aabbcc")).toEqual({ light: undefined, dark: "#aabbcc" });
  });

  it("parse rejeita hex inválido (retorna undefined por lado)", () => {
    expect(parsePoolThemeCookie("bad|#aabbcc")).toEqual({
      light: undefined,
      dark: "#aabbcc",
    });
  });

  it("parse de string malformada/vazia → null", () => {
    expect(parsePoolThemeCookie("")).toBeNull();
    expect(parsePoolThemeCookie("garbage")).toBeNull();
    expect(parsePoolThemeCookie("|")).toBeNull();
  });
});

describe("resolveEffectivePrimary — cores efetivas + foreground por contraste", () => {
  it("ambas ausentes → null", () => {
    expect(resolveEffectivePrimary({})).toBeNull();
  });

  it("só light → resolve light + foreground; dark undefined", () => {
    const r = resolveEffectivePrimary({ primaryColorLight: "#ffff00" });
    expect(r).toEqual({
      light: "#ffff00",
      lightFg: "#000000",
      dark: undefined,
      darkFg: undefined,
    });
  });

  it("só dark → resolve dark + foreground; light undefined", () => {
    const r = resolveEffectivePrimary({ primaryColorDark: "#000080" });
    expect(r).toEqual({
      light: undefined,
      lightFg: undefined,
      dark: "#000080",
      darkFg: "#ffffff",
    });
  });

  it("ambas → resolve as duas com foregrounds corretos", () => {
    expect(
      resolveEffectivePrimary({ primaryColorLight: "#ffffff", primaryColorDark: "#000000" }),
    ).toEqual({
      light: "#ffffff",
      lightFg: "#000000",
      dark: "#000000",
      darkFg: "#ffffff",
    });
  });

  it("hex inválido é descartado (tratado como ausente)", () => {
    expect(resolveEffectivePrimary({ primaryColorLight: "bad" })).toBeNull();
  });
});

describe("poolThemeStyleVars — mapeia para as CSS vars do pool", () => {
  it("ambas as cores → 4 vars", () => {
    const vars = poolThemeStyleVars({
      light: "#112233",
      lightFg: "#ffffff",
      dark: "#aabbcc",
      darkFg: "#000000",
    });
    expect(vars).toEqual({
      "--pool-primary": "#112233",
      "--pool-primary-foreground": "#ffffff",
      "--pool-primary-dark": "#aabbcc",
      "--pool-primary-foreground-dark": "#000000",
    });
  });

  it("só light → só as vars de light", () => {
    const vars = poolThemeStyleVars({
      light: "#112233",
      lightFg: "#ffffff",
      dark: undefined,
      darkFg: undefined,
    });
    expect(vars).toEqual({
      "--pool-primary": "#112233",
      "--pool-primary-foreground": "#ffffff",
    });
  });

  it("resolução nula → objeto vazio", () => {
    expect(poolThemeStyleVars(null)).toEqual({});
  });
});
