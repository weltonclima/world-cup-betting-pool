/**
 * Fixtures de teste para os Route Handlers de matches.
 *
 * Reaproveita MOCK_FIXTURES, mas normaliza `fixture.date` para o formato ISO com
 * sufixo `Z` exigido por `matchSchema` (`z.iso.datetime()` rejeita offsets
 * numéricos como `+00:00`). Ver "Riscos" na spec: MOCK_FIXTURES usa `+00:00`,
 * que viola o schema do front — drift de TASK-02, fora do escopo desta task.
 * Aqui produzimos dados schema-válidos para exercitar os handlers.
 */

import { MOCK_FIXTURES } from "@/server/apiFootball/mock";
import type { FixtureResponse } from "@/server/apiFootball";

/** Converte `+00:00` (e offsets equivalentes a UTC) em sufixo `Z`. */
function toZulu(date: string): string {
  return date.replace(/\+00:00$/, "Z");
}

export const VALID_FIXTURES: FixtureResponse[] = MOCK_FIXTURES.map((f) => ({
  ...f,
  fixture: { ...f.fixture, date: toZulu(f.fixture.date) },
}));
