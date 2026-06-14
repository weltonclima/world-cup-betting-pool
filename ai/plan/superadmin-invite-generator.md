# PLAN — Super Admin: Gerador de Convite por Grupo

> PRD: `ai/prd/superadmin-invite-generator.md`. Escopo mínimo: APENAS GERAR.
> Decisões travadas: (1) exportar `InviteValue`+`inviteUrl`; (2) só gerar (sem listar/revogar); (3) omitir `label`; (4) auditoria em `system_logs`.

## 1. Planning summary

Feature pequena, dependência quase linear. O núcleo é o novo Route Handler `POST /api/admin/groups/[id]/invites` (espelha a lógica de `POST /api/group/invites` trocando autorização para `authorizeGroupAdmin()` global e lendo `groupId` do param de URL, + auditoria). As demais tasks são camadas finas em torno dele: schema (1 linha no enum), serviço, hook, UI. Total 5 tasks. Risco concentrado na TASK-02 (lógica de negócio do endpoint: `allowInvites`, geração de código, expiração A3, auditoria).

## 2. Recommended execution phases

- **Phase 1 – foundation:** TASK-01 (schema enum) + TASK-02 (Route Handler).
- **Phase 2 – data access:** TASK-03 (serviço + hook).
- **Phase 3 – exposure/UI:** TASK-04 (export sub-componentes) + TASK-05 (Dialog + KebabMenu).

## 3. Tasks

### TASK-01 – Adicionar tipo de log `group_invite_created` ao enum
- Type: domain
- Goal: Permitir auditoria da geração de convite pelo super_admin.
- Scope: Adicionar `"group_invite_created"` ao `systemLogTypeSchema` (append-only, sem remover existentes). Atualizar `__tests__` do schema se cobrir o enum.
- Main modules/files likely involved: `src/schemas/systemLogs.ts`, `src/schemas/__tests__/systemLogs.test.ts` (se existir).
- Dependencies: nenhuma.
- Story points: 1
- Criticality: low
- Technical risk: low
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: Mudança aditiva trivial. Sem migração — enum só ganha membro. Boilerplate de schema (TDD não se aplica).

### TASK-02 – Route Handler `POST /api/admin/groups/[id]/invites`
- Type: api
- Goal: Endpoint que permite super_admin gerar convite para qualquer pool, identificado pelo `[id]` da URL, com auditoria.
- Scope: Criar `src/app/api/admin/groups/[id]/invites/route.ts`. Autorizar via `authorizeGroupAdmin(request)`. `groupId = params.id`. Verificar `poolSnap.exists` (404) e `pool.allowInvites !== false` (409). Gerar `code` (alfabeto sem ambíguos, retry colisão 5x), criar `invites/{code}`, expirar ativos anteriores do pool (A3). Gravar `writeAuditLog({ type: "group_invite_created", actorUid, message })` best-effort. Retornar `{ invite }` 201. Body schema `{ maxUses, validityDays }` (sem `label`).
- Main modules/files likely involved: `src/app/api/admin/groups/[id]/invites/route.ts` (novo), reuso de `authorizeGroupAdmin` (`_authorize.ts`), `writeAuditLog`, `inviteSchema`, `poolSchema`, `getAdminFirestore`.
- Dependencies: TASK-01 (tipo de log).
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: opus/high
- Notes: Núcleo da feature. Lógica espelhada de `POST /api/group/invites` — NÃO abstrair em shared util (os endpoints diferem em autorização/escopo). Risco médio: ordem create→expira (A3) deve preservar invariante "nunca 0 links ativos". Criticality high (write multi-tenant via Admin SDK). **Next 15: `params` é Promise** — usar `const { id } = await ctx.params`. **Códigos completos a espelhar:** 400 (JSON malformado), 422 (body inválido via `safeParse`), 403 (não-super_admin), 404 (pool inexistente), 409 (`allowInvites=false` E colisão de code — mensagens distintas), 201 (sucesso). TDD: `allowInvites=false`→409, pool inexistente→404, super_admin sem sessão→403, body inválido→422, formato de resposta 201, expiração de anteriores.

### TASK-03 – Serviço + hook React Query
- Type: application
- Goal: Camada de acesso client → endpoint, com invalidação de cache isolada do namespace group_admin.
- Scope: Adicionar `createAdminGroupInvite(poolId, input)` em `src/services/superAdmin.ts` (POST same-origin, mapeia erros → `GroupServiceError`-like ou erro local pt-BR). Adicionar `useCreateAdminGroupInvite(poolId)` em `src/features/superAdmin/hooks/useAdminGroups.ts`. Chave própria se necessário (não invalida queries do group_admin).
- Main modules/files likely involved: `src/services/superAdmin.ts`, `src/features/superAdmin/hooks/useAdminGroups.ts`, `src/features/superAdmin/hooks/superAdminKeys.ts`, `hooks/index.ts` (barrel).
- Dependencies: TASK-02.
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: Wiring de dados. Mutation não precisa invalidar lista (escopo só-gerar não lista). Mapear erros HTTP→pt-BR via `SuperAdminServiceError`/`HTTP_ERROR_MESSAGES` já existente (cobre 400/403/404/409/422 — sem trabalho extra). **Re-exportar `useCreateAdminGroupInvite` no barrel `src/features/superAdmin/hooks/index.ts`** (componentes importam de `@/features/superAdmin/hooks`).

### TASK-04 – Exportar sub-componentes de convite reusáveis
- Type: refactor-support
- Goal: Tornar `InviteValue` + helper `inviteUrl` reutilizáveis fora de `GroupInvites.tsx`.
- Scope: Adicionar `export` a `InviteValue` e `inviteUrl` em `src/features/groupAdmin/components/GroupInvites.tsx` (ou extrair para arquivo dedicado se ficar mais limpo). Sem mudar comportamento. Garantir que o uso existente continua funcionando.
- Main modules/files likely involved: `src/features/groupAdmin/components/GroupInvites.tsx` (possível novo `InviteValue.tsx`).
- Dependencies: nenhuma (paralelizável com TASK-01/02/03).
- Story points: 1
- Criticality: low
- Technical risk: low
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/medium
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: Refactor puro, sem mudança de comportamento. Se a extração para arquivo dedicado for trivial, preferir — evita import cruzado feature→feature (groupAdmin←superAdmin). Avaliar mover `InviteValue` para `src/components/` compartilhado.

### TASK-05 – Dialog + ação no KebabMenu de Grupos Ativos
- Type: application
- Goal: UI que expõe a geração de convite no grid de grupos ativos do super_admin.
- Scope: Criar `src/features/superAdmin/components/AdminGroupInviteDialog.tsx` — form (validade + limite de usos, validação client espelhando 1..365 / ≥1), aviso `allowInvites=false`, estado pós-geração exibindo link+código (reusa `InviteValue`/`inviteUrl` da TASK-04), loading/erro via `useCreateAdminGroupInvite`. Adicionar ação "Gerar convite" (ícone `Link`) ao `KebabMenu` em `GroupsActive.tsx` + estado `inviteOpen` por `ActiveRow`.
- Main modules/files likely involved: `src/features/superAdmin/components/AdminGroupInviteDialog.tsx` (novo), `src/features/superAdmin/components/GroupsActive.tsx`.
- Dependencies: TASK-03, TASK-04.
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: is_frontend: true → aciona /ui-spec + /patterns:nextjs + /ui-review. `AdminPoolRow.allowInvites` **já existe** (confirmado plan-checker) → aviso "convites desativados" é client-side direto, sem depender do 409. Dialog modal (não sai da tela).

## 4. Dependency map

```
TASK-01 (schema) ─┐
                  ├─→ TASK-02 (endpoint) ─→ TASK-03 (serviço+hook) ─┐
                                                                     ├─→ TASK-05 (Dialog+menu)
TASK-04 (export sub-comp) ───────────────────────────────────────── ┘
```

- TASK-01 bloqueia TASK-02 (tipo de log usado na auditoria).
- TASK-02 bloqueia TASK-03.
- TASK-03 + TASK-04 bloqueiam TASK-05.
- TASK-04 independente — paralelizável a qualquer momento.

## 5. Recommended execution order

1. **TASK-01** — schema enum (foundation, destrava auditoria).
2. **TASK-02** — Route Handler (núcleo, maior risco).
3. **TASK-03** — serviço + hook.
4. **TASK-04** — export sub-componentes (pode rodar antes/paralelo).
5. **TASK-05** — Dialog + KebabMenu (fecha a UI).

## 6. Planning risks and blockers

- **TASK-02** é o ponto de maior risco: replicar fielmente a invariante A3 (nunca deixar pool com 0 links ativos) e a verificação `allowInvites`. Deve usar TDD. Review em opus/high.
- **TASK-05**: `AdminPoolRow.allowInvites` já disponível — aviso "convites desativados" client-side direto (incerteza removida pelo plan-checker).
- **TASK-04** pode evoluir para mover `InviteValue` a `src/components/` compartilhado para evitar import cruzado superAdmin→groupAdmin. Decidir na spec da task.
- Sem blockers externos. Nenhuma dependência de clarificação pendente (todas resolvidas).

---

**plan-checker:** rodado abaixo (5 tasks, TASK-02 criticality high → gate aciona).
