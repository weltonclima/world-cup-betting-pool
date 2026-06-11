import type { z } from "zod";

import type {
  bracketResponseSchema,
  groupStandingSchema,
  groupsResponseSchema,
  groupTableSchema,
  knockoutMatchSchema,
  knockoutMatchStatusSchema,
  knockoutPhaseSchema,
  knockoutSideSchema,
  qualificationSchema,
  standingTeamSchema,
} from "@/schemas/worldcup";

export type Qualification = z.infer<typeof qualificationSchema>;
export type StandingTeam = z.infer<typeof standingTeamSchema>;
export type GroupStanding = z.infer<typeof groupStandingSchema>;
export type GroupTable = z.infer<typeof groupTableSchema>;
export type KnockoutPhase = z.infer<typeof knockoutPhaseSchema>;
export type KnockoutMatchStatus = z.infer<typeof knockoutMatchStatusSchema>;
export type KnockoutSide = z.infer<typeof knockoutSideSchema>;
export type KnockoutMatch = z.infer<typeof knockoutMatchSchema>;
export type GroupsResponse = z.infer<typeof groupsResponseSchema>;
export type BracketResponse = z.infer<typeof bracketResponseSchema>;
