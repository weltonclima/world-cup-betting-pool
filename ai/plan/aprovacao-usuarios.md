# PLAN — Aprovação de Usuários (PRD-01.2)

> Origem: `ai/prd/aprovacao-usuarios.md` (decisões travadas §0). Máquina de estados de acesso já existe (AuthProvider/AuthGuard/PendingApprovalScreen/BlockedScreen) — **não reescrever**, apenas alimentar/gatear.

## 1. Planning summary

8 tarefas. Núcleo = painel admin (`/admin`) + camada de dados de usuários + **Firestore Rules** como autoridade de segurança. Fundação (rules, service, primitivos Shadcn, ajuste tela 02) é paralelizável; UI do painel depende dela. 3 tarefas exigem `/screen` (painel, ações/modal, ajuste tela 02). Risco concentrado em segurança: rules (TASK-01) e mutações de status (TASK-07).

- Tasks com `/screen`: 3 (TASK-06, TASK-07, TASK-08)
- Tasks com TDD recomendado: 3 (TASK-01, TASK-02, TASK-03)
- Domínios de design: product (admin/dashboard), ux (lista, tabs, modal), style/color/typography (de `design-system/MASTER.md`)

## 2. Recommended execution phases

1. **Fundação** — segurança + dados + primitivos (TASK-01, 02, 04, 08)
2. **Exposição/integração** — hooks de query + gating de acesso (TASK-03, 05)
3. **UI do painel** — render read-only (TASK-06)
4. **Comportamento** — ações de mutação + modal (TASK-07)

## 3. Tasks

### TASK-01 – Firestore Security Rules: cobertura das ações admin (REDUZIDO)
- Type: infra / security / test
- Goal: Garantir que `firestore.rules` (JÁ EXISTENTE) cobre e tem testes para as ações do PRD-01.2.
- **REFRAME:** `firestore.rules` já existe e já está correto para gestão de usuários (prior PRD-01/TASK-08): admin lê todos (`read: isOwner || isAdmin`), admin muda status/role de terceiro (`update: isAdmin || ...`), user não muda próprio role/status, signup força pending/user. `test/rules/firestore.rules.test.ts` já cobre C5–C10, C19. R4 (updatedAt) resolvido — regra admin libera qualquer campo. **Rules file NÃO muda.**
- Scope: Adicionar SOMENTE casos de teste ausentes em `test/rules/firestore.rules.test.ts`: admin **bloqueia** (approved→blocked), admin **desbloqueia** (blocked→approved), admin **lê** doc de terceiro (positivo, base da listagem). Verificar via `npm run test:rules`.
- Main modules/files: `test/rules/firestore.rules.test.ts` (só adição de `it(...)`)
- Dependencies: nenhuma
- Story points: 2
- Criticality: high
- Technical risk: low
- Recommended TDD: yes (emulator JÁ configurado: `test:rules` + `@firebase/rules-unit-testing` + `vitest.rules.config.ts`)
- Recommended screen: no – n/a
- Notes: Se algum caso novo falhar, AÍ as rules mudam — mas a análise indica que passam. Autoridade real de segurança; UI/guard são defesa em profundidade.

### TASK-02 – Service de usuários + schema de transição
- Type: persistence / application
- Goal: Expor leitura por status e mutação de status server-validada no client SDK.
- Scope: `services/users.ts`: `listUsersByStatus(status)` (query `where status ==`, ordenado por `createdAt`) e `updateUserStatus(uid, nextStatus)` (`updateDoc` de `status` + `updatedAt`). Schema Zod das transições permitidas (`pending→approved`, `pending→blocked`, `approved→blocked`, `blocked→approved`) rejeitando o resto. Reexportar no barrel `services/index.ts`. Reusar `userSchema` para parse de leitura.
- Main modules/files: `src/services/users.ts`, `src/services/index.ts`, (schema de transição em `src/features/admin/` ou `src/schemas/`)
- Dependencies: nenhuma (usa `userSchema`/`firestore` existentes)
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD: yes (transições válidas/ inválidas; parse de lista; rejeição de transição ilegal)
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: Camada NÃO traduz erros (padrão de `services/auth.ts`) — UI mapeia. Validação de transição é UX/defensiva; rules são a barreira real.

### TASK-03 – Hooks TanStack Query (listas + contadores + mutação)
- Type: application
- Goal: Fornecer dados das 3 tabs e mutação com invalidação consistente.
- Scope: `useUsersByStatus(status)` (uma query por tab) + derivação de contadores (Pendentes/Aprovados/Bloqueados). `useUpdateUserStatus()` (mutation) que, no sucesso, invalida as queries das tabs afetadas (origem + destino) para recontagem/relista. Chaves de query estáveis. Respeitar `staleTime`/`gcTime` do projeto.
- Main modules/files: `src/features/admin/hooks/` (ex.: `useUsers.ts`, `useUpdateUserStatus.ts`)
- Dependencies: TASK-02
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD: yes (invalidação dispara nas chaves certas; contadores corretos)
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: Sem realtime push — leitura é por query/refetch. Usuário pending atualiza via "Atualizar status" (já existente).

### TASK-04 – Primitivos Shadcn (tabs, dialog, avatar, badge)
- Type: infra / ui
- Goal: Disponibilizar os componentes base ausentes para o painel.
- Scope: Adicionar via Shadcn `tabs`, `dialog`, `avatar`, `badge` em `src/components/ui/`. Conferir aderência a `design-system/MASTER.md` (tokens/cores). Sem lógica de negócio.
- Main modules/files: `src/components/ui/tabs.tsx`, `dialog.tsx`, `avatar.tsx`, `badge.tsx`
- Dependencies: nenhuma
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD: no
- Recommended screen: no – n/a (primitivos, não tela)
- Design domains: style, color
- Design complexity: low
- Accessibility level: standard
- Notes: `dialog` precisa de foco/teclado acessível (base do modal tela 04). React 19 / Next 15 compat.

### TASK-05 – Gating de acesso admin (route guard + nav role-gated)
- Type: application / ui
- Goal: Tornar o painel exclusivo de `role==="admin"` na UI (camadas 1 e 2 da defesa).
- Scope: `AdminGuard` (ou layout `(app)/admin/layout.tsx`) que, via `useAuth()`, libera só `role==="admin"`; não-admin é redirecionado (ex.: `/home`) mesmo acessando `/admin` por URL direta. Entrada de navegação para `/admin` renderizada **somente** quando `role==="admin"` (forma — item em nav vs menu no Header — definida no `/screen`).
- Main modules/files: `src/app/(app)/admin/layout.tsx` (ou `components/layout/AdminGuard.tsx`), `src/components/layout/nav-items.ts` / `Header.tsx` / `BottomNav.tsx` / `SideNav.tsx`
- Dependencies: nenhuma (usa `useAuth`); precede TASK-06
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD: no (cobertura no /test: admin entra, user é barrado)
- Recommended screen: yes – web – entrada de nav muda estrutura de navegação (item/menu condicional)
- Design domains: ux, product
- Design complexity: low
- Accessibility level: enhanced (item condicional não quebra ordem de foco/aria-current)
- Notes: Defesa em profundidade — não substitui TASK-01. Cuidado com flash de conteúdo antes de `loading` resolver (espelhar padrão do AuthGuard).

### TASK-06 – Painel admin: tabs + lista + contadores (read-only)
- Type: ui
- Goal: Renderizar telas 03/05 — tabs Pendentes/Aprovados/Bloqueados com lista de usuários e contadores.
- Scope: Rota `/admin` (em `(app)`, com AppShell/nav — telas 03/05 têm tabbar). Tabs com contador (badge). Lista: avatar com iniciais, nome, email, data de cadastro (`createdAt` via date-fns `dd/MM/yyyy HH:mm`). Estados de loading/empty/erro por tab. **Sem** as ações ainda (render puro consumindo TASK-03).
- Main modules/files: `src/app/(app)/admin/page.tsx`, `src/features/admin/components/` (UsersPanel, UserList, UserListItem, StatusTabs)
- Dependencies: TASK-03, TASK-04, TASK-05
- Story points: 5
- Criticality: high
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: yes – web – nova página, tabs, lista (estrutura nova)
- Design domains: product, ux, style, color, typography
- Design complexity: high
- Accessibility level: enhanced (tabs com roving focus/aria, lista navegável por teclado)
- Notes: Mobile-first (mock é mobile). Reusar `design-system/MASTER.md`; gerar override de página se preciso. Avatar = iniciais (sem upload). Contadores vêm dos hooks.

### TASK-07 – Ações de moderação + modal de confirmação
- Type: ui / application
- Goal: Habilitar Aprovar / Rejeitar / Bloquear / Desbloquear com confirmação (tela 04).
- Scope: Botões contextuais por tab — Pendentes: Aprovar + Rejeitar(→blocked); Aprovados: Bloquear; Bloqueados: Desbloquear(→approved). Modal "Usuário aprovado!" (tela 04) e confirmações análogas. Disparar `useUpdateUserStatus` (TASK-03); estados pending/disabled nos botões; toast Sonner sucesso/erro (mapear erro de permissão das rules). Pós-sucesso o item troca de tab (via invalidação).
- Main modules/files: `src/features/admin/components/` (UserActions, ConfirmDialog/ApprovedDialog)
- Dependencies: TASK-06, TASK-03
- Story points: 5
- Criticality: high
- Technical risk: high
- Recommended TDD: no (fluxo coberto no /test: cada ação muta o status certo e invalida)
- Recommended screen: yes – web – modal novo + controles de ação na lista
- Design domains: ux, product, style
- Design complexity: medium
- Accessibility level: critical (modal com foco preso, esc, confirmação destrutiva p/ bloquear/rejeitar)
- Notes: Rejeitar e Bloquear são destrutivos — confirmação + variante visual de alerta. Erro das rules (negado) deve render mensagem clara, não falha silenciosa.

### TASK-08 – Ajuste tela 02 (Aguardando aprovação)
- Type: ui
- Goal: Alinhar PendingApprovalScreen ao mock/decisões: adicionar "Sair" e remover promessa de email.
- Scope: Em `PendingApprovalScreen`: adicionar botão **Sair** (logout via `firebaseAuth.signOut` → `/login`, padrão do BlockedScreen) abaixo de "Atualizar status"; **remover** a frase "Você receberá um email quando sua conta for liberada" (A6 — não há email). Manter sem AppShell/nav (constraint).
- Main modules/files: `src/components/layout/PendingApprovalScreen.tsx`
- Dependencies: nenhuma
- Story points: 1
- Criticality: medium
- Technical risk: low
- Recommended TDD: no
- Recommended screen: yes – web – muda layout (novo botão de ação)
- Design domains: ux, style
- Design complexity: low
- Accessibility level: standard
- Notes: Mock 02 mostra "Atualizar status" + "Sair". Logout reusa lógica existente do BlockedScreen.

## 4. Dependency map

```
TASK-01 (rules) ───────────────┐ (independente; gate de segurança)
TASK-02 (service) ──> TASK-03 (hooks) ─┐
TASK-04 (primitivos) ──────────────────┼─> TASK-06 (painel) ──> TASK-07 (ações+modal)
TASK-05 (guard+nav) ───────────────────┘
TASK-08 (tela 02) ─────────────  (independente)
```

## 5. Execution waves (parallel groups)

- **Wave 1** (independentes, fundação): TASK-01, TASK-02, TASK-04, TASK-08
- **Wave 2**: TASK-03 (←02), TASK-05 (independente; agrupado aqui p/ não criar link morto p/ `/admin`)
- **Wave 3**: TASK-06 (←03, 04, 05)
- **Wave 4**: TASK-07 (←06, 03)

## 6. Recommended execution order (sequential fallback)

TASK-01 → TASK-02 → TASK-04 → TASK-08 → TASK-03 → TASK-05 → TASK-06 → TASK-07

Início recomendado: **TASK-01** (segurança é pré-condição de tudo que escreve em `users`; valida o modelo de acesso antes da UI). TASK-02/04/08 podem correr em paralelo logo após.

## 7. Planning risks and blockers

- **B1 — Bootstrap de admin**: testar o painel exige ≥1 usuário `role:"admin"`; promoção é fora de banda (Cloud Function/console — fora de escopo). Bloqueia validação de TASK-05/06/07. Providenciar um admin manual no projeto Firebase antes do `/test`.
- **B2 — RESOLVIDO**: emulator JÁ configurado (`test:rules`, `vitest.rules.config.ts`, `@firebase/rules-unit-testing`). Requer Java local p/ rodar — confirmar no `/test`.
- **R1 — Privilege escalation**: rules JÁ corretas e testadas (C6/C7/C10). TASK-01 só amplia cobertura. Mantém atenção no `/review`/`/security`.
- **R2 — Invalidação de cache (TASK-03)**: esquecer destino/origem das tabs gera contagem obsoleta. Cobrir em teste.
- **R3 — Flash de não-autorizado (TASK-05)**: redirecionar só após `loading` resolver, espelhando AuthGuard.
- **R4 — RESOLVIDO**: regra admin (`update: if isAdmin()`) libera qualquer campo → `updatedAt` junto de `status` passa. Sem ação.
- **NOTA descoberta**: `firestore.rules` JÁ existia (PRD assumiu ausência). Modelo de acesso de `users` já implementado e testado — TASK-01 vira ampliação de testes, não autoria.
