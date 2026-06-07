import { z, type ZodType } from "zod";

/**
 * Helpers compartilhados pela camada de serviço que consome os Route Handlers
 * `/api/*` (integracao-api-football, TASK-05). Extraído de `matches.ts`/`teams.ts`
 * para eliminar duplicação (dedup — review TASK-05 WR-02), SEM mudar comportamento.
 *
 * Base relativa — funciona no client (browser resolve contra a origem atual).
 */
export const API_BASE = "/api";

/**
 * Schema do `id` que a rede embute em cada item (= `String(api.id)`).
 *
 * NÃO usar `z.intersection(schema, idSchema)` nem `schema.and(idSchema)`: schemas
 * com `.refine` (ex.: `matchSchema`, regra de placares por status) NÃO têm o refine
 * reaplicado pela interseção em Zod 4, abrindo um buraco de validação. Validamos o
 * `id` separado e o restante com o schema intacto — ver `parseWithId`.
 */
export const idSchema = z.object({ id: z.string().min(1) });

/**
 * Valida um item vindo da rede preservando o refine do `bodySchema`: separa `id`
 * (validado por `idSchema`) do restante (validado pelo `bodySchema`, tipicamente
 * `.strict()` e sem `id`). Mantém o refine do schema do corpo intacto.
 *
 * @param input - Item bruto da resposta da rede.
 * @param bodySchema - Schema do corpo (sem `id`), com refine preservado.
 * @returns `{ id, ...corpo validado }`.
 * @throws ZodError se `id` ou o restante violarem o contrato.
 */
export function parseWithId<T>(
  input: unknown,
  bodySchema: ZodType<T>,
): T & { id: string } {
  const { id } = idSchema.parse(input);
  // input é objeto (idSchema.parse acima já garantiu); separa id do restante.
  const { id: _omit, ...rest } = input as Record<string, unknown>;
  void _omit;
  return { id, ...bodySchema.parse(rest) };
}

/**
 * Lê o corpo `{ error }` (se houver) e monta uma mensagem útil para o `Error`.
 * Tolera corpo ausente/inválido sem mascarar o status HTTP.
 *
 * @param res - Resposta HTTP (status != 2xx).
 * @param fallback - Mensagem base quando não há detalhe no corpo.
 * @returns `Error` com `fallback`, status HTTP e detalhe do corpo quando presente.
 */
export async function buildHttpError(
  res: Response,
  fallback: string,
): Promise<Error> {
  let detail = "";
  try {
    const body: unknown = await res.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
    ) {
      detail = (body as { error: string }).error;
    }
  } catch {
    // corpo não-JSON / vazio — ignora, usa só o status.
  }
  const suffix = detail ? ` — ${detail}` : "";
  return new Error(`${fallback} (HTTP ${res.status})${suffix}`);
}
