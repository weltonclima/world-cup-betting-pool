import { describe, expect, it } from "vitest";

import {
  AvatarImageError,
  clampCropRect,
  clampRectCropRect,
  dataUrlByteSize,
  displayRectToNatural,
  squareCrop,
  validateImageInput,
  validateLogoInput,
  MAX_INPUT_BYTES,
  MAX_POOL_LOGO_BASE64_LENGTH,
} from "@/features/profile/lib/imageToDataUrl";

describe("validateImageInput", () => {
  it("aceita imagem dentro do limite", () => {
    expect(() =>
      validateImageInput({ type: "image/png", size: 1000 }),
    ).not.toThrow();
  });

  it("rejeita não-imagem", () => {
    expect(() =>
      validateImageInput({ type: "application/pdf", size: 1000 }),
    ).toThrow(AvatarImageError);
  });

  it("rejeita arquivo acima do teto de entrada", () => {
    expect(() =>
      validateImageInput({ type: "image/jpeg", size: MAX_INPUT_BYTES + 1 }),
    ).toThrow(AvatarImageError);
  });
});

describe("dataUrlByteSize", () => {
  it("estima bytes de data URL base64", () => {
    // "AAAA" base64 = 3 bytes.
    expect(dataUrlByteSize("data:image/jpeg;base64,AAAA")).toBe(3);
  });

  it("desconta padding", () => {
    // "AA==" = 1 byte.
    expect(dataUrlByteSize("data:image/jpeg;base64,AA==")).toBe(1);
  });

  it("vazio = 0", () => {
    expect(dataUrlByteSize("data:image/jpeg;base64,")).toBe(0);
  });
});

describe("squareCrop", () => {
  it("recorta quadrado central em paisagem", () => {
    expect(squareCrop(1024, 512, 256)).toEqual({
      sx: 256,
      sy: 0,
      side: 512,
      out: 256,
    });
  });

  it("recorta quadrado central em retrato", () => {
    expect(squareCrop(512, 1024, 256)).toEqual({
      sx: 0,
      sy: 256,
      side: 512,
      out: 256,
    });
  });

  it("não amplia imagem menor que o limite (out = lado do recorte)", () => {
    expect(squareCrop(100, 80, 256)).toEqual({
      sx: 10,
      sy: 0,
      side: 80,
      out: 80,
    });
  });
});

describe("clampCropRect", () => {
  it("mantém recorte já dentro dos limites", () => {
    expect(clampCropRect({ x: 10, y: 10, size: 50 }, 200, 200)).toEqual({
      x: 10,
      y: 10,
      size: 50,
    });
  });

  it("zera coordenadas negativas", () => {
    expect(clampCropRect({ x: -5, y: -10, size: 50 }, 200, 200)).toEqual({
      x: 0,
      y: 0,
      size: 50,
    });
  });

  it("reposiciona recorte que ultrapassa a borda direita/inferior", () => {
    // x + size = 230 > 200 → x = 150 (200 - 50). Idem para y.
    expect(clampCropRect({ x: 180, y: 180, size: 50 }, 200, 200)).toEqual({
      x: 150,
      y: 150,
      size: 50,
    });
  });

  it("limita size ao menor lado da imagem", () => {
    // size 300 > min(200,150) → size = 150; reposiciona para caber.
    expect(clampCropRect({ x: 0, y: 0, size: 300 }, 200, 150)).toEqual({
      x: 0,
      y: 0,
      size: 150,
    });
  });

  it("garante size mínimo de 1", () => {
    expect(clampCropRect({ x: 0, y: 0, size: 0 }, 200, 200)).toEqual({
      x: 0,
      y: 0,
      size: 1,
    });
  });

  it("arredonda coordenadas fracionárias (Pointer Events entregam floats)", () => {
    // x=10.7→11, y=10.2→10, size=49.6→50; ainda cabe em 200×200.
    expect(clampCropRect({ x: 10.7, y: 10.2, size: 49.6 }, 200, 200)).toEqual({
      x: 11,
      y: 10,
      size: 50,
    });
  });
});

// ── TASK-01 (personalizacao-grupo): crop RETANGULAR (proporção livre) ────────

describe("validateLogoInput — restrição de mimes (logo)", () => {
  it("aceita png, jpeg e webp", () => {
    expect(() => validateLogoInput({ type: "image/png", size: 1000 })).not.toThrow();
    expect(() => validateLogoInput({ type: "image/jpeg", size: 1000 })).not.toThrow();
    expect(() => validateLogoInput({ type: "image/webp", size: 1000 })).not.toThrow();
  });

  it("rejeita SVG (risco XSS)", () => {
    expect(() => validateLogoInput({ type: "image/svg+xml", size: 1000 })).toThrow(
      AvatarImageError,
    );
  });

  it("rejeita não-imagem (pdf)", () => {
    expect(() => validateLogoInput({ type: "application/pdf", size: 1000 })).toThrow(
      AvatarImageError,
    );
  });

  it("rejeita imagem acima do teto de entrada (10MB)", () => {
    expect(() =>
      validateLogoInput({ type: "image/png", size: MAX_INPUT_BYTES + 1 }),
    ).toThrow(AvatarImageError);
  });

  it("MAX_POOL_LOGO_BASE64_LENGTH é menor que o teto da foto (cabe sob 1MB do doc)", () => {
    expect(MAX_POOL_LOGO_BASE64_LENGTH).toBeGreaterThan(0);
    expect(MAX_POOL_LOGO_BASE64_LENGTH).toBeLessThan(700_000);
  });
});

describe("clampRectCropRect — retângulo livre dentro da imagem natural", () => {
  it("mantém um retângulo já válido (só arredonda)", () => {
    expect(clampRectCropRect({ x: 10, y: 20, width: 100, height: 50 }, 400, 300)).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });
  });

  it("clampa coordenadas negativas para 0", () => {
    expect(clampRectCropRect({ x: -30, y: -10, width: 100, height: 50 }, 400, 300)).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    });
  });

  it("encolhe/reposiciona quando o retângulo ultrapassa as bordas direita/inferior", () => {
    // x=380 + width=100 = 480 > 400 → width limitada a 20 (400-380).
    expect(clampRectCropRect({ x: 380, y: 290, width: 100, height: 50 }, 400, 300)).toEqual({
      x: 380,
      y: 290,
      width: 20,
      height: 10,
    });
  });

  it("width/height mínimos de 1 (não colapsa)", () => {
    expect(clampRectCropRect({ x: 0, y: 0, width: 0, height: 0 }, 400, 300)).toEqual({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
  });

  it("arredonda coordenadas fracionárias", () => {
    expect(
      clampRectCropRect({ x: 10.7, y: 20.2, width: 99.6, height: 49.4 }, 400, 300),
    ).toEqual({ x: 11, y: 20, width: 100, height: 49 });
  });
});

describe("displayRectToNatural — escala do recorte display→natural", () => {
  it("escala x/y/width/height pelo fator natural/display", () => {
    // display 200×100 → natural 800×400 (fator 4). Overlay retangular.
    expect(
      displayRectToNatural(
        { x: 10, y: 5, width: 50, height: 25 },
        { width: 200, height: 100 },
        { width: 800, height: 400 },
      ),
    ).toEqual({ x: 40, y: 20, width: 200, height: 100 });
  });

  it("display 0 → fallback seguro (imagem inteira)", () => {
    expect(
      displayRectToNatural(
        { x: 0, y: 0, width: 0, height: 0 },
        { width: 0, height: 0 },
        { width: 800, height: 400 },
      ),
    ).toEqual({ x: 0, y: 0, width: 800, height: 400 });
  });
});
