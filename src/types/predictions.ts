import type { z } from "zod";

import type { predictionSchema } from "@/schemas/predictions";

export type Prediction = z.infer<typeof predictionSchema>;
