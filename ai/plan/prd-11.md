# PLAN — PRD-11 Super Admin (administração global da plataforma)

> Fonte: `ai/prd/prd-11.md`. PNGs = fonte de verdade (PNG vence o texto). Decisões travadas: B1=rejeitar→`blocked`, B2=excluir→soft-delete, B3=remover admin→rebaixa a `participant`, B4=3 filtros server-side (PNG), B5=adotar rotas `[id]` da PRD-09, B6=`live` só via edição manual.
> Construído sobre PRD-09 (entregue): papéis, `pools`, `authorizeGroupAdmin`, `PATCH /status`, `PATCH /admin`, copaData, `system_logs`. **Reaproveitar antes de criar.**
> Maiores frentes de risco isoladas: **sync OpenFootball→Firestore com proteção de override + cotas Spark** e **edição manual de partidas**. Task-by-task com review opus/high nas tasks críticas.

## 1. Planning summary

A PRD-11 entrega a área administrativa global do Super Admin: UI sobre o backend de pool já existente (PRD-09) + quatro frentes net-new (dashboard agregado, sync de matches para Firestore, edição manual de partidas, logs globais). O plano isola o **sync** (1ª persistência de `matches`, proteção de `isManualOverride`, cotas Spark via `BulkWriter`) e a **edição manual** (refinement placar↔status) como as tasks mais pesadas, e maximiza reuso das rotas `PATCH /status` e `PATCH /admin` da PRD-09 — as telas de grupo são camadas de UI sobre elas, não novo backend.

14 tasks em 5 fases. A fundação (schemas de match estendido + sync_logs + rules/índices) precede o backend (dashboard, listagens, sync, edição, logs), que precede o frontend (telas PRD11-0X) e o wiring do menu de perfil.

## 2. Recommended execution phases

- **Fase 1 — Fundação (schemas + rules + índices):** TASK-01, TASK-02, TASK-03
- **Fase 2 — Backend de dados global (reuso + agregação):** TASK-04, TASK-05
- **Fase 3 — Backend da Copa (sync + edição — pesado):** TASK-06, TASK-07
- **Fase 4 — Frontend (telas PRD11-0X):** TASK-08, TASK-09, TASK-10, TASK-11, TASK-12, TASK-13
- **Fase 5 — Wiring do menu de perfil + gate:** TASK-14

## 3. Tasks

### TASK-01 – Extensão do `matchSchema` (campos de edição + `isManualOverride`)
- Type: domain
- Goal: Estender `matchSchema` com `editedBy: string|null`, `editedAt: ISO|null`, `isManualOverride: boolean (default false)`, `syncedAt: ISO?`; preservar o refinement existente placar↔status. Helper de "match é editável/protegido".
- Scope: Apenas contrato Zod + types. Sem persistência, sem rota. Manter compat com `MatchWithId` do mapper (campos novos opcionais na saída do mapper).
- Main modules/files likely involved: `src/schemas/matches.ts`, `src/types/matches.ts`, `src/schemas/__tests__/matches.test.ts`.
- Dependencies: nenhuma (fundação).
- Story points: 2
- Criticality: high
- Technical risk: low
- Recommended TDD later: yes (default de `isManualOverride`; refinement preservado; parse de match sem os campos novos não pode quebrar — o mapper não os emite).
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: `mapOpenFootballMatch` continua válido (campos novos opcionais). Não quebrar `worldcup/groups|bracket` que consomem `MatchWithId`.

### TASK-02 – Schema `syncLog` + extensão do `systemLogType`
- Type: domain
- Goal: Criar `syncLogSchema` (coleção `sync_logs`): `{ id, executedBy, executedAt, matchesUpdated, matchesSkipped, teamsUpdated, groupsUpdated, status: success|partial|error, message }`. Estender `systemLogTypeSchema` com `worldcup_synced|match_edited|group_approved|group_rejected|group_blocked|group_reactivated|pool_admin_changed`.
- Scope: Schema + types + barrel. Sem persistência. Estender o enum sem remover os tipos da PRD-07 (append-only).
- Main modules/files likely involved: `src/schemas/syncLogs.ts` (novo), `src/types/syncLogs.ts` (novo), `src/schemas/systemLogs.ts` (enum), `src/schemas/index.ts`, `src/schemas/__tests__/*`.
- Dependencies: nenhuma (paralelizável com TASK-01).
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: yes (enum estendido aceita tipos novos e os antigos; `matchesSkipped` obrigatório).
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: Estender, não duplicar `system_logs`. `sync_logs` é separado por carregar o resumo numérico (painel PRD11-06/10).

### TASK-03 – Firestore: rules + índices de `matches` e `sync_logs`
- Type: infra
- Goal: Bloco de rules para `matches` (`read: isApproved()`, `write: if false` — só Admin SDK) e `sync_logs` (`read: isSuperAdmin()`, `write: if false`); índices para filtros e listagens.
- Scope: `firestore.rules` + `firestore.indexes.json`. Sem código de app. Reusar helpers `isSuperAdmin()`/`isApproved()` da PRD-09.
- Main modules/files likely involved: `firestore.rules`, `firestore.indexes.json` (`pools(status,createdAt desc)`, `matches(stage,kickoffAt)`, `matches(groupId,kickoffAt)`, `matches(status,kickoffAt)`, `sync_logs(executedAt desc)`, `system_logs(type,createdAt desc)`).
- Dependencies: TASK-01, TASK-02 (contratos para refletir nas rules).
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes (`npm run test:rules` — emulador: aprovado lê match, não-super_admin não lê sync_logs).
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: Dupla-compat `admin||super_admin` nas rules (herdada da PRD-09). Confirmar índice composto de `system_logs` cobre os tipos novos.

### TASK-04 – Backend: estatísticas globais do dashboard + listagens de grupo por status
- Type: api
- Goal: `GET /api/admin/dashboard` (counts de pools por status, total users, total predictions, total matches, última sync do `sync_logs`); `GET /api/admin/groups?status=` (lista pools por status p/ PRD11-02/03/04).
- Scope: Route Handlers + service de leitura + hooks React Query. Usar `count()` aggregation queries (Spark) para counts. Reusar `authorizeGroupAdmin`. Sem UI.
- Main modules/files likely involved: `src/app/api/admin/dashboard/route.ts` (novo), `src/app/api/admin/groups/route.ts` (novo GET), `src/services/adminDashboard.ts` (novo), `src/features/admin/hooks/*` (novo slice), `src/server/firebaseAdmin`.
- Dependencies: TASK-03.
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes (agregação de counts; filtro por status; última sync ausente → null gracioso).
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: R3 — counts globais caros no Spark; preferir `count()` aggregation a varrer coleções. `["admin-dashboard"]`, `["admin-groups", status]`.

### TASK-05 – Backend: lista de administradores + DELETE (soft) de grupo + logging das ações de grupo
- Type: api
- Goal: `GET /api/admin/admins` (group_admins: nome, grupo, desde); `DELETE /api/admin/groups/[id]` (soft-delete `deletedAt`, B2); **instrumentar logging** (`system_logs`) nas rotas `PATCH /status` e `PATCH /admin` existentes (group_approved/rejected/blocked/reactivated, pool_admin_changed).
- Scope: Rota admins + rota DELETE + chamadas `createLog` nas transições de pool (reuso das rotas PRD-09 sem reescrever a transação). "Remover" admin (B3) = reusar a meia-transação de `PATCH /admin` (rebaixa a `participant`).
- Main modules/files likely involved: `src/app/api/admin/admins/route.ts` (novo), `src/app/api/admin/groups/[id]/route.ts` (DELETE, novo), `src/app/api/admin/groups/[id]/status/route.ts` + `.../admin/route.ts` (adicionar log), `src/services/systemLogs.ts` (reuso `createLog`).
- Dependencies: TASK-02 (tipos de log), TASK-03, TASK-04.
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes (soft-delete não some users.groupId; log emitido por ação; remoção de admin rebaixa a participant).
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: Logging é best-effort (não derruba a ação de negócio — padrão `createLog`). `["admin-admins"]`. Soft-delete preserva integridade de ranking/groupId.

### TASK-06 – Backend: sincronização OpenFootball → Firestore (proteção de override + BulkWriter)
- Type: integration
- Goal: `POST /api/admin/worldcup/sync` — fetch openfootball (`fetchAllMatches`/`fetchAllTeams`), normaliza (mapper existente), **lê os matches existentes** para montar set de `isManualOverride`, escreve `matches/{buildMatchId}` via `BulkWriter` **pulando os overrides**, grava `sync_logs` (matchesUpdated/Skipped/teamsUpdated/groupsUpdated/status) + `system_logs` (`worldcup_synced`).
- Scope: Route Handler + service de sync. Read-before-write por doc (ou um read em lote dos overrides). `BulkWriter` p/ cotas Spark (R1). Reusar `authorizeGroupAdmin`. Sem UI.
- Main modules/files likely involved: `src/app/api/admin/worldcup/sync/route.ts` (novo), `src/server/worldcup/sync.ts` (novo), reuso `src/server/copaData/*` (`fetchAllMatches`, `fetchAllTeams`, `buildMatchId`, `mapOpenFootballMatch`), `src/server/firebaseAdmin` (BulkWriter), `createLog`.
- Dependencies: TASK-01 (`isManualOverride` no schema), TASK-02 (`sync_logs`), TASK-03 (rules/índices).
- Story points: 8
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes (override NÃO sobrescrito; contagem skipped correta; idempotência — 2ª sync não duplica; falha parcial → status partial; cota/BulkWriter).
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Notes: **Item mais pesado (R1).** É a 1ª persistência de `matches` no Firestore — hoje só há `worldcup_cache` (computado). Ler overrides existentes UMA vez (um `get` da coleção ou query `isManualOverride==true`), montar `Set<matchId>`, escrever só os não-protegidos. `BulkWriter` obrigatório (R6/Spark). Não tocar `worldcup_cache` (rotas `worldcup/*` seguem independentes).

### TASK-07 – Backend: edição manual de partida (`PUT /api/admin/matches/[id]`) + listagem filtrada
- Type: api
- Goal: `PUT /api/admin/matches/[id]` — edita `homeScore/awayScore/status/venue/kickoffAt`, seta `isManualOverride: true`, `editedBy`, `editedAt`, respeitando o refinement placar↔status; + log `match_edited`. `GET /api/admin/matches?group=&stage=&status=` (lista filtrada p/ PRD11-07).
- Scope: 2 Route Handlers + service. Transação read+validate+write. Reusar `matchSchema` (refinement). Reusar `authorizeGroupAdmin`. Sem UI.
- Main modules/files likely involved: `src/app/api/admin/matches/[id]/route.ts` (PUT, novo), `src/app/api/admin/matches/route.ts` (GET, novo), `src/services/adminMatches.ts` (novo), `src/features/admin/hooks/*`, `createLog`.
- Dependencies: TASK-01, TASK-03, TASK-06 (matches já persistidos para editar).
- Story points: 5
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes (refinement: finished exige placares; override setado; editedBy/editedAt gravados; 404 match inexistente; status inválido → 422).
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Notes: **2º item mais sensível (R2).** Edição é o que blinda o match do sync (TASK-06). Validar placar↔status pelo schema; nunca gravar doc inválido. `["admin-matches", filtros]`.

### TASK-08 – Frontend: Dashboard Global (PRD11-01) + Sincronização (PRD11-06)
- Type: application
- Goal: Dashboard com cards KPI (Grupos Ativos/Pendentes, Participantes, Administradores, Jogos, Última Sincronização), painel "Última Sincronização" + "Sincronizar agora", feed "Atividade Recente" (+"Ver todos"); tela de sincronização (fonte OpenFootball, "Ver repositório", painel da última sync, botão "Sincronizar agora").
- Scope: Componentes + integração `["admin-dashboard"]`, `["admin-logs"]` (preview), `["admin-sync"]` (mutation). Estados loading/empty/error. Sem backend novo.
- Main modules/files likely involved: `src/features/admin/components/AdminDashboard.tsx`, `SyncPanel.tsx`, rotas App Router (`/admin/dashboard`, `/admin/copa/sync`).
- Dependencies: TASK-04, TASK-06.
- Story points: 5
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (UI; lógica já coberta em 04/06).
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: `is_frontend: true` → `/ui-spec` + `/patterns:nextjs`. PNGs fonte de verdade (cards 2-col mobile; "Sincronizar agora" dispara mutation com loading/disabled).

### TASK-09 – Frontend: Grupos Pendentes (PRD11-02) + Ativos (PRD11-03) + Bloqueados (PRD11-04)
- Type: application
- Goal: 3 listas de grupo por status com busca/filtro; ações por linha — Pendentes: ✓Aprovar/✗Rejeitar; Ativos: Visualizar/Bloquear/Alterar Admin; Bloqueados: Reativar/Excluir.
- Scope: Componentes + integração `["admin-groups", status]` + mutations sobre `PATCH /status`, `PATCH /admin`, `DELETE`. Confirmações para ações destrutivas. Sem backend novo (reuso PRD-09 + TASK-05).
- Main modules/files likely involved: `src/features/admin/components/GroupsPending.tsx`, `GroupsActive.tsx`, `GroupsBlocked.tsx`, `ChangeAdminDialog.tsx`, rotas App Router (`/admin/grupos/{pendentes,ativos,bloqueados}`).
- Dependencies: TASK-04, TASK-05.
- Story points: 5
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (UI; transições já cobertas em PRD-09 + TASK-05).
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: `is_frontend: true` → `/ui-spec` + `/patterns:nextjs`. PNG: ✓ verde / ✗ vermelho em Pendentes; badges "Ativo"/"Bloqueado". Rejeitar→blocked (B1); Excluir→soft-delete (B2). Invalidar `admin-dashboard` após mutação.

### TASK-10 – Frontend: Administradores (PRD11-05)
- Type: application
- Goal: Lista de group_admins (avatar, nome, "Grupo: X", "Desde dd/MM/yyyy") com busca/filtro; ações Substituir/Remover/Transferir Grupo.
- Scope: Componentes + integração `["admin-admins"]` + mutations sobre `PATCH /admin`. Seletor de membro do pool para substituir/transferir. Sem backend novo.
- Main modules/files likely involved: `src/features/admin/components/AdminsList.tsx`, `TransferGroupDialog.tsx`, rota `/admin/administradores`.
- Dependencies: TASK-05.
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (UI; troca já coberta em PRD-09 + TASK-05).
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: `is_frontend: true` → `/ui-spec` + `/patterns:nextjs`. Remover = rebaixa a participant (B3).

### TASK-11 – Frontend: Jogos da Copa (PRD11-07)
- Type: application
- Goal: Lista de partidas agrupada por dia (Hoje/Amanhã) com 3 filtros (grupo/fase/status — PNG); card com bandeiras, horário, data, fase+rodada, estádio, status badge; ações Visualizar/Editar.
- Scope: Componentes + integração `["admin-matches", filtros]`. 3 dropdowns server-side; "Seleção" como busca client opcional (B4). Sem backend novo (TASK-07 GET).
- Main modules/files likely involved: `src/features/admin/components/MatchesList.tsx`, `MatchFilters.tsx`, rota `/admin/copa/jogos`.
- Dependencies: TASK-07.
- Story points: 5
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (UI; filtro coberto no backend TASK-07).
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: `is_frontend: true` → `/ui-spec` + `/patterns:nextjs`. PNG: 3 filtros (não 4). Agrupamento por dia com date-fns/ptBR (já no projeto).

### TASK-12 – Frontend: Editar Resultado (PRD11-08)
- Type: application
- Goal: Formulário de edição manual — Gols Mandante/Visitante, Status (dropdown), Estádio, Data+Hora, toggle de override; "Salvar Alterações".
- Scope: Componente + integração `PUT /api/admin/matches/[id]` (mutation). Validação client espelhando o refinement placar↔status (UX); validação real no servidor (TASK-07). Sem backend novo.
- Main modules/files likely involved: `src/features/admin/components/EditMatchForm.tsx`, rota `/admin/copa/jogos/[id]/editar`.
- Dependencies: TASK-07, TASK-11.
- Story points: 5
- Criticality: medium
- Technical risk: medium
- Recommended TDD later: yes (validação de placar↔status no client; envio correto de override). — UI mas com lógica de validação sensível.
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: `is_frontend: true` → `/ui-spec` + `/patterns:nextjs`. PNG: header somente-leitura do confronto; "Salvar Alterações" full-width. Erro do servidor (422 placar inválido) → mensagem pt-BR no form.

### TASK-13 – Frontend: Logs do Sistema (PRD11-09) + Detalhes do Log (PRD11-10)
- Type: application
- Goal: Lista de logs com ícone colorido por tipo, título, detalhe e "Executado por" + timestamp; busca/filtro; drill-down "Detalhes do Log" (resumo + badge de status).
- Scope: Componentes + integração `["admin-logs", filtro]`. Mapa tipo→ícone/cor. Detalhe lê o `sync_log`/`system_log` correspondente. Sem backend novo (reuso `listLogs`/TASK-05).
- Main modules/files likely involved: `src/features/admin/components/LogsList.tsx`, `LogDetail.tsx`, rotas `/admin/logs`, `/admin/logs/[id]`.
- Dependencies: TASK-05, TASK-06 (gera os logs reais).
- Story points: 3
- Criticality: low
- Technical risk: low
- Recommended TDD later: no (UI; logs já cobertos no backend).
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes: `is_frontend: true` → `/ui-spec` + `/patterns:nextjs`. PNG: ícones por tipo (sync verde, aprovado verde, editado azul, admin alterado, bloqueado vermelho). Reconcilia com `/admin/logs` da PRD-07 (mesma coleção, gate super_admin).

### TASK-14 – Wiring do menu de perfil (seção "Super Admin") + gate
- Type: application
- Goal: Adicionar a seção role-gated **"Super Admin"** ao `ProfileHub` (`role === "super_admin"`, dupla-compat `admin`) com todos os destinos PRD-11 (Dashboard, Grupos Pendentes/Ativos/Bloqueados, Administradores, Jogos da Copa, Sincronização, Logs Globais); migrar o gate atual `role === "admin"` e reconciliar com as telas de usuário da PRD-07 (mantidas).
- Scope: `ProfileHub.tsx` (gate + itens de menu) + middleware (`super_admin` em `/admin/*`). Sem backend novo. Reconciliação PRD-07/PRD-11 (R4).
- Main modules/files likely involved: `src/features/profile/components/ProfileHub.tsx` (linha 202 gate), `middleware.ts`, `src/components/auth/AdminGuard.tsx`.
- Dependencies: TASK-08..TASK-13 (destinos existem).
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: no (UI/wiring; autorização real já no servidor — `authorizeGroupAdmin`).
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Notes: `is_frontend: true`. Gate do menu é **só UX** — segurança real é server-side. Dupla-compat `admin||super_admin` (não derrubar admin legado durante a transição da PRD-09). Reconciliar: manter itens de usuário (PRD-07) + adicionar os globais (PRD-11) sob "Super Admin".

## 4. Dependency map

```
TASK-01 (match schema +override) ─┬─> TASK-03 (rules/índices) ─> TASK-04 ─┬─> TASK-08
TASK-02 (sync_logs + log enum) ───┘                                       │
                                  ├─> TASK-06 (sync) ──> TASK-07 (edit+list)
TASK-03 ──> TASK-04 ──> TASK-05 ──┴─> TASK-09, TASK-10
TASK-06 ──> TASK-07 ──> TASK-11 ──> TASK-12
TASK-05, TASK-06 ──> TASK-13
TASK-08..13 ──> TASK-14 (menu + gate)
```

- TASK-01 e TASK-02 são fundação e paralelizáveis.
- TASK-03 depende de 01+02; destrava todo o backend.
- TASK-04 (dashboard/listagens) e TASK-05 (admins/delete/logging) são o backend de dados global.
- TASK-06 (sync) → TASK-07 (edição precisa de matches persistidos).
- Frontend (08–13) depende dos respectivos backends; TASK-14 fecha o wiring.

## 5. Recommended execution order

1. **TASK-01** — Extensão do `matchSchema` (override/edição)
2. **TASK-02** — `syncLog` + extensão do enum de log
3. **TASK-03** — Rules + índices (`matches`, `sync_logs`)
4. **TASK-04** — Dashboard stats + listagens de grupo por status
5. **TASK-05** — Admins + DELETE soft + logging das ações de grupo
6. **TASK-06** — Sync OpenFootball→Firestore (pesado, override + BulkWriter)
7. **TASK-07** — Edição manual de partida + listagem filtrada
8. **TASK-08** — Frontend Dashboard + Sincronização
9. **TASK-09** — Frontend Grupos (pendentes/ativos/bloqueados)
10. **TASK-10** — Frontend Administradores
11. **TASK-11** — Frontend Jogos da Copa
12. **TASK-12** — Frontend Editar Resultado
13. **TASK-13** — Frontend Logs + Detalhes
14. **TASK-14** — Wiring do menu de perfil + gate

## 6. Planning risks and blockers

- **TASK-06 (SP8, crítica) — sync + override + Spark.** 1ª persistência de `matches`; proteção de `isManualOverride` exige read-before-write (set de overrides) e `BulkWriter` para caber nas cotas Spark (R1/R6). Erro = sobrescrever correção manual. Verificação de aceite ("Sistema respeita isManualOverride") só fecha após TASK-06 + TASK-07.
- **TASK-07 (crítica) — edição vs refinement.** `PUT /matches/[id]` precisa respeitar `matchSchema` (status↔placar) e gravar override atômico (R2). Nunca gravar doc inválido.
- **TASK-14 — reconciliação `/admin` PRD-07 vs PRD-11 (R4).** Migrar gate `admin`→`super_admin` sem quebrar telas de usuário da PRD-07. Dupla-compat obrigatória.
- **Reuso > criação.** TASK-09/10 são UI sobre `PATCH /status` e `PATCH /admin` da PRD-09 — não reescrever transações. TASK-05 só **instrumenta** logging nas rotas existentes.
- **Decisões travadas:** B1 (rejeitar→blocked), B2 (excluir→soft-delete), B3 (remover admin→participant), B4 (3 filtros PNG), B5 (rotas `[id]`), B6 (`live` só manual). PNG vence o texto.
- **Recomendado TDD** em: 01, 02, 03, 04, 05, 06, 07, 12. Pulam TDD: 08, 09, 10, 11, 13, 14 (UI/wiring; lógica sensível já coberta no backend).
```
