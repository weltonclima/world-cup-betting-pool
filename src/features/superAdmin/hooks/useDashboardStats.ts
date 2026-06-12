"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getDashboardStats, type DashboardStats } from "@/services/superAdmin";
import { superAdminKeys } from "./superAdminKeys";

/** KPIs globais do dashboard do Super Admin (PRD11-01). */
export function useDashboardStats(): UseQueryResult<DashboardStats, Error> {
  return useQuery<DashboardStats, Error>({
    queryKey: superAdminKeys.dashboard(),
    queryFn: getDashboardStats,
  });
}
