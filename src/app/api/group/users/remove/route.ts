import "server-only";

import type { NextRequest, NextResponse } from "next/server";

import { handleRemove } from "@/app/api/group/users/_moderation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/group/users/remove — soft-delete de usuário bloqueado (D4). */
export function POST(request: NextRequest): Promise<NextResponse> {
  return handleRemove(request);
}
