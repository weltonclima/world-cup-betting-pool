"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { getPreferences, updatePreferences } from "@/services/notifications";
import type {
  NotificationPreferences,
  NotificationPreferencesInput,
} from "@/schemas/notificationPreferences";
import { useAuth } from "@/hooks/useAuth";

import { notificationKeys } from "./notificationKeys";

/** Preferências de notificação do usuário logado (PRD08-03). */
export function usePreferences(): UseQueryResult<NotificationPreferences> {
  const { profile } = useAuth();
  const uid = profile?.uid;

  return useQuery({
    queryKey: notificationKeys.preferences(uid ?? "anon"),
    queryFn: () => getPreferences(uid as string),
    enabled: Boolean(uid),
  });
}

/** Salva as preferências e invalida a query correspondente. */
export function useUpdatePreferences(): UseMutationResult<
  void,
  Error,
  NotificationPreferencesInput
> {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const uid = profile?.uid;

  return useMutation<void, Error, NotificationPreferencesInput>({
    mutationFn: (prefs) => updatePreferences(uid as string, prefs),
    onSuccess: () => {
      if (uid) {
        void queryClient.invalidateQueries({
          queryKey: notificationKeys.preferences(uid),
        });
      }
    },
  });
}
