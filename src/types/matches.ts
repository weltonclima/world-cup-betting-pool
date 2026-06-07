import type { z } from "zod";

import type { matchSchema } from "@/schemas/matches";

export type Match = z.infer<typeof matchSchema>;

/** Partida com o doc id do Firestore injetado após o parse do schema. */
export type MatchWithId = Match & { id: string };
