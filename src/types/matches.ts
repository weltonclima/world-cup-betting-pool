import type { z } from "zod";

import type { matchSchema } from "@/schemas/matches";

export type Match = z.infer<typeof matchSchema>;
