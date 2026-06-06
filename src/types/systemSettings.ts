import type { z } from "zod";

import type { systemSettingsSchema } from "@/schemas/systemSettings";

export type SystemSettings = z.infer<typeof systemSettingsSchema>;
