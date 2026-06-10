"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { listMyPasskeys } from "@/services/webauthn";
import type { WebauthnCredential } from "@/schemas";

/** Lista os passkeys do usuário autenticado (TASK-06), ordenados por data desc. */
export function usePasskeys(): UseQueryResult<WebauthnCredential[]> {
  const uid = useAuth().profile?.uid;

  return useQuery({
    queryKey: ["passkeys", uid ?? "anon"],
    enabled: Boolean(uid),
    queryFn: async () => {
      const creds = await listMyPasskeys(uid as string);
      return creds.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  });
}
