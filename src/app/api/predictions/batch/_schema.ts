import { z } from "zod";

// Schema/constantes do POST /api/predictions/batch.
// EXTRAÍDO de `route.ts`: o Next 15 só permite que um arquivo de rota exporte
// símbolos de rota (HTTP handlers, `runtime`, `dynamic`, etc.). Exportar
// `BATCH_MAX_SIZE`/`batchInputSchema`/`BatchInput` direto da rota quebra o
// type-check do build (`OmitWithTag ... { [x: string]: never }`). Mantê-los aqui
// preserva os exports para testes/consumidores sem violar o contrato de rota.

/** Total de jogos da Copa do Mundo 2026. */
export const BATCH_MAX_SIZE = 104;

/**
 * batchInputSchema — valida estrutura do body do POST /api/predictions/batch.
 *
 * Valida apenas que `predictions` existe e tem tamanho entre 1 e 104.
 * A validação item a item ocorre no loop do handler (erros vão para `rejected`).
 */
export const batchInputSchema = z.object({
  predictions: z
    .array(z.unknown())
    .min(1, "O lote deve conter pelo menos 1 palpite.")
    .max(BATCH_MAX_SIZE, `O lote não pode exceder ${BATCH_MAX_SIZE} palpites.`),
});

export type BatchInput = z.infer<typeof batchInputSchema>;
