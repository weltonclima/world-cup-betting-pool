import "server-only";

import type { NextResponse } from "next/server";

import { handleListUsers } from "@/app/api/group/users/_list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/group/users/pending — pendentes do pool (PRD-10, TASK-05). */
export function GET(): Promise<NextResponse> {
  return handleListUsers("pending");
}
