import type { z } from "zod";

import type { teamSchema } from "@/schemas/teams";

export type Team = z.infer<typeof teamSchema>;

/** Seleção com o doc id do Firestore injetado após o parse do schema. */
export type TeamWithId = Team & { id: string };
