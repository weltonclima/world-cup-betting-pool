import "server-only";

import type { NextRequest, NextResponse } from "next/server";

import { handleStatusModeration } from "@/app/api/group/users/_moderation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/group/users/unblock — `blocked → approved` (limpa blockReason). */
export function POST(request: NextRequest): Promise<NextResponse> {
  return handleStatusModeration(request, "unblock");
}
