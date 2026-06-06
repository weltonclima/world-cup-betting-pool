import { z } from "zod";

import { nonEmptyString } from "@/schemas/shared";

// Coleção `groups` (grupos da fase de grupos). Standings ficam fora do escopo (dado dinâmico).
export const groupSchema = z
  .object({
    name: nonEmptyString, // (assumido) ex.: "A".."L"
    teamIds: z.array(nonEmptyString), // (assumido) ids das seleções do grupo
  })
  .strict();
