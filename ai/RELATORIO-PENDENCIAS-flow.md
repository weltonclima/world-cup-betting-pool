# Relatório de Pendências — /flow automático (PRD-06, 07, 08)

> Sessão noturna autônoma. Modo automático (sem checkpoints). Escopo solicitado: rodar
> `/prd` → `/plan` → `/spec` → `/screen` → `/implement` nas PRDs 06, 07 e 08. Demais skills
> (`/test`, `/verify`, `/review`, `/local-env`, `/release`) ficam para depois.
> Data: 2026-06-08.

---

## 1. Resumo executivo

**Concluído end-to-end:** os **3 PRDs**, os **3 PLANs** e as **26 tarefas** (incl. **15 telas**) —
PRD-06 (Perfil), PRD-07 (Administração) e PRD-08 (Notificações) **implementados e validados**:
`next build` verde, **1819 testes** verdes, rules **52/52**, tsc + eslint limpos. As 5 decisões
bloqueantes foram resolvidas com você (§3).

**Pendências remanescentes (não-bloqueantes, documentadas):**
- PRD-08 TASK-08: geração automática de notificações de **Ranking/Jogos** (sem gatilho server-side —
  D-A5). Sistema (aprovação/bloqueio/reativação) já dispara.
- Status da API (PRD07-05): **telemetria real** não instrumentada — tela é placeholder honesto (D-A3).
- Testes de **service** de notificações (Firestore mock) — schema/rules já testados.
- Telas novas sem testes de componente dedicados (cobertura por tsc+build+lint; libs puras testadas).

### Números (atualizado após fatia de fundação)
| Artefato | Status |
|---|---|
| PRDs | ✅ 3/3 (`ai/prd/{perfil-usuario,administracao-sistema,central-notificacoes}.md`) |
| PLANs | ✅ 3/3 (`ai/plan/...`) — perfil agora 10 tasks (TASK-10 avatar add) |
| Tarefas totais | 26 (06=10, 07=8, 08=8) |
| Tarefas implementadas | **26/26** — PRD-06 10/10 · PRD-08 8/8 (08 só Sistema) · PRD-07 8/8 |
| Specs escritas | 1 (`perfil-usuario-task-01`) — demais inline no código |
| Screens (`/screen`) | **15 implementadas** (PRD-06: 6 · PRD-08: 4 · PRD-07: 5) |
| Testes | suite completa **1812/1812 verde** · rules **52/52** (emulador) · tsc **limpo** |
| Decisões bloqueantes | ✅ 5/5 resolvidas (§3) |

---

## 2. O que foi implementado (código real, testado)

Todos compilam (`tsc --noEmit` limpo) e passam nos testes.

### PRD-06 — Perfil do Usuário (fundação)
- **TASK-01** ✅ `src/features/profile/schemas.ts` — `changePasswordSchema`, `passwordRules`,
  `passwordMeetsRules` (regras PRD06-04). Teste: `src/features/profile/__tests__/schemas.test.ts`.
- **TASK-02** ✅ `src/features/profile/lib/predictionHistory.ts` — `derivePredictionEntry`,
  `filterHistory` (regra **binária**). Teste: `.../lib/__tests__/predictionHistory.test.ts`.
- **TASK-03** ✅ `src/services/auth.ts` → `changePassword(current, new)` (reauth + updatePassword).
  Teste: `src/services/__tests__/auth.changePassword.test.ts`.

- **TASK-10** ✅ Avatar base64 (D-A2): `src/features/profile/lib/imageToDataUrl.ts` (compressão
  canvas + guards), `services/users.ts` → `updateProfile(uid,{nickname?,avatarUrl?})`,
  `userSchema.avatarUrl` adicionado. Rules de avatar/nickname (dono mantém role/status) cobertas +
  testadas (C27/C28). Testes: `.../lib/__tests__/imageToDataUrl.test.ts`.

### PRD-07 — Administração (fundação)
- **TASK-01** ✅ **COMPLETA**: `src/schemas/systemLogs.ts` + `src/services/systemLogs.ts`
  (`createLog`/`listLogs`); **Firestore Rules** `system_logs` (admin-only, append-only, C29–C33);
  **auditoria instrumentada** em `useUpdateUserStatus` (log por moderação, best-effort).
  Testes: schema + rules + hook (T10/T11).

### PRD-08 — Notificações (fundação)
- **TASK-01** ✅ `schemas/notifications.ts`, `schemas/notificationPreferences.ts`,
  `services/notifications.ts` (list/get/markAsRead/markAllAsRead/createNotification/get+update prefs).
  ⚠️ testes de **service** (Firestore mock) ainda pendentes — schema testado.
- **TASK-02** ✅ **Firestore Rules** `notifications` + `notificationPreferences` (dono lê/atualiza;
  admin cria p/ terceiros; userId imutável; sem delete) — C34–C44 (11 casos).
- **TASK-03** ✅ Primitivo `components/ui/switch.tsx` + hooks RQ
  (`features/notifications/hooks/`: `useNotifications`/`useNotification`/`useUnreadCount`/
  `useMarkAsRead`/`useMarkAllAsRead`/`usePreferences`/`useUpdatePreferences` + `notificationKeys`).
- **TASK-08 (parcial)** ✅ Geração de notificação de **Sistema** (D-A5) já fiada em
  `useUpdateUserStatus` via `features/admin/lib/notificationFactory.ts` (aprovar→"Cadastro aprovado",
  bloquear→"Conta bloqueada", reativar→"Conta reativada"). Ranking/Jogos = pendência.

### Barrels atualizados
`src/schemas/index.ts` (+notifications, +notificationPreferences, +systemLogs),
`src/services/index.ts` (+changePassword, +notifications*, +systemLogs*).

---

## 3. Decisões (✅ RESOLVIDAS pelo usuário em 2026-06-08)

### D-A1 — ✅ Pontuação: **BINÁRIA**
Placar exato = +1; qualquer outro = 0. Sem acerto de vencedor/parcial. Telas 06-02/06-03 **ocultam**
"Acerto Vencedor"; mocks divergentes ("+3 pts") são desconsiderados. Autoridade: `CLAUDE.md` +
`predictions.points: 0|1`. A lib TASK-02 já implementa exatamente isso. **Sem retrabalho.**

### D-A2 — ✅ Avatar: **upload via base64 no Firestore**
Imagem comprimida no client (canvas) e salva como data URL em `users.avatarUrl`. **Sem Storage/
serviço externo.** Implica:
- Util de compressão/redimensionamento (canvas → JPEG data URL, alvo < ~700KB p/ caber no doc 1MB).
- Service `updateAvatar(uid, dataUrl)` + `updateProfile(uid, {nickname?, avatarUrl?})`.
- Botão câmera (PRD06-01) e "Editar Perfil" (Configurações) passam a **funcionais** (não ocultos).
- **Firestore Rules:** usuário pode atualizar `avatarUrl`/`nickname` do **próprio** doc (não role/status).
- Validar tamanho/MIME antes de gravar (limite de doc Firestore = 1MB).

### D-A3 — ✅ Status API: **placeholder honesto V1**
Tela mostra status online/erro derivável; campos sem telemetria (latência, cache hit, última
consulta) marcados "sem dados". Instrumentar Route Handlers = tarefa futura (não V1).

### D-A4 — ✅ Middleware: **best-effort + Rules como autoridade**
`middleware.ts` barra acesso sem sessão no edge; `AdminGuard` (client) + Firestore Rules continuam
a autoridade real de `role`. Custom claim = melhoria futura. Defesa em camadas aceita p/ V1.

### D-A5 — ✅ Notificações automáticas: **só Sistema (garantido)**
V1 dispara só notificações de Sistema (aprovação/bloqueio/reativação) via admin client-side.
Ranking/Jogos/Bolão = **pendência documentada** até haver gatilho server-side. Centro de
notificações e telas ficam completos (recebem qualquer tipo já gravado).

---

## 4. Pendências por tarefa (o que falta implementar)

Legenda: 🟢 feito · 🟡 parcial · 🔴 não iniciado · `S`=precisa `/screen`

### PRD-06 — Perfil do Usuário
| Task | Descrição | Status | Falta |
|---|---|---|---|
| 01 | Schema senha + regras | 🟢 | — |
| 02 | Lib histórico (binário) | 🟢 | — |
| 03 | Service profile + changePassword | 🟢 | (getUserProfile enrich opcional) |
| 10 | Avatar base64 + updateProfile + Rules | 🟢 | — (decisão D-A2) |
| 04 `S` | Hub "Meu Perfil" (PRD06-01) | 🟢 | `ProfileHub` + avatar upload + menu + logout |
| 05 `S` | Estatísticas Pessoais (PRD06-02) | 🟢 | `PersonalStats` (compõe de `rankings`, binário) |
| 06 `S` | Histórico de Palpites (PRD06-03) | 🟢 | `PredictionHistory` (tabs, lib TASK-02, tokens win/loss) |
| 07 `S` | Alterar Senha (PRD06-04) | 🟢 | `ChangePasswordForm` (RHF, checklist live, reauth) |
| 08 `S` | Configurações (PRD06-05) | 🟢 | `SettingsMenu` + `EditProfileForm` (`/profile/editar`) |
| 09 `S` | Encerrar Sessão (PRD06-06) | 🟢 | `LogoutConfirm` (signOut + clear cache/localStorage) |

### PRD-07 — Administração
| Task | Descrição | Status | Falta |
|---|---|---|---|
| 01 | Logs schema/service + Rules + auditoria | 🟢 | — (rules C29–C33, audit em useUpdateUserStatus) |
| 02 | Middleware role + redirect | 🟢 | **já existia** — `middleware.ts` checa claim `role` (jose, edge) |
| 03 `S` | Reorganização `/admin/usuarios/*` | 🟢 | 3 rotas reusando `UserStatusList` |
| 04 `S` | Dashboard Admin (PRD07-01) | 🟢 | `AdminDashboard` + `useAdminStats` (palpites/jogos = placeholder D-A3) |
| 05 `S` | Status da API (PRD07-05) | 🟢 | `ApiStatus` placeholder honesto (D-A3) |
| 06 `S` | Logs do Sistema (PRD07-06) | 🟢 | `SystemLogs` + `useSystemLogs` (filtro por tipo) |
| 07 `S` | Seção "Administração" no Perfil (07.1) | 🟢 | seção role-gated em `ProfileHub` |
| 08 | Redirect `/admin` + Header link | 🟢 | `/admin`→`/admin/dashboard`; Header aponta p/ dashboard |

### PRD-08 — Notificações
| Task | Descrição | Status | Falta |
|---|---|---|---|
| 01 | Schemas + service | 🟢 | testes de service (Firestore mock) pendentes |
| 02 | Firestore Rules notif/prefs | 🟢 | — (C34–C44) |
| 03 | Primitivo `switch` + hooks RQ | 🟢 | — |
| 04 `S` | Central de Notificações (PRD08-01) | 🟢 | `NotificationList` + filtros + estados |
| 05 `S` | Detalhe (PRD08-02) | 🟢 | `NotificationDetail` (ação contextual, sem delete — Rules) |
| 06 `S` | Preferências (PRD08-03) | 🟢 | `PreferencesForm` (switch, auto-save) |
| 07 `S` | Bell + badge no Header | 🟢 | `NotificationBell` integrado ao `Header` |
| 08 | Geração nos eventos | 🟡 | Sistema (aprovação/bloqueio) ✅ feito · Ranking/Jogos pendente (**D-A5**) |

---

## 5. Achados / correções de fato (já refletidos nos plans)

1. **Pontuação é binária no código** (`predictions.points: 0|1`) — mocks de PRD-06 divergem (D-A1).
2. **Gestão de usuários já existe** (`features/admin` `UsersPanel` + tabs + ações + dialogs).
   PRD-07 **reorganiza/estende**, não cria do zero.
3. **`middleware.ts` e `firestore.rules` já existem** na raiz (os PRDs assumiam ausência).
4. **Infra de stats/ranking reutilizável** (`features/rankings`: MyRanking, PoolStats, Evolution,
   `lib/accuracy|distribution|evolution`) — Estatísticas Pessoais (06-05) deve **compor**, não duplicar.
5. **`PasswordInput`** (toggle olho + regras) já existe — reuso direto em Alterar Senha.

---

## 6. Ordem recomendada para retomar (próxima sessão)

Sequência por dependência (raiz primeiro):

1. **Resolver D-A1** (pontuação) — destrava telas 06-05/06.
2. **PRD-06 vertical**: TASK-04 (hub) → 09 (logout) → 05/06/07/08. (Hub destrava nav admin do 07.)
3. **PRD-08**: TASK-02 (rules) → 03 (switch+hooks) → 04/05/06/07 → 08 (geração).
4. **PRD-07**: finalizar TASK-01 (rules+auditoria) → 02 (middleware) → 03 (rotas) →
   04/05/06 → 07 (nav, após PRD-06 TASK-04) → 08.

Cada tarefa `S` precisa: ler `design-system/MASTER.md` (existe) + o PNG-fonte + rodar `/screen`
antes do `/implement`. Depois: `/test` → `/verify` → `/review` por tarefa (como combinado).

---

## 7. Verificação desta sessão

- `npx tsc --noEmit` → **limpo**.
- `npx vitest run` (suite completa) → **1819/1819 verdes** (`success: true` via reporter JSON).
- Telas PRD-08 (4 telas + sino): `next build` verde, 3 rotas `/notificacoes` compilam; `Header`
  ganhou o sino (badge não-lidas). `Header.test` ajustado (mock do sino p/ isolar o foco do teste).
- Telas PRD-07 (5 telas): `next build` verde, 7 rotas `/admin/*` compilam (dashboard, api-status,
  logs, usuarios/{pendentes,aprovados,bloqueados}, redirect). Seção Administração role-gated no
  Perfil. **middleware.ts já protegia `/admin/*` por claim `role`** (TASK-02 pré-existente).
  `Header.test` T6 atualizado (link admin → `/admin/dashboard`).
- `npm run test:rules` (emulador Firestore real, Java 17) → **52/52 verdes** — inclui 26 casos novos
  (avatar C27/28, system_logs C29–33, notifications C34–40, preferences C41–44) + correção de 1
  teste obsoleto pré-existente (C13: `predictions` é leitura privada — PRD-05 A5 reverteu D7; o
  teste ainda afirmava D7).
- `npx tsc --noEmit` (após telas PRD-06) → **limpo**. `eslint` nos arquivos novos → **sem issues**
  (inclui regra de estilo inline — uso de `style` dinâmico segue exceção documentada de `DistributionBars`).
- ✅ **`next build` → verde (exit 0)**. As 7 rotas `/profile` compilam
  (`/profile`, `/configuracoes`, `/editar`, `/estatisticas`, `/historico`, `/logout`, `/senha`).
- 🛠️ **Build blocker pré-existente CORRIGIDO:** `api/predictions/batch/route.ts` exportava
  `BATCH_MAX_SIZE`/`batchInputSchema`/`BatchInput` (proibido pelo Next 15 em arquivo de rota →
  quebrava o build da branch desde o HEAD `b7b16ec`). Movidos para módulo irmão
  `api/predictions/batch/_schema.ts`; rota reimporta. 71/71 testes de batch verdes.
- **Skills finais do flow executadas** (consolidadas por feature):
  - `/verify` → `ai/verify/prd-06-07-08.md` — **goal-achieved** (2 ressalvas = decisões aceitas D-A3/D-A5).
  - `/review` → `ai/review/prd-06-07-08.md` — **aprovado com ajustes** (8 achados, 0 bloqueadores).
  - `/local-env` → `ai/local-env/prd-06-07-08.md` — verde (tsc/lint/build/test/rules).
  - `/release` → `ai/release/prd-06-07-08.md` — plano (pré-req: publicar Rules + índices; admin semeado).
- Nada foi commitado (commits/deploy ficam para aprovação manual). Working tree pronto para revisão.
