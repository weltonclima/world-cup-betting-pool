import type { z } from "zod";

import type { groupSchema } from "@/schemas/groups";

export type Group = z.infer<typeof groupSchema>;
