# RESOLUÇÃO — fixes do review retroativo PRD-09 TASK-01..05

> Aplicado após `ai/review/prd-09-task-01..05.md`. Lote completo (obrigatórios + importantes + menores).
> Gate final: `vitest run` **2114 pass / 0 fail**, `tsc --noEmit` limpo, eslint limpo.

## TASK-05 (era CHANGES REQUESTED → resolvido)

- **🔴 BLOCKER CR-01 (seed inviável):** `tsx` adicionado a `devDependencies` (`4.20.3`). `scripts/seed-pools.ts` deixou de importar `poolSchema` em runtime (tsx não resolve alias `@/*`); usa `import type { Pool }` (apagado na transpilação) + objeto tipado conferido em compilação. `npm run seed:pools` agora executa. Dados estáticos/conhecidos; validação de contrato cobre rotas/serviço (TASK-04).
- **🔴 WR-01 (bug de autorização — demotion):** swap de admin agora promove a `group_admin` **apenas participante** (`!newRole.success || isParticipantRole(newRole.data)`). super_admin/legado admin viram admin de pool **sem perder o papel global**. Regressão travada por teste novo ("super_admin NÃO é rebaixado").
- **WR-02/03 (strings cruas):** `status` validado via `userStatusSchema`; roles via `roleSchema` + `isGroupAdminRole`/`isParticipantRole`. Sem comparação crua de string.

## TASK-04 (PASS_WITH_WARNINGS → resolvido)

- **WR-01 (input não revalidado):** `createPool` revalida input client-side com `poolCreateClientSchema` (= `poolInputSchema` sem `adminId`) antes do POST — falha cedo, sem round-trip.
- **WR-02 (body de erro descartado):** `toServiceError` agora é async e anexa o detalhe `{ error }` do corpo via `extractErrorDetail` (`_apiClient`) — as mensagens/issues de 422 chegam ao form. 3 call sites atualizados (`await`).
- WR-03/WR-04 (mapeamento 400 sem teste; search lê coleção ativa inteira): mapeamento coberto pelo novo caminho de detalhe; `MAX_RESULTS` documentado como cap de payload (não de read) — sem mudança funcional.

## TASK-03 (PASS c/ nota → resolvido por documentação)

- **WR (índice `pools(slug)` ausente):** **não adicionado por design.** A unicidade de slug usa **doc-id = slug** (`.doc(slug).create()`, TASK-04) — lookup por id **não exige índice**. Índice single-field é automático no Firestore e não pode ser declarado como composite (≥2 campos) em `firestore.indexes.json`. O `pools(slug)` do plano fica obsoleto pela escolha (melhor) de doc-id. Sem risco de `FAILED_PRECONDITION` (não há `orderBy` por slug).

## TASK-02 (PASS → hardening)

- **WR-02 (`updatedAt` sem teste):** caso adicionado — ausente ok, ISO ok, não-ISO rejeitado.
- WR-01 (`poolStatusTransition.ts` entregue na 02, escopo da 05): nota de classificação; código correto e em uso pela TASK-05. Sem ação de código.

## TASK-01 (PASS → hardening)

- **WR-02 (teste hard-coded):** partição total agora itera `roleSchema.options` — role novo sem helper quebra o teste.
- **WR-01 (helpers value-total por omissão):** precondição documentada nos helpers (`shared.ts`): input deve ser Role validado; para claim/JWT cru, normalizar via `roleSchema` antes (guia da TASK-06).
