/**
 * Testes do Route Handler POST /api/admin/worldcup/sync — DESCONTINUADO (PRD-13).
 *
 * O sync openfootball → Firestore foi removido: ESPN é a fonte primária servida
 * em tempo real. O endpoint responde 410 Gone direto, sem auth nem I/O.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST } from "@/app/api/admin/worldcup/sync/route";

describe("POST /api/admin/worldcup/sync (descontinuado)", () => {
  it("410 Gone com mensagem de migração", async () => {
    const res = await POST();
    expect(res.status).toBe(410);

    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("descontinuado");
    expect(body.error).toContain("ESPN");
  });
});
