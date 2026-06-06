import { z } from "zod";

import { nonEmptyString } from "@/schemas/shared";

// Coleção `teams` (seleções participantes). Campos assumidos — mínimos para listar/exibir.
export const teamSchema = z
  .object({
    name: nonEmptyString, // nome da seleção
    code: z.string().regex(/^[A-Z]{3}$/, "Código FIFA deve conter exatamente 3 letras maiúsculas (ex.: BRA)"), // código FIFA 3 letras maiúsculas
    flagUrl: z.url().optional(), // (assumido) bandeira
    groupId: nonEmptyString.optional(), // (assumido) grupo na fase de grupos
  })
  .strict();
