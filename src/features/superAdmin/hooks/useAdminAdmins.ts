"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { listGroupAdmins, type AdminEntry } from "@/services/superAdmin";
import { superAdminKeys } from "./superAdminKeys";

/** Lista de administradores de grupo (PRD11-05). */
export function useAdminAdmins(): UseQueryResult<AdminEntry[], Error> {
  return useQuery<AdminEntry[], Error>({
    queryKey: superAdminKeys.admins(),
    queryFn: listGroupAdmins,
  });
}
