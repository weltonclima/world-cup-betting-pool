import "server-only";

import type { NextRequest, NextResponse } from "next/server";

import { handleStatusModeration } from "@/app/api/group/users/_moderation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/group/users/block — `approved → blocked` (+ blockReason opcional). */
export function POST(request: NextRequest): Promise<NextResponse> {
  return handleStatusModeration(request, "block");
}
