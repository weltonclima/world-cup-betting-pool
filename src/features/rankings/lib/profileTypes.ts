import type { MatchStatus, Stage } from "@/types/shared";
import type { PredictionDisplayStatus } from "@/features/predictions/lib";

export interface ResolvedTeam {
  id: string;
  name: string;
  flagUrl: string | null;
}

export interface ProfilePredictionItem {
  matchId: string;
  kickoffAt: string;
  stage: Stage;
  groupId: string | null;
  homeTeam: ResolvedTeam;
  awayTeam: ResolvedTeam;
  prediction: { homeScore: number; awayScore: number };
  actualScore: { homeScore: number; awayScore: number } | null;
  matchStatus: MatchStatus;
  displayStatus: PredictionDisplayStatus;
}
