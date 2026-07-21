import { describe, expect, it } from "vitest";

import * as schemas from "@/schemas";

// Guarda de fiação: garante que o schema de campeonato foi reexportado pelo
// barrel `@/schemas` (a coleção precisa ser acessível pelo import agregado que o
// resto do app usa).
describe("championships › barrel", () => {
  it("championshipSchema é reexportado por @/schemas", () => {
    expect(schemas.championshipSchema).toBeDefined();
    expect(schemas.championshipTypeSchema.safeParse("league").success).toBe(
      true,
    );
    expect(
      schemas.championshipStatusSchema.safeParse("archived").success,
    ).toBe(true);
  });
});
