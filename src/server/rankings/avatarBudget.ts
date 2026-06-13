import type { RankingEntry } from "@/types/rankings";

/**
 * Guard de orçamento de payload de avatares por documento de ranking (TASK-05, R2/D4).
 *
 * O avatar do usuário é uma data URL JPEG base64 (PRD-06) que vive no doc `users`.
 * Propagá-lo para CADA entry de um doc `rankings/*` pode estourar o limite de 1 MB/doc
 * do Firestore (o ranking geral contém TODOS os usuários aprovados). Este módulo aplica
 * um orçamento conservador por documento: inclui avatares em ordem de posição (topo do
 * ranking primeiro — garante foto no pódio) até o orçamento; a partir daí, omite
 * `avatarUrl` (a entry permanece, sem foto → fallback de iniciais na UI).
 *
 * Server-safe e puro: sem `document`/`canvas`/DOM. Não importa o módulo browser-only
 * `features/profile/lib/imageToDataUrl.ts`; a estimativa de bytes é replicada aqui.
 */

/**
 * Orçamento de bytes reservado a avatares por documento de ranking. Conservador
 * frente ao teto de 1 MB do Firestore, deixando folga (~224 KB) para o payload
 * não-avatar (campos textuais + metadados das entries).
 *
 * IMPORTANTE: este orçamento é medido sobre o tamanho da STRING armazenada (a data
 * URL inteira), não sobre o conteúdo decodificado — é a string que o Firestore grava
 * e conta contra o limite de 1 MB/doc. Ver `storedDataUrlBytes`.
 */
export const AVATAR_BUDGET_BYTES = 800 * 1024; // ~800 KB de STRING armazenada

/**
 * Tamanho em bytes que a data URL ocupa NO DOCUMENTO Firestore (puro/testável).
 * O Firestore grava a string crua; uma data URL base64 é ASCII (`data:…;base64,` +
 * base64), logo cada char = 1 byte UTF-8 → o custo no doc é o comprimento da string.
 *
 * NÃO confundir com o tamanho DECODIFICADO da imagem (`dataUrlByteSize` em
 * `imageToDataUrl.ts`, ~3/4 deste): para o orçamento do DOC o que importa é a string,
 * que é ~4/3 maior. Usar o decodificado subestimaria o doc em ~25–33% e poderia
 * estourar o limite de 1 MB — justamente o que este guard previne (R2).
 */
export function storedDataUrlBytes(dataUrl: string): number {
  return dataUrl.length;
}

/**
 * Aplica o orçamento de avatares a uma lista de entries JÁ ORDENADA por posição.
 * Percorre do topo: para cada entry com `avatarUrl`, soma o tamanho estimado; se
 * couber no orçamento, mantém a foto; senão, omite `avatarUrl` daquela entry
 * (entries seguem na lista, só sem foto). Entries sem foto não consomem orçamento.
 *
 * Não muta a entrada — devolve uma cópia. Idempotente.
 */
export function applyAvatarBudget(
  entries: RankingEntry[],
  budget: number = AVATAR_BUDGET_BYTES,
): RankingEntry[] {
  let used = 0;
  return entries.map((entry) => {
    if (entry.avatarUrl === undefined) return { ...entry };
    const size = storedDataUrlBytes(entry.avatarUrl);
    if (used + size <= budget) {
      used += size;
      return { ...entry };
    }
    // Estoura o orçamento → omite a foto (mantém a entry).
    const { avatarUrl: _omit, ...rest } = entry;
    return rest;
  });
}
