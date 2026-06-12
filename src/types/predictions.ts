import type { z } from "zod";

import type {
  groupManualPredictionInputSchema,
  groupManualPredictionSavedSchema,
  predictionInputSchema,
  predictionSchema,
} from "@/schemas/predictions";

export type Prediction = z.infer<typeof predictionSchema>;
export type PredictionInput = z.infer<typeof predictionInputSchema>;
export type GroupManualPredictionInput = z.infer<
  typeof groupManualPredictionInputSchema
>;
export type GroupManualPredictionSaved = z.infer<
  typeof groupManualPredictionSavedSchema
>;
