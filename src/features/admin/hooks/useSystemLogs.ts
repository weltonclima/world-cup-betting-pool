"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { listLogs } from "@/services/systemLogs";
import type { SystemLog, SystemLogType } from "@/schemas/systemLogs";

/** Query-keys dos logs (PRD-07). */
export const systemLogsKeys = {
  all: () => ["system-logs"] as const,
  list: (type?: SystemLogType) => ["system-logs", "list", type ?? "all"] as const,
};

/** Lista os logs do sistema (PRD07-06), opcionalmente filtrados por tipo. */
export function useSystemLogs(
  type?: SystemLogType,
): UseQueryResult<SystemLog[]> {
  return useQuery({
    queryKey: systemLogsKeys.list(type),
    queryFn: () => listLogs(type),
  });
}
