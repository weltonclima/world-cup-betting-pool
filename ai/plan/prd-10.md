# PLAN — PRD-10 Administração de Grupo (Group Admin)

> Fonte: `ai/prd/prd-10.md` (+ 6 telas `docs/prd-10/*.png`, layout = fonte de verdade). Construído **sobre a PRD-09** (coleção `pools`, papéis `participant|group_admin|super_admin`, `user.groupId`, claim `groupId`, endpoints admin de pool).
> Princípio central: **isolamento por `groupId` é segurança, não app** — `user.groupId === resource.groupId` server-side em toda rota, `groupId` SEMPRE da sessão. **Reusa a infra de moderação existente (`src/features/admin`) — estende, não duplica.**
> Decisões travadas: D1=`pools`; D3=promover≡troca de admin (1 admin/pool); D4=excluir≡soft-delete; A1=rejeitar≡`blocked`; A3=novo link expira o anterior.

## 1. Planning summary

A PRD-10 entrega o painel de administração do **próprio** pool para o `group_admin`. Onde a PRD-09 montou a estrutura multi-tenant, a PRD-10 monta as **superfícies de moderação, configuração e convites** escopadas por `groupId`. O risco concentra-se em três pontos: (1) **isolamento por `groupId` nas rules+rotas** (um admin não pode tocar outro pool); (2) **promover-a-admin** (troca de admin, espelha PRD-09 mas iniciada por `group_admin`, não `super_admin`); (3) **unicidade de `code` de convite** (nova coleção `invites`). A sequência segue: fundação (schemas `invites` + campos net-new + rules/índices + helper de autorização escopado) → backend (dashboard + moderação + settings + convites) → frontend (6 telas) → wiring do menu.

13 tasks em 4 fases. Os pontos sensíveis (isolamento nas rules, promote, code uniqueness) ficam isolados, com review opus/high. As tasks de moderação **reusam** `useUpdateUserStatus`/`canTransition`/`notificationFactory` — não há reescrita do motor de status.

## 2. Recommended execution phases

- **Fase 1 — Fundação (schemas + rules + autorização escopada):** TASK-01, TASK-02, TASK-03
- **Fase 2 — Backend (dashboard + moderação + settings + convites):** TASK-04, TASK-05, TASK-06, TASK-07, TASK-08
- **Fase 3 — Frontend (telas PRD10-01..06):** TASK-09, TASK-10, TASK-11, TASK-12
- **Fase 4 — Wiring de navegação:** TASK-13

## 3. Tasks

### TASK-01 – Schema/types de `invites` + campos net-new em `pools` e `users`
- Type: domain
- Goal: Criar `inviteSchema`/`inviteInputSchema` (coleção `invites`: `{ id, groupId, code, label?, maxUses, usedCount, expiresAt, isActive, createdBy, createdAt }`); adicionar `maxParticipants?`/`allowInvites?` ao `poolSchema` (aditivos, não-strict-breaking); adicionar `blockReason?`/`removedFromGroupAt?` ao `userSchema`.
- Scope: Apenas contratos Zod + types + barrel. `code` slug curto (`^[A-Z0-9]{6}$` ou `[a-z0-9-]+`); validações de campo. Sem persistência, sem endpoints. Manter compat: campos opcionais → docs PRD-09 antigos continuam fazendo parse.
- Main modules/files likely involved: `src/schemas/invites.ts` (novo), `src/types/invites.ts` (novo), `src/schemas/pools.ts` (campos), `src/schemas/users.ts` (campos), `src/schemas/index.ts` (barrel), `src/schemas/__tests__/invites.test.ts`.
- Dependencies: nenhuma (fundação; reusa primitivos `shared.ts`).
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: yes (regex de `code`, `usedCount ≤ maxUses`, opcionalidade não quebra parse de pools/users antigos).
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: Aditivos por design (mesma disciplina do `updatedAt?` da PRD-09). `allowInvites` ausente = `true`; `maxParticipants` ausente = sem limite (definir defaults na leitura, não no schema).

### TASK-02 – Helper de autorização escopada ao pool (`authorizeGroupAdminOfPool`)
- Type: api
- Goal: Helper server-side que resolve o `groupId` do admin da **sessão** (`requireApprovedUser` → `users/{uid}.groupId`), exige `isGroupAdminRole || isSuperAdminRole`, e retorna `{ user, groupId }` ou `{ errorResponse }` (401/403). Base de **todas** as rotas `/api/group/*`.
- Scope: Um módulo `_authorize.ts` em `src/app/api/group/`. Espelha `authorizeGroupAdmin` (PRD-09) mas: (a) não usa secret de cron; (b) devolve o `groupId` resolvido para o caller filtrar recursos. Sem rotas ainda.
- Main modules/files likely involved: `src/app/api/group/_authorize.ts` (novo), reuso de `requireApprovedUser`, `getAdminFirestore`, `roleSchema`/`isGroupAdminRole`/`isSuperAdminRole`.
- Dependencies: nenhuma de PRD-10 (reusa PRD-09); paralelizável com TASK-01.
- Story points: 3
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes (sessão sem groupId; participant negado; group_admin de outro pool não escala; super_admin aceito).
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/medium
  - review: opus/high
- Notes: **Núcleo do isolamento.** `groupId` SÓ da sessão — nunca do body/query (D2). Erro aqui = vazamento entre pools. Normalizar role via `roleSchema.safeParse` antes dos helpers (preceito WR da PRD-09).

### TASK-03 – Firestore: rules + índices de `invites` e isolamento por `groupId`
- Type: infra
- Goal: Bloco de rules para `invites` (read de ativos por aprovados do **próprio** pool: `resource.data.groupId == request.auth.token.groupId`; write `if false` — só Admin SDK); índices de `invites`/`users` exigidos pelas telas.
- Scope: `firestore.rules` + `firestore.indexes.json`. Índices: `invites(groupId,isActive)`, `invites(groupId,createdAt)`, `invites(code)` (se code≠doc-id), `users(groupId,role)`. Reusa a claim `groupId` (PRD-09 TASK-06). Sem código de app.
- Main modules/files likely involved: `firestore.rules`, `firestore.indexes.json`.
- Dependencies: TASK-01 (schema reflete nas rules).
- Story points: 3
- Criticality: high
- Technical risk: high
- Recommended TDD later: yes (`npm run test:rules` — emulador: admin do pool X recebe deny em invite do pool Y; participant não escreve invite).
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: A claim `groupId` já é populada (PRD-09). Erro aqui = isolamento burlável no client (mesmo blocker que a PRD-09 levantou no ranking). `code` único: doc-id=code dispensa índice de busca; decidir no spec.

### TASK-04 – Route Handler: dashboard do grupo
- Type: api
- Goal: `GET /api/group/dashboard` — agrega contadores (participantes/pendentes/bloqueados/convites ativos) + "últimos cadastros" (N usuários recentes do pool com nome/data/status), todos filtrados por `groupId` da sessão.
- Scope: Route Handler + service de leitura + hook `useGroupDashboard`. Queries `users(groupId,status)` + `invites(groupId,isActive)`. Sem UI.
- Main modules/files likely involved: `src/app/api/group/dashboard/route.ts` (novo), `src/services/group.ts` (novo), `src/features/group/hooks/useGroupDashboard.ts`, `src/features/group/hooks/groupKeys.ts` (novo factory).
- Dependencies: TASK-01, TASK-02, TASK-03.
- Story points: 3
- Criticality: medium
- Technical risk: medium
- Recommended TDD later: yes (contadores corretos; isolamento — só conta o próprio pool; ordenação de últimos cadastros).
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: Cria o `groupKeys` factory (espelha `usersKeys`) reusado por todas as tasks de frontend. Contagem via `count()` aggregation se disponível em Spark; senão leitura paginada.

### TASK-05 – Route Handlers: moderação de usuários do pool (approve/reject/block/unblock/remove)
- Type: api
- Goal: `POST /api/group/users/{approve|reject|block|unblock|remove}` — transições de status escopadas ao pool: aprovar (`pending→approved`), rejeitar (`pending→blocked`), bloquear (`approved→blocked` + `blockReason`), desbloquear (`blocked→approved`), remover (soft-delete D4). Reusa `canTransition` + side-effects de moderação.
- Scope: Route Handlers + leitura de listas (`/api/group/users/{pending|approved|blocked}`). Cada rota valida `target.groupId === sessão.groupId` e que o alvo **não** é `super_admin`. Reusa `notificationFactory`/`createLog`/`createNotification`. Sem UI.
- Main modules/files likely involved: `src/app/api/group/users/*/route.ts` (novos), `src/services/group.ts`, reuso de `canTransition`/`moderationLog`/`moderationNotification` (`src/features/admin/lib`), hooks `useGroupUsers`/`useModerateGroupUser`.
- Dependencies: TASK-01, TASK-02, TASK-03, TASK-04 (groupKeys).
- Story points: 5
- Criticality: high
- Technical risk: high
- Recommended TDD later: yes (cada transição; isolamento por groupId; super_admin não-moderável; rejeitar≡blocked; soft-delete preserva doc).
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/medium
  - review: opus/high
- Notes: **Reusa o motor de status — não reescreve.** O hook espelha `useUpdateUserStatus` (validação `canTransition` na borda + invalidação origem/destino). A novidade é o escopo por pool e a proteção do super_admin. `blockReason` capturado no block.

### TASK-06 – Route Handler: promover a admin do pool (troca de admin)
- Type: api
- Goal: `POST /api/group/users/promote` — `group_admin` promove um participante **aprovado do próprio pool** a admin do grupo (D3: troca; admin anterior → `participant`). Wrapper escopado sobre a lógica de troca da PRD-09 (`PATCH /api/admin/groups/[id]/admin`), mas iniciado pelo admin do pool, não super_admin.
- Scope: Route Handler dedicado (ou reuso interno da transação de swap), forçando `id = sessão.groupId` e validando que o alvo é membro aprovado do pool e **não** super_admin. Hook `usePromoteGroupAdmin`. Sem UI.
- Main modules/files likely involved: `src/app/api/group/users/promote/route.ts` (novo), reuso da transação pool↔users (espelha `src/app/api/admin/groups/[id]/admin/route.ts`), `src/features/group/hooks/usePromoteGroupAdmin.ts`.
- Dependencies: TASK-01, TASK-02, TASK-05.
- Story points: 5
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes (promoção troca admin; anterior vira participant; super_admin nunca rebaixado; alvo de outro pool rejeitado; self-promote idempotente).
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/medium
  - review: opus/high
- Notes: **Maior risco de escalonamento.** O `group_admin` não pode usar este caminho para promover alguém de outro pool nem para tocar super_admin. Transação reads-before-writes (igual PRD-09 swap). A propagação da claim continua na função `syncRoleClaimOnUserUpdate` (PRD-09 TASK-06) — aqui só o campo `role`.

### TASK-07 – Route Handler: configurações do grupo (PATCH settings)
- Type: api
- Goal: `PATCH /api/group/settings` — atualiza `name`/`description`/`photoBase64`/`maxParticipants`/`allowInvites` do **próprio** pool. Valida via `poolSchema` (campos editáveis), descrição ≤160, foto ≤ teto base64.
- Scope: Route Handler (Admin SDK) + hook `useUpdateGroupSettings`. Apenas o pool da sessão; `status`/`adminId`/`slug` não editáveis aqui. Sem UI.
- Main modules/files likely involved: `src/app/api/group/settings/route.ts` (novo), `src/services/group.ts`, `src/features/group/hooks/useUpdateGroupSettings.ts`.
- Dependencies: TASK-01, TASK-02.
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD later: yes (partial update; rejeita campos imutáveis; limite de descrição/foto; isolamento).
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: Reusa o limite de foto base64 (`MAX_POOL_PHOTO_BASE64_LENGTH`) e a compressão client-side (PRD-06/09). Não permitir trocar `slug` (impacto em links existentes).

### TASK-08 – Route Handlers: convites (create / list / revoke) + unicidade de `code`
- Type: api
- Goal: `POST /api/group/invites` (gera `code` único, valida `allowInvites`, define `expiresAt`/`maxUses`, expira anterior — A3), `GET /api/group/invites` (ativos do pool), `PATCH|DELETE /api/group/invites/[id]` (revoga, `isActive=false`).
- Scope: Route Handlers + service + hooks. Unicidade de `code` via doc-id=code **ou** checagem transacional (espelha unicidade de slug, PRD-09 TASK-04). Sem redenção no signup (A2 — fora desta task). Sem UI.
- Main modules/files likely involved: `src/app/api/group/invites/route.ts` + `.../invites/[id]/route.ts` (novos), `src/services/group.ts`, `src/features/group/hooks/useGroupInvites.ts`/`useCreateInvite.ts`.
- Dependencies: TASK-01, TASK-02, TASK-03, TASK-07 (`allowInvites`).
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes (code único — race entre duas gerações; respeita allowInvites=false; expira anterior; isolamento por groupId).
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: `code` curto e não-adivinhável; gerar server-side, nunca aceitar do client. doc-id=code resolve unicidade sem índice e simplifica redenção futura (A2). Vigiar cota Spark de writes (baixa aqui).

### TASK-09 – Frontend: Dashboard do Grupo (PRD10-01)
- Type: application
- Goal: Tela de visão geral — header com foto+nome do pool, 4 cards (Participantes/Pendentes/Bloqueados/Convites Ativos), "Últimos Cadastros" (avatar/nome/data/status badge + "Ver todos"), "Ações Rápidas" (Pendentes/Convites/Configurações).
- Scope: Componentes + rota App Router + integração com `useGroupDashboard`. Estados loading/empty/error padronizados. Sem moderação (TASK-10).
- Main modules/files likely involved: `src/app/group/dashboard/page.tsx` (novo), `src/features/group/components/GroupDashboard.tsx` + cards, reuso de `Badge`/skeletons.
- Dependencies: TASK-04.
- Story points: 5
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (UI; agregação coberta na TASK-04).
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: `is_frontend: true` → `/ui-spec` + `/patterns:nextjs`. **PNG = fonte de verdade** (cards 2×2 mobile; "Convites Ativos" e ações "Pendentes/Convites/Configurações" — não o texto). Mobile-first 360/390/430.

### TASK-10 – Frontend: Usuários Pendentes (PRD10-02) + Aprovados (PRD10-03) + Bloqueados (PRD10-04)
- Type: application
- Goal: Três telas de moderação. Pendentes: busca+filtro, cards com ✓/✗ inline, contador. Aprovados: busca+filtro, tabs Todos/Participantes/Admins, lista ranqueada (posição/pts/lugar) com kebab (Bloquear/Promover). Bloqueados: busca+filtro, cards com Motivo/data + Desbloquear (+ Excluir em overflow).
- Scope: Componentes + rotas + integração com `useGroupUsers`/`useModerateGroupUser`/`usePromoteGroupAdmin`. Reusa `ConfirmActionDialog`/`UserListItem`-família (admin existente). Estados loading/empty/error. Dialog de motivo no bloqueio.
- Main modules/files likely involved: `src/app/group/usuarios/{pendentes,aprovados,bloqueados}/page.tsx` (novos), `src/features/group/components/*`, **reuso** de `src/features/admin/components` (UserList/UserListItem/ConfirmActionDialog) parametrizados.
- Dependencies: TASK-05, TASK-06.
- Story points: 8
- Criticality: high
- Technical risk: medium
- Recommended TDD later: no (UI; transições/isolamento cobertos em TASK-05/06). Exceção: testar o gating "super_admin não exibe Bloquear/Rebaixar" se a lógica viver no client.
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: `is_frontend: true` → `/ui-spec` + `/patterns:nextjs`. **PNG = fonte de verdade**: tabs Todos/Participantes/Admins (PRD10-03), pts/lugar, kebab, "Motivo:" (PRD10-04). **Reusar a família admin — não recriar listas.** Avaliar dividir em 10a (pendentes/bloqueados) e 10b (aprovados c/ tabs+ranking) se o contexto estourar.

### TASK-11 – Frontend: Configurações do Grupo (PRD10-05)
- Type: application
- Goal: Formulário de edição — Nome*, Descrição (contador NN/160), Foto (preview + "Alterar foto" + compressão), Limite de participantes, toggle "Permitir convites", botão "Salvar alterações".
- Scope: Componente + rota + integração com `useUpdateGroupSettings`. Reusa compressão de avatar (PRD-06) para a foto. Validação inline + toast. Sem convites (TASK-12).
- Main modules/files likely involved: `src/app/group/configuracoes/page.tsx` (novo), `src/features/group/components/GroupSettingsForm.tsx`, reuso do utilitário de compressão de imagem + `Switch`/`Textarea`.
- Dependencies: TASK-07.
- Story points: 5
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (UI; validação de campo coberta em TASK-01/07).
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: `is_frontend: true` → `/ui-spec` + `/patterns:nextjs`. PNG: contador 63/160, "PNG, JPG até 2MB" (teto de entrada), toggle com subtítulo. Reusar padrão de foto base64.

### TASK-12 – Frontend: Convites (PRD10-06)
- Type: application
- Goal: Tela de convites — tabs Link/Código, campo read-only do link + copiar + "Compartilhar link" (Web Share API), card "Configurações do convite" (Validade/Limite/Usos atuais), "Gerar novo link", card "Convites ativos" (+ "Ver todos").
- Scope: Componente + rota + integração com `useGroupInvites`/`useCreateInvite`. Respeita `allowInvites` (bloqueia geração se off). Copiar via Clipboard API; compartilhar via `navigator.share` com fallback. Estados loading/empty/error.
- Main modules/files likely involved: `src/app/group/convites/page.tsx` (novo), `src/features/group/components/GroupInvites.tsx` + tabs/cards.
- Dependencies: TASK-08.
- Story points: 5
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (UI; unicidade/regras cobertas em TASK-08).
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: `is_frontend: true` → `/ui-spec` + `/patterns:nextjs`. PNG: "Usos atuais" (de `usedCount`), tabs Link/Código, "Gerar novo link". Desabilitar geração quando `allowInvites=false`.

### TASK-13 – Wiring: seção "Administração do Grupo" no ProfileHub (role-gated)
- Type: application
- Goal: Adicionar ao `ProfileHub` uma seção **"Administração do Grupo"** visível quando `isGroupAdminRole(role) || isSuperAdminRole(role)`, com `ProfileMenuItem`s para as 6 telas (Dashboard/Pendentes/Aprovados/Bloqueados/Configurações/Convites). Corrigir o gate legado `role === "admin"`.
- Scope: Editar `ProfileHub.tsx`; usar os helpers de role normalizados (não string crua). Sem novas telas (as rotas vêm das TASK-09..12).
- Main modules/files likely involved: `src/features/profile/components/ProfileHub.tsx`, reuso de `ProfileMenuItem`, ícones lucide, helpers `isGroupAdminRole`/`isSuperAdminRole`.
- Dependencies: TASK-09, TASK-10, TASK-11, TASK-12 (rotas existem).
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (UI/wiring; visibilidade simples — cobrir com 1 teste de render por papel se trivial).
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: `is_frontend: true`. **Requisito de projeto: todas as telas alcançáveis daqui.** Normalizar role via `roleSchema` antes dos helpers (o ProfileHub atual usa `role === "admin"` — atualizar para dupla-compat via helpers).

## 4. Dependency map

```
TASK-01 (schemas invites + campos) ─┬─> TASK-03 (rules/índices) ─┐
TASK-02 (authz escopada) ───────────┤                            │
                                    ├─> TASK-04 (dashboard) ──────┼─> TASK-09 (UI dashboard) ─┐
                                    ├─> TASK-05 (moderação) ──────┤                           │
TASK-05 ──────────────────────────> TASK-06 (promote) ───────────┼─> TASK-10 (UI moderação) ─┤
TASK-01,02 ───────────────────────> TASK-07 (settings) ──────────┼─> TASK-11 (UI settings) ──┤
TASK-01,02,03,07 ─────────────────> TASK-08 (invites) ───────────┴─> TASK-12 (UI convites) ──┴─> TASK-13 (menu)
```

- TASK-01 e TASK-02 são fundação e paralelizáveis.
- TASK-03 depende de 01.
- TASK-04 destrava o `groupKeys` reusado por todo o frontend; depende de 01+02+03.
- TASK-05 destrava 06 e 10; TASK-07 destrava 08 (`allowInvites`) e 11.
- TASK-13 é o fechamento — depende de todas as telas existirem (09..12).

## 5. Recommended execution order

1. **TASK-01** — Schemas `invites` + campos net-new (fundação)
2. **TASK-02** — Autorização escopada ao pool (núcleo do isolamento)
3. **TASK-03** — Rules + índices de `invites`
4. **TASK-04** — Dashboard (route + groupKeys)
5. **TASK-05** — Moderação de usuários (reusa motor de status)
6. **TASK-06** — Promover a admin (troca de admin)
7. **TASK-07** — Configurações do grupo (settings)
8. **TASK-08** — Convites (create/list/revoke + code único)
9. **TASK-09** — Frontend Dashboard (PRD10-01)
10. **TASK-10** — Frontend Moderação (PRD10-02/03/04)
11. **TASK-11** — Frontend Configurações (PRD10-05)
12. **TASK-12** — Frontend Convites (PRD10-06)
13. **TASK-13** — Wiring do menu de perfil

## 6. Planning risks and blockers

- **Isolamento por `groupId` = segurança (TASK-02 + TASK-03 + TASK-05/06).** O `groupId` vem SEMPRE da sessão; toda rota valida `resource.groupId === sessão.groupId`; as rules de `invites` exigem `groupId == request.auth.token.groupId`. Sem isso, um `group_admin` modera/lê outro pool — vazamento multi-tenant. Verificação de aceite do isolamento só fecha com `test:rules` (TASK-03) + testes de rota (TASK-05/06).
- **Promover-a-admin (TASK-06, crítica/risco alto)** — maior risco de escalonamento. O `group_admin` não pode promover alguém de outro pool nem tocar `super_admin`. Transação reads-before-writes (espelha PRD-09 swap). Default travado: 1 admin/pool (troca).
- **Unicidade de `code` de convite (TASK-08)** — race entre duas gerações simultâneas. Mitigar com doc-id=code (cria-se-ou-falha) ou transação. `code` gerado server-side, não-adivinhável.
- **Reuso da infra de moderação (TASK-05/TASK-10)** — `useUpdateUserStatus`/`canTransition`/`notificationFactory`/`ConfirmActionDialog`/família `UserList` já existem (PRD-07/08). Estender e parametrizar — **não recriar** (gold-plating + drift).
- **Mapeamento `rejected≡blocked` (A1)** — a infra usa `pending|approved|blocked`. Manter "rejeitar" na UI mas gravar `blocked`. Não introduzir status novo.
- **Campos net-new aditivos (TASK-01)** — `maxParticipants`/`allowInvites`/`blockReason` opcionais; pools/users da PRD-09 continuam fazendo parse. Defaults na leitura, não no schema.
- **Recomendado TDD** em: 01, 02, 03, 04, 05, 06, 07, 08. Pulam TDD: 09, 10, 11, 12 (UI pura — lógica já coberta no backend), 13 (wiring; 1 teste de render por papel se trivial).
```
