import type { z } from "zod";

import type { bonusPredictionSchema } from "@/schemas/bonusPredictions";

export type BonusPrediction = z.infer<typeof bonusPredictionSchema>;
