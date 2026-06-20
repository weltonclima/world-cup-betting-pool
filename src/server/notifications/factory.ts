import "server-only";

import { moderationNotification } from "@/features/admin/lib/notificationFactory";
import type { NotificationInput } from "@/schemas/notifications";
import type { UserStatus } from "@/types";

/**
 * Payload de notificação produzido pela factory, antes da escrita.
 * `id` opcional = chave determinística (idempotência no write); ausente = auto-id.
 */
export type NotificationCreate = NotificationInput & { id?: string };

/**
 * Notificação `games` — acerto de palpite. ID determinístico `games-{uid}-{matchId}`
 * garante 1 notificação por jogo mesmo em re-run do cron. Consome o resultado já
 * pontuado (não recalcula). Nunca chamada para `wrong` (caller filtra).
 */
export function notifyScoreHit(ctx: {
  uid: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  result: "correct" | "partial";
  predictionIsDraw: boolean;
}): NotificationCreate {
  const { uid, matchId, homeTeam, awayTeam, result, predictionIsDraw } = ctx;
  const matchup = `${homeTeam} x ${awayTeam}`;
  const id = `games-${uid}-${matchId}`;

  if (result === "correct") {
    return {
      id,
      userId: uid,
      type: "games",
      title: "Você acertou o placar!",
      message: `🎯 Você acertou o placar! +10 pts em ${matchup}`,
    };
  }

  if (result === "partial") {
    // partial: distingue vencedor de empate pelo palpite do usuário.
    return predictionIsDraw
      ? {
          id,
          userId: uid,
          type: "games",
          title: "Você acertou o empate!",
          message: `🤝 Você acertou o empate! +5 pts em ${matchup}`,
        }
      : {
          id,
          userId: uid,
          type: "games",
          title: "Você acertou o vencedor!",
          message: `✅ Você acertou o vencedor! +5 pts em ${matchup}`,
        };
  }

  // §6.1: estado inválido não pode virar notificação falsa de acerto. Guard de
  // runtime — protege contra caller que cruze fronteira JSON com result fora do
  // contrato (ex.: "wrong" se um filtro regredir na TASK-04).
  throw new Error(
    `notifyScoreHit: result inválido "${result as string}" (esperado "correct" | "partial")`,
  );
}

/**
 * Notificação `ranking` — subida de posição. ID determinístico `ranking-{uid}-{dateKey}`
 * limita a 1 notificação de subida por dia. Pré-condição: só chamada quando
 * `newPosition < previousPosition` (caller filtra). Top 3 = mensagem de pódio.
 */
export function notifyRankingUp(ctx: {
  uid: string;
  newPosition: number;
  previousPosition: number;
  dateKey: string;
}): NotificationCreate {
  const { uid, newPosition, dateKey } = ctx;
  const id = `ranking-${uid}-${dateKey}`;

  if (newPosition <= 3) {
    return {
      id,
      userId: uid,
      type: "ranking",
      title: "Pódio!",
      message: `🏆 Você está no pódio! ${newPosition}º lugar`,
    };
  }

  return {
    id,
    userId: uid,
    type: "ranking",
    title: "Você subiu no ranking!",
    message: `📈 Você subiu para ${newPosition}º no ranking!`,
  };
}

/**
 * Notificação `system` — moderação. Reusa `moderationNotification` (paridade de copy
 * com o factory legado de `admin/lib`) para garantir migração segura na TASK-03.
 * Sem ID determinístico: eventos de moderação repetem legitimamente no mesmo dia
 * (block→unblock→block) — cada ação do admin deve entregar (auto-id no write).
 * `actorUid` não entra na copy da notificação (só no log), por isso é irrelevante aqui.
 */
export function notifyModeration(ctx: {
  uid: string;
  from: UserStatus;
  to: UserStatus;
}): NotificationCreate | null {
  return moderationNotification({ ...ctx, actorUid: "" });
}

/**
 * Notificação `system` — promoção a admin do grupo (PRD §6.2, S5). Sem ID
 * determinístico: promoção é evento repetível (promote→demote→promote), cada
 * ocorrência deve entregar (auto-id no write). Notifica apenas o promovido.
 */
export function notifyPromotion(ctx: {
  uid: string;
  poolName: string;
}): NotificationCreate {
  const { uid, poolName } = ctx;
  return {
    userId: uid,
    type: "system",
    title: "Você é admin do grupo",
    message: `Você agora é administrador do bolão ${poolName}.`,
  };
}
