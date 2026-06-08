# PRD — Administração do Sistema (PRD-07 + PRD-07.1)

> Fontes: `docs/prd-07/PRD-07-Administracao-Sistema-Final.md`, `docs/prd-07-1/PRD-07.1-Arquitetura-Administrativa-v2.md`
> + PNGs `PRD07-00..06` e `PRD07.1V2-*` (fonte de verdade visual).
> Feature slug: `administracao-sistema`.

## 0. Decisões travadas (modo automático)

| Ref | Decisão |
|-----|---------|
| D1 | Gestão de usuários (Pendentes/Aprovados/Bloqueados) **já implementada** em `features/admin` (`UsersPanel`). PRD-07 **reorganiza** em rotas dedicadas e **adiciona** Dashboard, Status API e Logs. Reusar componentes existentes, não recriar. |
| D2 | **Sem portal admin separado** (07.1): mesma app, seção "Administração" no Perfil visível só p/ `role===admin`. |
| D3 | Escrita/leitura admin = **Client SDK + Firestore Rules** (padrão já adotado em aprovacao-usuarios; sem Cloud Function — compat. Spark). |
| D4 | **Logs (`system_logs`)**: gravados client-side pelo admin nas ações (aprovar/bloquear/login admin) via serviço; leitura admin-only. Sem Cloud Function. |
| D5 | **Status API**: PRD-07 fala em métricas API-Football (última consulta, tempo resposta, cache hit). Como integração API-Football roda via Route Handlers (PRD-07 arquitetura v2/memory), Status API lê telemetria persistida (`system_settings`/coleção de saúde) OU placeholder se telemetria não existir ainda. → ver Ambiguidades A2. |
| D6 | "Ranking via Cloud Function a cada 2h" e "estratégia de cache" no PRD-07 são **contexto arquitetural**, não telas → fora do escopo de UI desta feature (já cobertos por integracao-api-football/rankings). |

## 1. Feature summary

Camada administrativa dentro da app única. Admin (`role===admin`) ganha, no Perfil, uma seção
"Administração" com: **Dashboard** (indicadores), **Gerenciar Aprovações / Usuários Ativos /
Usuários Bloqueados** (gestão já existente, reorganizada por rota), **Status da API** e **Logs do
Sistema**. Usuário comum nunca vê essa seção. Proteção em profundidade: UI oculta + middleware
`/admin/*` (role===admin) + Firestore Rules.

## 2. Consolidated scope

**Em escopo (novo/reorganização):**

1. **Navegação role-gated (07.1):** seção "Administração" no hub de Perfil (PRD-06), visível só p/
   admin. Itens: Dashboard, Gerenciar Aprovações, Usuários Ativos, Usuários Bloqueados, Status da
   API, Logs do Sistema, Sair. Layout-fonte: `PRD07.1V2-Perfil-Administrador.png` /
   `PRD07.1V2-Perfil-Usuario-Comum.png`.
2. **Dashboard Admin** (`PRD07-01`): indicadores — Total usuários, Pendentes, Aprovados,
   Bloqueados, Total palpites, Status API. Cards/grid.
3. **Reorganização de rotas:** `/admin` atual (UsersPanel único) → `/admin/dashboard`,
   `/admin/usuarios/pendentes`, `/admin/usuarios/aprovados`, `/admin/usuarios/bloqueados`,
   `/admin/api-status`, `/admin/logs`. Reusar `UserStatusList`/`UserActions`/dialogs existentes em
   cada rota de usuários (telas `PRD07-02/03/04`).
4. **Status da API** (`PRD07-05`): status API-Football, última consulta, tempo de resposta, cache
   hit rate. Sem sincronização manual.
5. **Logs do Sistema** (`PRD07-06`): lista de eventos (login admin, aprovação, bloqueio, erros API,
   atualização ranking) — coleção `system_logs`. Filtros por tipo.
6. **Middleware** `/admin/*` exigindo `role===admin` (hoje só `AdminGuard` client-side).
7. **Serviço de logs** + escrita de auditoria nas ações admin existentes.
8. **Firestore Rules** p/ `system_logs` (admin-only) e leitura agregada de indicadores.

**Fora de escopo:**
- Gestão da Copa / sync manual (PRD: "sem gerenciamento manual da Copa").
- Cloud Functions (compat. Spark).
- Cache strategy e ranking scheduler (já cobertos em outras features).

## 3. System understanding (relevant parts only)

- **Já existe** `features/admin/`: `UsersPanel`, `UserStatusList`, `UserList(Item/Skeleton/Empty/Error)`,
  `UserActions`, `ConfirmActionDialog`, `ApprovedDialog`, hooks `useUsers`/`useUpdateUserStatus`,
  `usersKeys`. Rota `(app)/admin/page.tsx` + `layout.tsx` (AdminGuard). `AdminGuard` +
  `AdminGuard.test` em `components/layout`.
- `services/users.ts` — listagem/mutação de status. `services/systemSettings.ts` + schema existe.
- `services/statistics.ts`, `predictions.ts` — base p/ contadores do Dashboard (total palpites).
- `components/layout/`: Header, SideNav, BottomNav (`nav-items.ts`), AppShell, AdminGuard.
- **Não existe**: middleware Next (`middleware.ts`), serviço/coleção `system_logs`, telas
  Dashboard/Status API/Logs, sub-rotas `/admin/*`.
- Integração API-Football: via Route Handlers (`services/_apiClient.ts`, `matches.ts`, `teams.ts`).
  Telemetria de saúde da API: **a confirmar** se já persistida (A2).

## 4. Technical impact analysis

- **STACK:** Next.js App Router (novas sub-rotas + `middleware.ts`), TanStack Query (indicadores,
  logs), Zod (schema `system_logs`), Shadcn (card/table/badge/select p/ filtros), date-fns.
- **ARCHITECTURE:**
  - Mover/duplicar entrada do `UsersPanel` para 3 rotas (`/admin/usuarios/*`) — preferir um
    componente parametrizado por status reusando `UserStatusList`.
  - Nova feature/área: `features/admin/dashboard`, `.../api-status`, `.../logs` (ou subpastas).
  - `services/systemLogs.ts` + `schemas/systemLogs.ts`; escrita de log nas mutações admin existentes.
  - `services/adminStats.ts` (agregação de contadores) ou compor de hooks existentes.
  - `middleware.ts` na raiz: ler claim/role e barrar `/admin/*`. **Nota:** role vive no Firestore,
    não no token por padrão → middleware precisa de custom claim OU cookie de sessão. Ver A3.
  - Seção "Administração" no Perfil (depende de **PRD-06** Perfil hub existir).
- **INTEGRATIONS:** leitura agregada `users` (contagem por status), `predictions` (total),
  saúde API (Status API). Escrita `system_logs`.
- **CONCERNS:**
  - **Segurança (alta):** middleware confiável exige role no token (custom claim) — hoje role é doc
    Firestore. Sem claim, middleware não tem role no edge → fica defesa em camadas (AdminGuard +
    Rules continuam autoridade). A3.
  - **Auditoria:** logs gravados client-side são forjáveis sem Rules estritas → Rules devem permitir
    `create` em `system_logs` só p/ admin e impedir update/delete.
  - **Consistência dashboard:** contadores derivam de múltiplas coleções; invalidar/atualizar com
    staleTime padrão (30min) — dados não críticos.

## 5. Risks

- **Middleware role no edge:** Next middleware não acessa Firestore facilmente; depende de custom
  claim ou cookie. Risco de proteção incompleta se claim não existir → mitigar mantendo AdminGuard
  + Rules como autoridade, middleware como camada extra (best-effort) ou via cookie de sessão.
- **Telemetria Status API inexistente:** se a app não persiste métricas de saúde da API, a tela vira
  placeholder. Risco de entregar tela sem dado real.
- **Reorganização de rotas quebrar `/admin` atual:** redirects e testes existentes (`UsersPanel.test`)
  podem precisar ajuste.
- **`system_logs` crescer sem limite:** <100 users → volume baixo; sem TTL. Aceitável V1.

## 6. Ambiguities and gaps

| # | Ambiguidade | Resolução adotada |
|---|---|---|
| A1 | Reorganizar `/admin` em sub-rotas vs manter painel único com tabs | **Sub-rotas** conforme 07.1 (`/admin/dashboard`, `/admin/usuarios/*`, `/admin/api-status`, `/admin/logs`), reusando `UserStatusList`. Manter `/admin`→redirect `/admin/dashboard`. |
| A2 | Status API: fonte dos dados (última consulta, tempo resposta, cache hit) | ✅ **RESOLVIDO: placeholder honesto V1.** Status online/erro derivável; campos sem telemetria marcados "sem dados". Instrumentar Route Handlers = tarefa futura. |
| A3 | Middleware role: custom claim vs cookie vs só client guard | ✅ **RESOLVIDO: best-effort + Rules autoridade.** `middleware.ts` barra sem-sessão no edge; AdminGuard + Firestore Rules = autoridade real de role. Custom claim = melhoria futura. |
| A4 | Logs: quais campos/níveis, retenção | Schema `system_logs`: `{id, type, actorUid, targetUid?, message, level, createdAt}`. Sem retenção V1. |
| A5 | Dashboard "Status API" indicador = resumo da tela Status API | Sim, badge de status (online/erro) + link p/ /admin/api-status. |

## 7. UI/Layout impact

- **UI Impact:** yes
- **Platforms:** both (mobile-first)
- **Screens:** Perfil Admin (seção Administração), Dashboard Admin, Usuários
  Pendentes/Aprovados/Bloqueados (reuso visual existente), Status da API, Logs do Sistema.
- **Product type:** painel administrativo dentro de PWA de bolão esportivo.
- **Recommended style direction:** travada por `design-system/MASTER.md` (verde Copa, cards,
  badges, Shadcn, mobile-first). Reuso + overrides p/ dashboard/logs/api-status.
- **Design complexity:** medium-high (3 telas novas + reorganização + navegação role-gated).

## 8. Implementation concerns (high-level, no tasks yet)

- `schemas/systemLogs.ts` + `services/systemLogs.ts` (create/list, admin-only).
- Instrumentar logs nas mutações admin existentes (`useUpdateUserStatus`) + login admin.
- `features/admin/` ampliado: `dashboard/` (indicadores), `api-status/`, `logs/` (lista+filtros).
- Reorganizar rotas `(app)/admin/*` reusando `UserStatusList`; `/admin`→redirect dashboard.
- `middleware.ts` best-effort + manter AdminGuard; Firestore Rules p/ `system_logs` e leitura admin.
- Seção "Administração" no Perfil (PRD-06) role-gated — **depende de PRD-06**.
- Estados loading/empty/error em todas as telas; responsividade; acessibilidade.
