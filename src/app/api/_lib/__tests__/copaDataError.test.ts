/**
 * Testes do helper `copaDataErrorResponse`.
 *
 * Verifica o mapeamento erro → HTTP status: erros ESPN (fonte única)
 * `EspnTimeoutError`/`EspnFetchError`/`EspnParseError` → 504/502/500.
 * (Ramos `CopaData*Error` removidos na TASK-06 com o openfootball.)
 */

import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("server-only", () => ({}));

import { copaDataErrorResponse } from "@/app/api/_lib/copaDataError";
import {
  EspnTimeoutError,
  EspnFetchError,
  EspnParseError,
} from "@/server/copaData/espnClient";

describe("copaDataErrorResponse — erros ESPN (fonte única)", () => {
  it("CE-01: EspnTimeoutError → 504", () => {
    const res = copaDataErrorResponse(new EspnTimeoutError(5000));
    expect(res.status).toBe(504);
  });

  it("CE-02: EspnFetchError → 502", () => {
    const res = copaDataErrorResponse(new EspnFetchError(503));
    expect(res.status).toBe(502);
  });

  it("CE-03: EspnParseError → 500", () => {
    const res = copaDataErrorResponse(new EspnParseError("shape inválido"));
    expect(res.status).toBe(500);
  });
});

describe("copaDataErrorResponse — fallbacks", () => {
  it("CE-07: ZodError → 500", () => {
    const res = copaDataErrorResponse(new ZodError([]));
    expect(res.status).toBe(500);
  });

  it("CE-08: erro genérico → 500", () => {
    const res = copaDataErrorResponse(new Error("boom"));
    expect(res.status).toBe(500);
  });
});
