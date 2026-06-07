import type { z } from "zod";

import type { userSchema } from "@/schemas/users";

export type User = z.infer<typeof userSchema>;
