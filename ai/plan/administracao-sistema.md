# PLAN — Administração do Sistema (PRD-07 + 07.1)

> Origem: `ai/prd/administracao-sistema.md`. Gestão de usuários **já existe** (`features/admin`
> UsersPanel). Aqui: reorganização de rotas + Dashboard + Status API + Logs + navegação role-gated.
> **Correção de fato:** `middleware.ts` e `firestore.rules` JÁ existem na raiz (PRD assumiu ausência).

## 1. Planning summary

8 tarefas. Fundação: schema/service de logs + middleware role + Rules de `system_logs`. UI nova:
Dashboard, Status API, Logs. Reorganização: sub-rotas `/admin/*` reusando `UserStatusList`.
Navegação: seção "Administração" no Perfil (**depende de PRD-06**).

- Tasks com `/screen`: 4 (TASK-04 Dashboard, 05 Status API, 06 Logs, 07 nav Perfil Admin)
- Tasks com TDD recomendado: 2 (TASK-01 logs schema/service, TASK-02 middleware)
- Domínios de design: product (admin dashboard), ux (cards, tabela logs, filtros), style (MASTER.md)

## 2. Recommended execution phases

1. **Fundação** — logs schema/service + Rules + middleware + auditoria nas ações (TASK-01, 02)
2. **Reorganização rotas** — sub-rotas `/admin/*` reusando UsersPanel (TASK-03)
3. **Telas novas** — Dashboard, Status API, Logs (TASK-04, 05, 06)
4. **Navegação** — seção Administração no Perfil (TASK-07) + redirect `/admin` (TASK-08)

## 3. Tasks

### TASK-01 – Logs: schema + service + auditoria nas ações admin + Rules
- Type: persistence / security / domain
- Goal: Persistir eventos administrativos em `system_logs`, admin-only, e instrumentar ações existentes.
- Scope: `schemas/systemLogs.ts` (`{id, type, actorUid, targetUid?, message, level, createdAt}`;
  `type` ∈ login_admin|user_approved|user_blocked|user_unblocked|api_error|ranking_update).
  `services/systemLogs.ts`: `createLog`, `listLogs(filter?)`. Instrumentar `useUpdateUserStatus`
  (aprovar/bloquear/desbloquear → log) + login admin. Estender `firestore.rules`: `system_logs`
  `create: isAdmin()`, `read: isAdmin()`, sem update/delete. Teste de rules.
- Files: `src/schemas/systemLogs.ts`, `src/services/systemLogs.ts`, `firestore.rules`,
  `src/features/admin/hooks/useUpdateUserStatus.ts`, `test/rules/firestore.rules.test.ts`
- Dependencies: nenhuma
- Story points: 5 · Criticality: high · Risk: medium
- TDD: yes (schema; rules admin-only create/read, deny update/delete; log emitido por mutação)
- Screen: no – n/a

### TASK-02 – Middleware role + redirect `/admin`
- Type: application / security
- Goal: Endurecer proteção `/admin/*` no middleware (camada extra) + redirect `/admin`→`/admin/dashboard`.
- Scope: ajustar `middleware.ts` existente: barrar `/admin/*` sem sessão (best-effort cookie/uid; A3 —
  role autoritativo permanece AdminGuard+Rules). Redirect `/admin`→`/admin/dashboard`. Documentar
  limite (role não está no token sem custom claim → pendência).
- Files: `middleware.ts`
- Dependencies: nenhuma
- Story points: 3 · Criticality: high · Risk: medium
- TDD: yes (rota admin sem sessão redireciona; `/admin` redireciona dashboard)
- Screen: no – n/a
- Notes: Não substitui AdminGuard. Custom claim = pendência documentada (A3).

### TASK-03 – Reorganização de rotas `/admin/usuarios/*` (reuso UsersPanel)
- Type: ui / application
- Goal: Mover gestão de usuários para sub-rotas dedicadas reusando componentes existentes.
- Scope: criar `(app)/admin/usuarios/pendentes|aprovados|bloqueados/page.tsx`, cada uma renderizando
  `UserStatusList` parametrizado por status (reuso `features/admin`). Sub-nav admin (tabs/links).
  Manter testes existentes passando (ajustar imports se preciso). `/admin/page.tsx`→redirect dashboard.
- Files: `src/app/(app)/admin/usuarios/*/page.tsx`, `src/features/admin/components/` (param status),
  `src/app/(app)/admin/page.tsx`
- Dependencies: TASK-02 (redirect) — soft
- Story points: 5 · Criticality: medium · Risk: medium
- TDD: no · Screen: **yes** – reorganização de navegação/rotas (fonte `PRD07-02/03/04`)
- Design: ux, product · complexity: medium · a11y: enhanced
- Notes: Reusar `UserStatusList`/`UserActions`/dialogs — **não recriar**.

### TASK-04 – Dashboard Admin (PRD07-01)
- Type: ui / application
- Goal: Indicadores administrativos.
- Scope: `(app)/admin/dashboard/page.tsx`. Cards: Total usuários, Pendentes, Aprovados, Bloqueados
  (de `useUsers`/contagem), Total palpites (`predictions`), Status API (badge resumo → /admin/api-status,
  A5). Hook `useAdminStats` (compõe contadores). Estados loading/empty/error.
- Files: `src/app/(app)/admin/dashboard/page.tsx`, `src/features/admin/dashboard/AdminDashboard.tsx`,
  `src/features/admin/hooks/useAdminStats.ts`
- Dependencies: TASK-03 (sub-nav)
- Story points: 5 · Criticality: medium · Risk: medium
- TDD: no · Screen: **yes** – nova página (fonte `PRD07-01`)
- Design: product, ux, style · complexity: medium · a11y: enhanced

### TASK-05 – Status da API (PRD07-05)
- Type: ui / application
- Goal: Exibir saúde da integração API-Football.
- Scope: `(app)/admin/api-status/page.tsx`. Status (online/erro), última consulta, tempo de resposta,
  cache hit rate. Fonte de dados: telemetria persistida se existir; **senão placeholder honesto**
  (A2) + pendência p/ instrumentar Route Handlers. Sem sync manual.
- Files: `src/app/(app)/admin/api-status/page.tsx`, `src/features/admin/api-status/ApiStatus.tsx`,
  (`services/apiHealth.ts` se houver fonte)
- Dependencies: TASK-03
- Story points: 3 · Criticality: low · Risk: medium
- TDD: no · Screen: **yes** – nova página (fonte `PRD07-05`)
- Design: product, ux · complexity: low · a11y: standard
- Notes: **A2** — confirmar fonte de telemetria; provável pendência de instrumentação.

### TASK-06 – Logs do Sistema (PRD07-06)
- Type: ui / application
- Goal: Listar eventos de `system_logs` com filtros.
- Scope: `(app)/admin/logs/page.tsx`. Lista (tabela/cards) ordenada `createdAt` desc; filtro por tipo
  (login admin/aprovação/bloqueio/erros API/atualização ranking). Hook `useSystemLogs(filter)`.
  Estados loading/empty/error. date-fns.
- Files: `src/app/(app)/admin/logs/page.tsx`, `src/features/admin/logs/SystemLogs.tsx`,
  `src/features/admin/hooks/useSystemLogs.ts`
- Dependencies: TASK-01, TASK-03
- Story points: 5 · Criticality: medium · Risk: low
- TDD: no · Screen: **yes** – nova página (fonte `PRD07-06`)
- Design: product, ux, style · complexity: medium · a11y: enhanced

### TASK-07 – Seção "Administração" no Perfil (07.1) role-gated
- Type: ui / application
- Goal: Expor navegação admin no hub de Perfil só p/ `role===admin`.
- Scope: no hub de Perfil (PRD-06 TASK-04), adicionar seção "Administração" condicional
  (`role==="admin"`): Dashboard, Gerenciar Aprovações, Usuários Ativos, Usuários Bloqueados, Status
  da API, Logs. Usuário comum não vê (fontes `PRD07.1V2-Perfil-Administrador/Usuario-Comum`).
  Manter BottomTabBar igual p/ todos.
- Files: `src/features/profile/components/ProfileHub.tsx` (extensão), `src/features/admin/lib/adminNav.ts`
- Dependencies: **PRD-06 TASK-04** (hub), TASK-03/04/05/06 (rotas-alvo)
- Story points: 3 · Criticality: high · Risk: low
- TDD: no · Screen: **yes** – muda estrutura de navegação do Perfil
- Design: ux, product · complexity: low · a11y: enhanced
- Notes: **Cross-PRD dependency** — requer Perfil hub do PRD-06.

### TASK-08 – Redirect `/admin` + limpeza
- Type: ui
- Goal: `/admin` → `/admin/dashboard`; remover UsersPanel monolítico se substituído.
- Scope: ajustar `(app)/admin/page.tsx` p/ redirect; garantir entrada admin do Header aponta p/
  `/admin/dashboard`. Ajustar testes.
- Files: `src/app/(app)/admin/page.tsx`, `src/components/layout/Header.tsx`
- Dependencies: TASK-03, TASK-04
- Story points: 1 · Criticality: low · Risk: low
- TDD: no · Screen: no

## 4. Dependency map

```
TASK-01 (logs+rules) ──> TASK-06 (logs UI)
TASK-02 (middleware) ──> TASK-03 (sub-rotas) ──> TASK-04 (dashboard) ──> TASK-08 (redirect)
                                   ├─> TASK-05 (api status)
                                   └─> TASK-06
PRD-06 hub ──> TASK-07 (nav Perfil Admin) ←── TASK-03/04/05/06 (rotas)
```

## 5. Execution waves

- **Wave 1** (fundação): TASK-01, TASK-02
- **Wave 2**: TASK-03 (←02)
- **Wave 3**: TASK-04, TASK-05, TASK-06 (←03; 06←01)
- **Wave 4**: TASK-07 (←PRD-06 hub + rotas), TASK-08 (←03,04)

## 6. Sequential fallback

TASK-01 → TASK-02 → TASK-03 → TASK-04 → TASK-06 → TASK-05 → TASK-08 → TASK-07

Início recomendado: **TASK-01** (logs/rules são base de auditoria e da tela Logs).

## 7. Planning risks

- **B1 — TASK-07 depende de PRD-06** (hub de Perfil). Executar após perfil-usuario TASK-04. Se PRD-06
  não pronto → TASK-07 fica pendente.
- **B2 — Status API (A2):** sem telemetria persistida → tela placeholder. Pendência de instrumentação.
- **B3 — Middleware role (A3):** role não está no token; proteção edge é best-effort. Autoridade =
  AdminGuard + Rules. Custom claim = pendência.
- **R1 — Reorganização de rotas** pode quebrar testes de `UsersPanel`. Rodar suíte admin no /test.
- **R2 — Logs forjáveis** sem Rules estritas — Rules `create`-only admin, sem update/delete (TASK-01).
- **NOTA:** `middleware.ts` e `firestore.rules` já existem — tarefas estendem, não criam.
