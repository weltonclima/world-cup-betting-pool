import type { z } from "zod";

import type { teamSchema } from "@/schemas/teams";

export type Team = z.infer<typeof teamSchema>;
