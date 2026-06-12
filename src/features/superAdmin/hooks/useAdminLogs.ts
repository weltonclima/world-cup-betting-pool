"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { listLogs } from "@/services/systemLogs";
import type { SystemLog, SystemLogType } from "@/schemas/systemLogs";
import { superAdminKeys } from "./superAdminKeys";

/**
 * Logs globais (PRD11-09). Reusa `listLogs` (system_logs, leitura super_admin via
 * Rules). `limit` opcional para o preview "Atividade Recente" do dashboard.
 */
export function useAdminLogs(
  type?: SystemLogType,
): UseQueryResult<SystemLog[], Error> {
  return useQuery<SystemLog[], Error>({
    queryKey: superAdminKeys.logs(type),
    queryFn: () => listLogs(type),
  });
}
