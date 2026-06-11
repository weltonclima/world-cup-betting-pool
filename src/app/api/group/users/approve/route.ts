import "server-only";

import type { NextRequest, NextResponse } from "next/server";

import { handleStatusModeration } from "@/app/api/group/users/_moderation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/group/users/approve — `pending → approved` (PRD-10, TASK-05). */
export function POST(request: NextRequest): Promise<NextResponse> {
  return handleStatusModeration(request, "approve");
}
