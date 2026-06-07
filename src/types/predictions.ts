import type { z } from "zod";

import type {
  predictionInputSchema,
  predictionSchema,
} from "@/schemas/predictions";

export type Prediction = z.infer<typeof predictionSchema>;
export type PredictionInput = z.infer<typeof predictionInputSchema>;
