/**
 * Testes de `fetchAllTeams` (PRD-13 TASK-06).
 *
 * `fetchAllTeams` deriva as 48 seleções do `TEAM_REGISTRY` estático — sem HTTP.
 * Garantias:
 *  1. retorna exatamente 48 times;
 *  2. todo item tem shape mínima (`id`/`name`/`code`/`flagUrl`/`groupId`) não-vazia;
 *  3. todo `groupId` ∈ "A".."L";
 *  4. spot-checks de grupo (BRA→C, MEX→A, ENG→L, ARG→J);
 *  5. nenhum id duplicado;
 *  6. nenhuma chamada de rede (`fetch` nunca invocado).
 *
 * Mock: `server-only` (barrel `@/server/copaData` o importa). Sem mock de rede —
 * a função é pura/estática; o spy de `fetch` só prova ausência de I/O.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchAllTeams } from "@/server/copaData";

const VALID_GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

describe("fetchAllTeams", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("T1: retorna exatamente 48 times", async () => {
    const teams = await fetchAllTeams();
    expect(teams).toHaveLength(48);
  });

  it("T2: todo item tem shape mínima não-vazia", async () => {
    const teams = await fetchAllTeams();
    for (const t of teams) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.code).toMatch(/^[A-Z]{3}$/);
      expect(t.flagUrl).toMatch(/^https?:\/\//);
      expect(t.groupId).toBeTruthy();
    }
  });

  it("T3: todo groupId ∈ A..L", async () => {
    const teams = await fetchAllTeams();
    for (const t of teams) {
      expect(VALID_GROUPS).toContain(t.groupId);
    }
  });

  it("T4: spot-checks de grupo", async () => {
    const teams = await fetchAllTeams();
    const byId = new Map(teams.map((t) => [t.id, t]));
    expect(byId.get("BRA")?.groupId).toBe("C");
    expect(byId.get("MEX")?.groupId).toBe("A");
    expect(byId.get("ENG")?.groupId).toBe("L");
    expect(byId.get("ARG")?.groupId).toBe("J");
  });

  it("T5: nenhum id duplicado", async () => {
    const teams = await fetchAllTeams();
    const ids = teams.map((t) => t.id);
    expect(new Set(ids).size).toBe(48);
  });

  it("T6: nenhuma chamada de rede", async () => {
    await fetchAllTeams();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
