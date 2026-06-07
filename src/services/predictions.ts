import { collection, getDocs, query, where } from "firebase/firestore";

import { firestore } from "@/firebase";
import { predictionSchema } from "@/schemas";
import type { Prediction } from "@/types";

/**
 * Camada de serviço de palpites (PRD-04).
 *
 * Leitura: listPredictionsByUid — Firebase Client SDK (direto, permitido pelas Rules).
 * Escrita: upsertPrediction — fetch ao Route Handler POST /api/predictions (Admin SDK server-side).
 *
 * NÃO usar Firebase Client SDK para escrita — Rules negam write client-direto (TASK-05).
 */

// ─── Erro tipado de HTTP ────────────────────────────────────────────────────

/**
 * Erro tipado para respostas HTTP de erro do Route Handler de palpites.
 * Encapsula status HTTP e mensagem pt-BR mapeada — a UI nunca lida com códigos HTTP.
 */
export class PredictionServiceError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "PredictionServiceError";
    this.status = status;
  }
}

const HTTP_ERROR_MESSAGES: Record<number, string> = {
  401: "Você precisa estar autenticado para registrar palpites.",
  403: "Seu acesso ainda não foi aprovado pelo administrador.",
  404: "A partida solicitada não foi encontrada.",
  422: "Os dados do palpite são inválidos.",
  423: "O prazo para este jogo foi encerrado.",
  500: "Erro ao salvar o palpite. Tente novamente.",
};

const FALLBACK_HTTP_MESSAGE = "Ocorreu um erro inesperado. Tente novamente.";

// ─── Leitura ────────────────────────────────────────────────────────────────

/**
 * Lista todos os palpites do usuário com o dado `uid`.
 *
 * Os palpites são usados para join client-side com as partidas: comparar
 * `prediction.homeScore`/`awayScore` com o placar real para calcular acertos
 * (isCorrect — D1/R2 do PRD-02). Sem ordenação explícita (a UI ordena client-side).
 *
 * @param uid - UID do Firebase Auth do usuário.
 * @throws ZodError se algum documento não passar na validação do schema.
 * @throws FirebaseError se a leitura falhar (propaga cru, sem tradução).
 * @returns Array de Prediction validados (vazio se o usuário não tiver palpites).
 */
export async function listPredictionsByUid(uid: string): Promise<Prediction[]> {
  const q = query(
    collection(firestore, "predictions"),
    where("uid", "==", uid),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => predictionSchema.parse(d.data()));
}

// ─── Escrita ─────────────────────────────────────────────────────────────────

export interface UpsertPredictionInput {
  matchId: string;
  homeScore: number;
  awayScore: number;
}

/**
 * Envia um palpite (create ou update) ao Route Handler POST /api/predictions.
 * Usa credentials: "same-origin" para incluir o cookie de sessão httpOnly.
 *
 * Não usa Firebase Client SDK — escrita via Route Handler (Admin SDK no servidor).
 * Mapeia respostas de erro HTTP para PredictionServiceError com mensagem pt-BR.
 *
 * @param input - { matchId, homeScore, awayScore }
 * @throws PredictionServiceError em caso de erro HTTP (401/403/404/422/423/500).
 * @throws Error genérico em caso de falha de rede.
 */
export async function upsertPrediction(
  input: UpsertPredictionInput,
): Promise<void> {
  const response = await fetch("/api/predictions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message =
      HTTP_ERROR_MESSAGES[response.status] ?? FALLBACK_HTTP_MESSAGE;
    throw new PredictionServiceError(response.status, message);
  }
}
