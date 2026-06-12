# PLAN — PRD-09 Gestão de Grupos (multi-tenancy + ranking por grupo)

> Fonte: `ai/prd/prd-09.md`. Decisões travadas: A1=`pools`, A2=endpoint admin mínimo, A3=grupo-semente "Bolão dos Parças", A4=foto base64 comprimida, A7=1 grupo/usuário (`groupId` escalar).
> Frente tripla de risco: multi-tenancy + reescrita de role + re-scoping de ranking. **Task-by-task com review entre elas.**

## 1. Planning summary

A PRD-09 transforma o produto de mono-bolão para multi-tenant por `pools`. O plano isola três frentes de risco em fases distintas, com **compatibilidade dupla de role** (`admin`||`super_admin`, `user`||`participant`) e **`groupId` opcional** durante a transição — promovido a obrigatório só após backfill. A sequência segue: contratos/schema → coleção+rules → endpoints → autorização → signup → frontend → re-scoping de ranking (isolado) → migração/backfill final.

12 tasks em 5 fases. Os pontos mais sensíveis (role rewrite, recalc por pool, backfill) ficam isolados e com review opus/high.

## 2. Recommended execution phases

- **Fase 1 — Fundação (contratos + dados + rules):** TASK-01, TASK-02, TASK-03
- **Fase 2 — Backend (endpoints + autorização):** TASK-04, TASK-05, TASK-06
- **Fase 3 — Signup + Frontend:** TASK-07, TASK-08, TASK-09
- **Fase 4 — Re-scoping de ranking (isolado, pesado):** TASK-10, TASK-11
- **Fase 5 — Migração/backfill + corte do legado:** TASK-12

## 3. Tasks

### TASK-01 – Evolução do enum de role (dupla-compat) + `groupId` opcional no usuário
- Type: domain
- Goal: Reescrever `roleSchema` para `participant | group_admin | super_admin` aceitando os valores legados (`user`, `admin`) durante a transição; adicionar `groupId` **opcional** ao `userSchema`.
- Scope: Apenas contrato Zod + types + helpers de normalização de role (`isSuperAdminRole`, `isGroupAdminRole`). Nenhuma mudança de comportamento de autorização ainda (isso é TASK-06). Sem tornar `groupId` obrigatório (isso é TASK-12).
- Main modules/files likely involved: `src/schemas/shared.ts` (roleSchema), `src/schemas/users.ts` (campo `groupId?`), `src/types/users.ts`, `src/schemas/__tests__/*`.
- Dependencies: nenhuma (fundação).
- Story points: 3
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes (mapeamento legado↔novo, parse de usuários antigos não pode quebrar).
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/medium
  - review: opus/high
- Notes: Breaking de contrato. A dupla-compat é o que evita stop-the-world. Garantir que `userSchema` antigo (sem `groupId`, `role:"admin"`) ainda faça parse — senão recalc/admin quebram (R4).

### TASK-02 – Schema e types do pool
- Type: domain
- Goal: Criar contrato `poolSchema` (coleção `pools`): `{ id, name, slug, description?, photoBase64?, status, adminId, createdAt }`, `status = pending|active|blocked`, slug `^[a-z0-9-]+$`, descrição ≤160, foto base64 (compat Spark, bem abaixo de 1MB).
- Scope: Apenas schema + types + validações de campo. Sem persistência, sem endpoints.
- Main modules/files likely involved: `src/schemas/pools.ts` (novo), `src/types/pools.ts` (novo), `src/schemas/index.ts` (barrel), `src/schemas/__tests__/pools.test.ts`.
- Dependencies: nenhuma (paralelizável com TASK-01).
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: yes (regex de slug, limite de descrição, enum de status).
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: Nome `pools` resolve a colisão R2 com `groups` (torneio). UI continua dizendo "grupo".

### TASK-03 – Firestore: rules + índices de `pools` e ajuste de `users`
- Type: infra
- Goal: Bloco de rules para `pools` (read de ativos por aprovados; write só Admin SDK); helpers `isSuperAdmin()`/`isGroupAdmin()`; ajustar `users` create para aceitar `role:"participant"` e `groupId` presente; índices.
- Scope: `firestore.rules` + `firestore.indexes.json`. Sem código de app. **NÃO** cobre o isolamento de leitura dos docs de ranking por pool — essa rule depende do layout A5 (TASK-10) e da claim `groupId` (TASK-06) e foi movida para TASK-11.
- Main modules/files likely involved: `firestore.rules`, `firestore.indexes.json` (`pools(slug)`, `pools(status)`, `users(groupId,status)`, `users(role)`).
- Dependencies: TASK-01, TASK-02 (precisa dos contratos para refletir nas rules).
- Story points: 3
- Criticality: high
- Technical risk: high
- Recommended TDD later: yes (`npm run test:rules` — emulador).
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: Manter dupla-compat de role nas rules (aceitar `admin`||`super_admin`). Erro aqui = lockout (R1).

### TASK-04 – Service + Route Handlers de pool (create / search / detail)
- Type: api
- Goal: `POST /api/groups` (cria pool `pending`, slug único server-side, Admin SDK), `GET /api/groups/search?q=` (lista ativos por nome/slug), `GET /api/groups/[id]` (detalhe). Service client-side de leitura no padrão Read/Write split.
- Scope: Route Handlers + `src/services/pools.ts` + hooks React Query. Slug uniqueness via doc-id=slug ou checagem transacional. Sem UI.
- Main modules/files likely involved: `src/app/api/groups/route.ts`, `src/app/api/groups/search/route.ts`, `src/app/api/groups/[id]/route.ts`, `src/services/pools.ts` (novo), `src/features/groups/hooks/*` (novo slice), `src/services/_apiClient.ts` (reuso).
- Dependencies: TASK-02 (schema), TASK-03 (rules/índices).
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes (unicidade de slug, race entre duas criações — R7; busca por ativos).
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: Busca (A6): MVP = match slug exato + filtro client-side sobre lista de ativos; documentar se nome precisa server-side. Erros tipados → mensagem pt-BR (padrão `PredictionServiceError`).

### TASK-05 – Endpoint admin de aprovação de grupo (`pending→active`) + troca de admin + seed
- Type: api
- Goal: Mecanismo backend mínimo (decisão A2) para transição `pending→active`/`blocked` via Admin SDK, protegido por secret/sessão super_admin; **troca do admin do pool** (`adminId` + repromoção `group_admin`, PRD §2.9); script/seed para tornar pool ativo. Sem UI (PRD-11).
- Scope: Route Handlers admin (status + troca de admin) + seed/script. Espelha o fluxo de aprovação de usuário existente (status transition).
- Main modules/files likely involved: `src/app/api/admin/groups/[id]/status/route.ts` (novo), `src/app/api/admin/groups/[id]/admin/route.ts` (troca de admin, novo), seed em `scripts/` ou endpoint, reuso de padrão `userStatusTransition`.
- Dependencies: TASK-02, TASK-03, TASK-04.
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes (transição de status válida/ inválida; autorização super_admin).
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: Sem este caminho, nenhum grupo vira `active` e a busca fica vazia → feature não testável fim-a-fim (R5).

### TASK-06 – Migração de autorização nas superfícies de role
- Type: integration
- Goal: Migrar todas as checagens `role==="admin"` → `super_admin` (com dupla-compat) e introduzir `group_admin`; sincronizar role **e `groupId`** nas custom claims (a claim `groupId` é pré-requisito da rule de isolamento de ranking, TASK-11); cobrir middleware edge, guard, functions, verifySession e route handlers.
- Scope: Trocar comparações de role; propagar `groupId` na claim via `syncRoleClaimOnUserUpdate`; manter aceitação de `admin`||`super_admin`. **Não** remove o legado (corte é TASK-12). Sem novas telas.
- Main modules/files likely involved: `middleware.ts:46`, `src/components/auth/AdminGuard.tsx:32`, `src/server/auth/verifySession.ts`, `functions/syncRoleClaimOnUserUpdate.ts`, `functions/promoteFirstAdmin.ts`, `src/app/api/rankings/recalc/route.ts:102`, `src/app/api/predictions/score/route.ts:88`.
- Dependencies: TASK-01 (enum + helpers).
- Story points: 5
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes (matriz de autorização: super_admin / group_admin / participant / legado; propagação de `groupId` na claim).
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/medium
  - review: opus/high
- Notes: Regressão ampla (R1). Erro = lockout ou escalonamento indevido. Usar helpers da TASK-01 em todos os pontos; não comparar strings cruas. Recalc permanece **global** (super_admin/cron) — não há recalc por `group_admin` nesta PRD; recalc por pool fica para PRD-10 se necessário.

### TASK-07 – Integração da seleção de grupo no signup
- Type: application
- Goal: Injetar a seleção de grupo (busca/seleciona pool ativo) no fluxo de signup existente; gravar `groupId` no doc do usuário e `role:"participant"`; manter `status:"pending"`.
- Scope: Form de signup + serviço de criação de usuário. Reusa busca da TASK-04. Sem as telas standalone de grupo (TASK-08/09) — apenas o campo embutido no cadastro.
- Main modules/files likely involved: `src/services/auth.ts:234-273`, `src/features/auth/schemas.ts`, `src/features/auth/components/*` (form de signup).
- Dependencies: TASK-01, TASK-02, TASK-04.
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes (signup grava groupId + role participant + status pending).
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: `is_frontend: true` (campo no form). `groupId` obrigatório no signup novo, mesmo que opcional no schema durante a migração.

### TASK-08 – Frontend: Criar Grupo (PRD09-01) + Solicitação Enviada (PRD09-02)
- Type: application
- Goal: Telas de criação de pool (nome/slug/descrição/foto base64 comprimida client-side) e confirmação pós-criação com CTA "Ir para meus grupos" (singular, ajuste A7).
- Scope: Componentes + integração com `POST /api/groups`. Compressão de imagem client-side (reuso do padrão avatar). Sem busca/detalhe.
- Main modules/files likely involved: `src/features/groups/components/CreateGroupForm.tsx`, `src/features/groups/components/GroupRequestSent.tsx`, rota App Router, reuso do utilitário de compressão de avatar.
- Dependencies: TASK-04.
- Story points: 5
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (componentes/UI; lógica de validação já coberta na TASK-02/04).
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: `is_frontend: true` → `/ui-spec` + `/patterns:nextjs`. PNGs fonte de verdade (mobile-first 360/390/430). Convite de amigos (A9) fora de escopo.

### TASK-09 – Frontend: Selecionar (PRD09-03) + Não Encontrado (PRD09-04) + Detalhes (PRD09-05)
- Type: application
- Goal: Busca/seleção de grupo ativo (nome/slug, nº de membros), estado vazio "Grupo Não Encontrado" com ações, e tela de detalhes (nome, slug, status badge, descrição, admin, nº participantes, data).
- Scope: Componentes + integração com `GET /api/groups/search` e `GET /api/groups/[id]`. Sem signup (TASK-07).
- Main modules/files likely involved: `src/features/groups/components/GroupSearch.tsx`, `GroupNotFound.tsx`, `GroupDetail.tsx`, rotas App Router.
- Dependencies: TASK-04, TASK-05 (precisa de grupo `active` para listar/detalhar).
- Story points: 5
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (UI; busca já coberta na TASK-04).
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: `is_frontend: true` → `/ui-spec` + `/patterns:nextjs`. Ações secundárias "Não encontrei meu grupo" / "Criar novo grupo" linkam para TASK-08.

### TASK-10 – Re-scoping do recalc de ranking por pool
- Type: api
- Goal: Particionar a agregação do recalc por `user.groupId` (pool); emitir rankings/estatísticas/pool_stats **por pool**. **A5 travada (layout flat):** `pool_stats/current` → `pool_stats/{poolId}`; `rankings/geral` → `rankings/pool-{poolId}-geral`; `rankings/{stage}` → `rankings/pool-{poolId}-{stage}`; `rankings/grupo-{X}` → `rankings/pool-{poolId}-grupo-{X}`; `statistics/{uid}` permanece por uid (já é por usuário, mas só conta partidas do pool do usuário).
- Scope: `src/app/api/rankings/recalc/route.ts` — **passo 1: agrupar `approved` por `groupId` (pool); passo 2: rodar o pipeline existente (geral + 5 fases + grupos-do-torneio) restrito aos participantes de cada pool.** Semântica = "os participantes do pool P, ranqueados entre si". NÃO cria cross pool×grupo-de-torneio novo — apenas filtra os escopos existentes aos membros do pool. Avaliar `BulkWriter`/lote (R6, Spark). Não inclui a leitura (TASK-11).
- Main modules/files likely involved: `src/app/api/rankings/recalc/route.ts`, `src/features/rankings/lib/*` (reuso de `rankParticipants`/`computeAccuracy`), `src/schemas/rankings.ts` (campo `poolId`).
- Dependencies: TASK-01 (`groupId` no user), TASK-02.
- Story points: 8
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes (agregação por pool; isolamento entre pools; denominadores de aproveitamento por pool).
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Notes: **Item mais pesado e coração da ênfase (R3).** A5 resolvida (flat, acima) — read simples na TASK-11. Docs por recalc = nº_pools × (1 geral + 5 fases + ~12 grupos-de-torneio) + pool_stats; vigiar cotas Spark (R6) — usar `BulkWriter`. Usuários sem `groupId` (pré-backfill) → atribuir ao pool-semente como fallback (consistente com TASK-12); definir no spec. Considerar dividir em 10a (particionar + geral/stats/pool_stats por pool) e 10b (5 fases + grupos-de-torneio por pool) se o contexto estourar.

### TASK-11 – Leitura de ranking por `groupId` + isolamento enforced nas rules
- Type: application
- Goal: Parametrizar a leitura de ranking/estatísticas pelo `groupId` do usuário logado **E** garantir o isolamento em nível de segurança — participante NÃO consegue ler `rankings/pool-Y-*` de outro pool.
- Scope: (a) app — `getRankingByScope` e hooks resolvem o pool do usuário e leem o doc escopado; query keys incluem `poolId`; (b) **rules — `firestore.rules:97-99`: leitura de `rankings/pool-{poolId}-*`, `pool_stats/{poolId}`, `statistics/{uid}` exige `poolId == request.auth.token.groupId`** (claim populada na TASK-06). Sem isso, a "visão por grupo" é burlável no client (blocker do plan-checker). Sem mudança no recalc (TASK-10).
- Main modules/files likely involved: `src/services/rankings.ts`, `src/features/rankings/*`, `src/features/home/hooks/*`, `firestore.rules` (linhas 97-99), React Query keys.
- Dependencies: TASK-10 (layout flat dos docs), TASK-06 (claim `groupId`).
- Story points: 5
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes (resolução de pool → doc correto; **`test:rules`: user do pool X recebe deny ao ler ranking do pool Y**; fallback legado).
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/medium
  - review: opus/high
- Notes: É a metade de segurança da ênfase central — sem a rule, o isolamento é só cosmético. Casar query keys com o layout flat da TASK-10. Fallback quando usuário sem pool (legado) → pool-semente.

### TASK-12 – Migração/backfill: pool-semente + `groupId` obrigatório + corte do legado
- Type: migration
- Goal: Criar pool-semente "Bolão dos Parças" (`active`, A3), migrar todos os usuários existentes para ele, remapear role (`admin→super_admin` + `group_admin` do semente; `user→participant`), promover `groupId` a **obrigatório** no schema e remover a dupla-compat legada.
- Scope: Script de migração idempotente + flip do schema (`groupId` required) + remoção dos aceites legados de role (TASK-01/03/06). Deploy coordenado rules+functions+app.
- Main modules/files likely involved: `scripts/migrate-prd09.ts` (novo), `src/schemas/users.ts` (`groupId` required), `src/schemas/shared.ts` (remover legado), pontos de dupla-compat das TASK-03/06.
- Dependencies: TASK-01, TASK-03, TASK-05, TASK-06, TASK-10 (todas as superfícies prontas antes do corte).
- Story points: 5
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes (backfill idempotente; nenhum usuário fica sem `groupId`/role; rollback).
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: opus/high
- Notes: Stop-the-world de autorização (R1/R4). Rodar backfill ANTES de promover `groupId` obrigatório. Corte do legado só após backfill confirmado. Migração é a última task por design.

## 4. Dependency map

```
TASK-01 (role+groupId opt) ─┬─> TASK-03 ─┬─> TASK-04 ─┬─> TASK-05 ─> TASK-09
                            │            │            ├─> TASK-07
TASK-02 (pool schema) ──────┘            │            └─> TASK-08
                            │
TASK-01 ──────────────────> TASK-06 (authz migration)
TASK-01, TASK-02 ─────────> TASK-10 (recalc re-scope) ─┐
TASK-06 (claim groupId) ──────────────────────────────┴─> TASK-11 (read + rules isolation)
TASK-01,03,05,06,10 ──────> TASK-12 (backfill + corte legado)
```

- TASK-01 e TASK-02 são fundação e paralelizáveis.
- TASK-03 depende de 01+02.
- TASK-04 depende de 02+03; destrava 05/07/08/09.
- TASK-06 depende só de 01 (paralelizável com a trilha de pool).
- TASK-10 depende de 01+02; TASK-11 depende de 10 (layout) + 06 (claim `groupId` para a rule de isolamento).
- TASK-12 é o fechamento — depende de todas as superfícies (01,03,05,06,10).

## 5. Recommended execution order

1. **TASK-01** — Role enum dupla-compat + `groupId` opcional (fundação crítica)
2. **TASK-02** — Schema do pool
3. **TASK-03** — Rules + índices
4. **TASK-04** — Endpoints de pool (create/search/detail)
5. **TASK-05** — Endpoint admin de aprovação + seed
6. **TASK-06** — Migração de autorização
7. **TASK-07** — Seleção de grupo no signup
8. **TASK-08** — Frontend criar/confirmação
9. **TASK-09** — Frontend buscar/não-encontrado/detalhe
10. **TASK-10** — Re-scoping do recalc (pesado, isolado)
11. **TASK-11** — Leitura de ranking por pool
12. **TASK-12** — Migração/backfill + corte do legado (último)

## 6. Planning risks and blockers

- **Isolamento de ranking = segurança, não só app (TASK-11).** Sem a rule em `firestore.rules:97-99`, qualquer aprovado lê qualquer ranking — a ênfase central do PRD fica burlável. Por isso TASK-11 virou crítica/risco alto e exige claim `groupId` (TASK-06). Verificação de aceite do isolamento só fecha após TASK-11 + backfill (TASK-12).
- **TASK-10 (SP8, crítica)** — maior complexidade; coração da ênfase. A5 travada no plano (layout flat). Semântica travada: "participantes do pool ranqueados entre si", sem cross novo pool×grupo-de-torneio. Volume de writes em Spark (R6) — `BulkWriter`. Dividir em 10a/10b se estourar contexto.
- **TASK-06 + TASK-01 + TASK-12** — trilha de role é stop-the-world. Dupla-compat obrigatória; corte do legado só na TASK-12, pós-backfill. Erro = lockout (R1).
- **A6 (busca)** — slug exato + filtro client-side é o default MVP; confirmar no spec da TASK-04 se nome precisa server-side.
- **TASK-05 é pré-requisito de testabilidade** — sem aprovação `pending→active`, nenhum grupo fica ativo e a busca/detalhe (TASK-09) não tem dado real. Inclui troca de admin do pool (PRD §2.9).
- **Backfill (TASK-12)** — `groupId` obrigatório sem migração quebra parse de todos os usuários legados (R4). Ordem: backfill → flip required.
- **Recomendado TDD** em: 01, 02, 03, 04, 05, 06, 07, 10, 11, 12. Pulam TDD: 08, 09 (UI pura).
