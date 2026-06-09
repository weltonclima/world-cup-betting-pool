import { describe, expect, it } from "vitest";

import {
  AvatarImageError,
  clampCropRect,
  dataUrlByteSize,
  squareCrop,
  validateImageInput,
  MAX_INPUT_BYTES,
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
