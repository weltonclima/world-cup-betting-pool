"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import {
  getNotification,
  listNotifications,
  markAllAsRead,
  markAsRead,
} from "@/services/notifications";
import type { Notification, NotificationType } from "@/schemas/notifications";
import { useAuth } from "@/hooks/useAuth";

import { notificationKeys } from "./notificationKeys";

/**
 * Lista as notificações do usuário logado, opcionalmente filtradas por tipo
 * (tabs Todas/Sistema/Jogos/Ranking/Bolão — PRD08-01). Desabilitada sem uid.
 */
export function useNotifications(
  type?: NotificationType,
): UseQueryResult<Notification[]> {
  const { profile } = useAuth();
  const uid = profile?.uid;

  return useQuery({
    queryKey: notificationKeys.list(uid ?? "anon", type),
    queryFn: () => listNotifications(uid as string, type),
    enabled: Boolean(uid),
  });
}

/** Detalhe de uma notificação (PRD08-02). */
export function useNotification(
  id: string,
): UseQueryResult<Notification | null> {
  return useQuery({
    queryKey: notificationKeys.detail(id),
    queryFn: () => getNotification(id),
    enabled: Boolean(id),
  });
}

/**
 * Contador de não-lidas para o badge do sino (PRD-08 Header). Deriva da lista
 * completa (sem query separada) — <100 usuários, volume baixo (A5).
 */
export function useUnreadCount(): number {
  const { data } = useNotifications();
  return (data ?? []).filter((n) => !n.isRead).length;
}

/** Marca uma notificação como lida e invalida lista + contador. */
export function useMarkAsRead(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const uid = profile?.uid;

  return useMutation<void, Error, string>({
    mutationFn: (id) => markAsRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
      if (uid) {
        void queryClient.invalidateQueries({
          queryKey: notificationKeys.unread(uid),
        });
      }
    },
  });
}

/** Marca todas as não-lidas do usuário como lidas. */
export function useMarkAllAsRead(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const uid = profile?.uid;

  return useMutation<void, Error, void>({
    mutationFn: () => markAllAsRead(uid as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
    },
  });
}
