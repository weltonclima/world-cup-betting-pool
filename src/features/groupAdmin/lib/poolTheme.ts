/**
 * Helpers puros do TEMA POR POOL (personalizacao-grupo TASK-03).
 *
 * Sem DOM, sem I/O — testáveis em isolamento. Cobrem: contraste do foreground
 * (preto/branco por luminância WCAG), (de)serialização do cookie `pool-primary`
 * e a resolução das cores efetivas em CSS vars (`--pool-primary*`).
 */

import { HEX_COLOR_REGEX } from "@/schemas/pools";

/** Nome do cookie (não-httpOnly) que carrega as cores do pool p/ o SSR sem flash. */
export const POOL_THEME_COOKIE = "pool-primary";

/** Valida um hex `#RRGGBB`; retorna `undefined` se inválido/ausente. */
function normalizeHex(hex: string | undefined | null): string | undefined {
  if (typeof hex !== "string") return undefined;
  return HEX_COLOR_REGEX.test(hex) ? hex : undefined;
}

/** Componentes RGB (0–255) de um hex `#RRGGBB` já validado. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

/** Luminância relativa (WCAG 2.x) de um hex `#RRGGBB` já validado. */
function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Escolhe preto ou branco como cor de texto sobre `hex`, MAXIMIZANDO a razão de
 * contraste WCAG (não um limiar simples de luminância — que erra em cores médias,
 * ex.: um verde 0.41 daria branco com contraste < AA). Compara o contrast ratio de
 * branco (L=1) vs. preto (L=0) sobre a cor e retorna o de maior contraste. Empate
 * → preto. Puro. Hex inválido → branco (fallback seguro).
 */
export function contrastForeground(hex: string): "#000000" | "#ffffff" {
  const valid = normalizeHex(hex);
  if (!valid) return "#ffffff";
  const bg = relativeLuminance(valid);
  const whiteContrast = (1 + 0.05) / (bg + 0.05); // branco sobre a cor
  const blackContrast = (bg + 0.05) / (0 + 0.05); // preto sobre a cor
  return blackContrast >= whiteContrast ? "#000000" : "#ffffff";
}

/**
 * Serializa as cores num valor de cookie `"<light>|<dark>"`. Cores inválidas são
 * omitidas (lado vazio). Ambas ausentes/inválidas → `null` (não setar cookie).
 */
export function serializePoolThemeCookie(
  light: string | undefined,
  dark: string | undefined,
): string | null {
  const l = normalizeHex(light) ?? "";
  const d = normalizeHex(dark) ?? "";
  if (l === "" && d === "") return null;
  return `${l}|${d}`;
}

/**
 * Faz o parse do cookie `"<light>|<dark>"`. Cada lado é validado
 * independentemente (inválido → `undefined`). Retorna `null` quando não há
 * NENHUMA cor válida (string vazia, malformada ou os dois lados inválidos).
 */
export function parsePoolThemeCookie(
  raw: string | undefined | null,
): { light: string | undefined; dark: string | undefined } | null {
  if (typeof raw !== "string" || !raw.includes("|")) return null;
  const [rawLight, rawDark] = raw.split("|");
  const light = normalizeHex(rawLight);
  const dark = normalizeHex(rawDark);
  if (light === undefined && dark === undefined) return null;
  return { light, dark };
}

/** Cores efetivas do pool + foregrounds derivados por contraste. */
export interface EffectivePrimary {
  light: string | undefined;
  lightFg: string | undefined;
  dark: string | undefined;
  darkFg: string | undefined;
}

/**
 * Resolve as cores efetivas a partir dos campos do pool, derivando o foreground
 * de cada uma por contraste. Cores inválidas/ausentes viram `undefined`. Retorna
 * `null` quando NENHUMA cor válida existe (usa o padrão do app).
 */
export function resolveEffectivePrimary(pool: {
  primaryColorLight?: string | undefined;
  primaryColorDark?: string | undefined;
}): EffectivePrimary | null {
  const light = normalizeHex(pool.primaryColorLight);
  const dark = normalizeHex(pool.primaryColorDark);
  if (light === undefined && dark === undefined) return null;
  return {
    light,
    lightFg: light ? contrastForeground(light) : undefined,
    dark,
    darkFg: dark ? contrastForeground(dark) : undefined,
  };
}

/**
 * Monta o objeto de CSS vars (`--pool-primary*`) para o `style` inline (server e
 * client). Omite o lado ausente. Resolução `null` → objeto vazio (fallback verde).
 */
export function poolThemeStyleVars(
  resolved: EffectivePrimary | null,
): Record<string, string> {
  if (!resolved) return {};
  const vars: Record<string, string> = {};
  if (resolved.light) {
    vars["--pool-primary"] = resolved.light;
    if (resolved.lightFg) vars["--pool-primary-foreground"] = resolved.lightFg;
  }
  if (resolved.dark) {
    vars["--pool-primary-dark"] = resolved.dark;
    if (resolved.darkFg) vars["--pool-primary-foreground-dark"] = resolved.darkFg;
  }
  return vars;
}
