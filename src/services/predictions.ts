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
  502: "Erro ao buscar dados da Copa. Tente novamente.",
  503: "Serviço de dados da Copa temporariamente indisponível.",
  504: "Tempo limite ao buscar dados da Copa. Tente novamente.",
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

/**
 * Lista os palpites de OUTRO participante via Route Handler GET /api/predictions/[uid]
 * (anti-cola, PRD-14 / TASK-02). O servidor (Admin SDK) filtra server-side e retorna
 * SOMENTE palpites de jogos `status === "finished"` — o cliente nunca recebe palpite
 * de jogo aberto. Para o PRÓPRIO usuário use `listPredictionsByUid` (Client SDK, todos
 * os jogos), não este caminho.
 *
 * Usa `credentials: "same-origin"` para enviar o cookie de sessão httpOnly.
 * Mapeia respostas de erro HTTP para `PredictionServiceError` com mensagem pt-BR.
 *
 * @param uid - UID do participante alvo.
 * @throws PredictionServiceError em erro HTTP (401/403/500).
 * @throws Error genérico em falha de rede (fetch rejeita).
 * @throws ZodError se algum documento retornado não passar na validação.
 * @returns Array de Prediction (apenas jogos encerrados; vazio se nenhum).
 */
export async function getOtherUserPredictions(uid: string): Promise<Prediction[]> {
  const response = await fetch(`/api/predictions/${uid}`, {
    credentials: "same-origin",
  });

  if (!response.ok) {
    const message =
      HTTP_ERROR_MESSAGES[response.status] ?? FALLBACK_HTTP_MESSAGE;
    throw new PredictionServiceError(response.status, message);
  }

  const data = (await response.json()) as unknown;
  return predictionSchema.array().parse(data);
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

// ─── Batch ───────────────────────────────────────────────────────────────────

/** Item gravado com sucesso pelo endpoint batch. */
export interface BatchSavedItem {
  id: string;       // docId Firestore: "${uid}_${matchId}"
  matchId: string;
  homeScore: number;
  awayScore: number;
  created: boolean; // true = create, false = update
}

/** Item rejeitado pelo endpoint batch. */
export interface BatchRejectedItem {
  index: number;                                     // índice original no array de input
  matchId: string | undefined;                       // undefined se o item era totalmente inválido
  reason: "invalid" | "not_found" | "locked";
  message: string;                                   // pt-BR do servidor
}

/** Resultado completo do upsert em lote. */
export interface BatchUpsertResult {
  saved: BatchSavedItem[];
  rejected: BatchRejectedItem[];
}

/**
 * Envia um lote de palpites ao Route Handler POST /api/predictions/batch.
 * Usa credentials: "same-origin" (cookie de sessão httpOnly).
 *
 * Retorna { saved, rejected } — o caller (useUpsertPredictionsBatch) é responsável
 * por exibir feedback agregado; rejeições parciais NÃO lançam exceção.
 *
 * @throws PredictionServiceError em erros de rota (401/403/422/500/502/503/504).
 * @throws Error em falha de rede (fetch rejeita).
 */
export async function upsertPredictionsBatch(
  inputs: UpsertPredictionInput[],
): Promise<BatchUpsertResult> {
  const response = await fetch("/api/predictions/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ predictions: inputs }),
  });

  if (!response.ok) {
    const message =
      HTTP_ERROR_MESSAGES[response.status] ?? FALLBACK_HTTP_MESSAGE;
    throw new PredictionServiceError(response.status, message);
  }

  return response.json() as Promise<BatchUpsertResult>;
}
