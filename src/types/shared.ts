import type { z } from "zod";

import type {
  matchStatusSchema,
  rankingScopeSchema,
  roleSchema,
  stageSchema,
  userStatusSchema,
} from "@/schemas/shared";

// Tipos derivados dos enums compartilhados (z.infer — sem duplicação manual).
export type Role = z.infer<typeof roleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type Stage = z.infer<typeof stageSchema>;
export type RankingScope = z.infer<typeof rankingScopeSchema>;
export type MatchStatus = z.infer<typeof matchStatusSchema>;
