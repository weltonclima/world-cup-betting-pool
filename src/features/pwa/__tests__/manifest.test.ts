import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Valida o manifest estático: instalabilidade depende de JSON válido,
// ícones 192/512, display standalone, start_url e scope.
const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), "public/manifest.webmanifest"), "utf-8"),
) as {
  name: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: { src: string; sizes: string; type: string; purpose?: string }[];
};

describe("manifest.webmanifest", () => {
  it("declara instalabilidade (standalone, start_url, scope)", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.name).toBeTruthy();
  });

  it("inclui ícones 192 e 512", () => {
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("inclui um ícone maskable", () => {
    const maskable = manifest.icons.filter((i) => i.purpose === "maskable");
    expect(maskable.length).toBeGreaterThanOrEqual(1);
    expect(maskable[0]!.sizes).toBe("512x512");
  });

  it("usa cores de tema em hex (oklch não é confiável em manifest)", () => {
    expect(manifest.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(manifest.background_color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe("sw.js (mínimo, sem cache de navegação)", () => {
  const sw = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf-8");

  it("não intercepta fetch (evita servir app velho)", () => {
    expect(sw).not.toMatch(/addEventListener\(\s*["']fetch["']/);
  });

  it("ativa atualização imediata (skipWaiting + clients.claim)", () => {
    expect(sw).toContain("skipWaiting");
    expect(sw).toContain("clients.claim");
  });
});
