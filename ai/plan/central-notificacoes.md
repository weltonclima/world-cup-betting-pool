# PLAN — Central de Notificações (PRD-08)

> Origem: `ai/prd/central-notificacoes.md`. Feature nova (`features/notifications` inexistente).
> **Sem Cloud Functions** (Spark). Bell integra ao `Header.tsx` existente. Liga ao PRD-06.

## 1. Planning summary

8 tarefas. Fundação: schemas + service + Rules + primitivo `switch`. UI: lista+filtros, detalhe,
preferências, bell+badge no Header. Geração de notificações nos pontos de evento existentes
(aprovação/bloqueio garantidos; ranking/jogos best-effort — A2).

- Tasks com `/screen`: 4 (TASK-04 lista, 05 detalhe, 06 preferências, 07 bell+badge)
- Tasks com TDD recomendado: 2 (TASK-01 schema/service, TASK-02 Rules)
- Domínios de design: product (notification center), ux (lista/filtros/detalhe/switches), style (MASTER.md)

## 2. Recommended execution phases

1. **Fundação** — schemas + service + Rules + switch (TASK-01, 02, 03)
2. **Geração** — criar notificações nos eventos existentes (TASK-08)
3. **UI** — lista+filtros, detalhe, preferências (TASK-04, 05, 06)
4. **Header** — bell + badge (TASK-07)

## 3. Tasks

### TASK-01 – Schemas + service de notificações e preferências
- Type: persistence / domain
- Goal: Definir dados e CRUD client-side de `notifications` e `notificationPreferences`.
- Scope: `schemas/notifications.ts` (`{id, userId, type, title, message, isRead, createdAt}`;
  `type` ∈ system|games|ranking|pool). `schemas/notificationPreferences.ts`
  (`{userId, system, games, ranking, pool}` booleans). `services/notifications.ts`:
  `listNotifications(uid, filter?)`, `getNotification(id)`, `markAsRead(id)`, `markAllAsRead(uid)`,
  `createNotification(payload)`, `getPreferences(uid)`, `updatePreferences(uid, prefs)`.
  `createNotification` respeita preferências (não cria se categoria off — A2).
- Files: `src/schemas/notifications.ts`, `src/schemas/notificationPreferences.ts`,
  `src/services/notifications.ts`, `src/services/index.ts`, `src/schemas/index.ts`
- Dependencies: nenhuma
- Story points: 5 · Criticality: high · Risk: medium
- TDD: yes (schema; createNotification respeita preferência off; markAsRead; filtro por tipo)
- Screen: no – n/a

### TASK-02 – Firestore Rules: notifications + preferences
- Type: security
- Goal: Isolar dados por usuário; permitir admin criar p/ terceiros (A1).
- Scope: estender `firestore.rules`: `notifications/{id}` `read,update(isRead): userId==auth.uid`;
  `create: isAdmin() || resource.userId==auth.uid` (admin cria p/ terceiros; campos validados);
  sem delete. `notificationPreferences/{uid}`: dono read/write. Testes de rules.
- Files: `firestore.rules`, `test/rules/firestore.rules.test.ts`
- Dependencies: TASK-01 (forma dos docs)
- Story points: 3 · Criticality: high · Risk: medium
- TDD: yes (dono lê só as suas; admin cria p/ terceiro; user não cria p/ terceiro; deny delete)
- Screen: no – n/a

### TASK-03 – Primitivo Shadcn `switch` + hooks base
- Type: infra / application
- Goal: Componente switch + hooks React Query.
- Scope: adicionar `components/ui/switch.tsx` (Shadcn, tokens MASTER.md). Hooks:
  `useNotifications(filter)`, `useNotification(id)`, `useUnreadCount()`, `usePreferences()`,
  `useUpdatePreferences()`, `useMarkAsRead()`. Query keys `["notifications"]`,`["notification",id]`,
  `["notification-preferences"]`,`["notifications-unread"]`.
- Files: `src/components/ui/switch.tsx`, `src/features/notifications/hooks/*`,
  `src/features/notifications/hooks/notificationKeys.ts`
- Dependencies: TASK-01
- Story points: 3 · Criticality: medium · Risk: low
- TDD: no · Screen: no

### TASK-04 – Central de Notificações: lista + filtros (PRD08-01)
- Type: ui
- Goal: Tela lista com filtros e marcação de leitura ao abrir.
- Scope: `(app)/notificacoes/page.tsx`. Lista (título, msg resumida, data, status leitura);
  filtros Todas/Sistema/Jogos/Ranking/Bolão (tabs). Abrir item → marca lida + navega detalhe.
  Estados loading(skeleton)/empty("Nenhuma notificação")/error(+Tentar novamente).
- Files: `src/app/(app)/notificacoes/page.tsx`,
  `src/features/notifications/components/NotificationList.tsx`,
  `src/features/notifications/components/NotificationItem.tsx`,
  `src/features/notifications/components/NotificationFilters.tsx`
- Dependencies: TASK-03
- Story points: 5 · Criticality: high · Risk: low
- TDD: no · Screen: **yes** – nova página (fonte `PRD08-01`)
- Design: product, ux, style · complexity: medium · a11y: enhanced

### TASK-05 – Detalhe da Notificação (PRD08-02)
- Type: ui
- Goal: Tela de detalhe com ações contextuais por tipo.
- Scope: `(app)/notificacoes/[id]/page.tsx`. Título, mensagem completa, data, hora. Ações conforme
  tipo (lib `notificationActions`: ranking→Ver Ranking; games→Ver Jogo; sempre Voltar). `useNotification`.
- Files: `src/app/(app)/notificacoes/[id]/page.tsx`,
  `src/features/notifications/components/NotificationDetail.tsx`,
  `src/features/notifications/lib/notificationActions.ts`
- Dependencies: TASK-03
- Story points: 3 · Criticality: medium · Risk: low
- TDD: no · Screen: **yes** – nova página (fonte `PRD08-02`)
- Design: product, ux · complexity: low · a11y: enhanced

### TASK-06 – Preferências de Notificação (PRD08-03)
- Type: ui / application
- Goal: Switches On/Off por categoria, ligados a Perfil.
- Scope: `(app)/notificacoes/preferencias/page.tsx`. Switches Sistema/Jogos/Ranking/Bolão
  (`usePreferences` + `useUpdatePreferences`, RHF). Linkado de Perfil→Configurações→"Gerenciar
  Notificações" (PRD-06 TASK-08). Toast Sonner ao salvar.
- Files: `src/app/(app)/notificacoes/preferencias/page.tsx`,
  `src/features/notifications/components/PreferencesForm.tsx`
- Dependencies: TASK-03
- Story points: 3 · Criticality: medium · Risk: low
- TDD: no · Screen: **yes** – nova página (fonte `PRD08-03`)
- Design: ux, forms · complexity: low · a11y: critical (switch com label/aria)

### TASK-07 – Bell + badge no Header (PRD08 Header)
- Type: ui / application
- Goal: Sino com contador de não-lidas no Header.
- Scope: integrar ícone 🔔 ao `Header.tsx` (ao lado do admin link). Badge com `useUnreadCount`
  (oculto se 0). Clique → `/notificacoes`. Acessível (aria-label com contagem).
- Files: `src/components/layout/Header.tsx`,
  `src/features/notifications/components/NotificationBell.tsx`
- Dependencies: TASK-03
- Story points: 3 · Criticality: high · Risk: low
- TDD: no · Screen: **yes** – muda Header (novo controle)
- Design: ux, style · complexity: low · a11y: enhanced

### TASK-08 – Geração de notificações nos eventos existentes
- Type: application
- Goal: Disparar `createNotification` nos pontos de evento client-side.
- Scope: instrumentar `useUpdateUserStatus` (aprovação→system "Cadastro aprovado"; bloqueio→"Conta
  bloqueada"; desbloqueio→"Conta reativada") criando notificação no doc do **usuário-alvo** (Rules
  TASK-02 permitem admin). Ranking/Jogos = best-effort onde houver hook client-side (senão pendência
  documentada — A2/A4).
- Files: `src/features/admin/hooks/useUpdateUserStatus.ts` (extensão),
  `src/features/notifications/lib/notificationFactory.ts`
- Dependencies: TASK-01, TASK-02
- Story points: 3 · Criticality: medium · Risk: medium
- TDD: no (service coberto TASK-01) · Screen: no
- Notes: Respeitar preferências antes de criar. Ranking/Jogos automáticos = pendência se sem gatilho.

## 4. Dependency map

```
TASK-01 (schema/service) ─┬─> TASK-02 (rules) ─> TASK-08 (geração)
                          └─> TASK-03 (switch+hooks) ─┬─> TASK-04 (lista)
                                                       ├─> TASK-05 (detalhe)
                                                       ├─> TASK-06 (preferências)
                                                       └─> TASK-07 (bell+badge)
```

## 5. Execution waves

- **Wave 1** (fundação): TASK-01
- **Wave 2**: TASK-02 (←01), TASK-03 (←01)
- **Wave 3**: TASK-04, TASK-05, TASK-06, TASK-07 (←03), TASK-08 (←02)

## 6. Sequential fallback

TASK-01 → TASK-02 → TASK-03 → TASK-08 → TASK-07 → TASK-04 → TASK-05 → TASK-06

Início recomendado: **TASK-01** (schemas/service são base de tudo).

## 7. Planning risks

- **B1 — Geração Ranking/Jogos (A2/A4):** sem Cloud Function, depende de gatilho client-side. Só
  aprovação/bloqueio garantidos V1; resto = pendência documentada.
- **B2 — Criação cross-user (A1):** admin cria notificação no doc de terceiro; Rules devem validar
  campos p/ evitar abuso.
- **R1 — Badge sem realtime:** contador via refetch (staleTime/onFocus); pequena defasagem aceitável.
- **R2 — Preferências liga a PRD-06:** link "Gerenciar Notificações" depende de Configurações (PRD-06
  TASK-08); rota própria `/notificacoes/preferencias` funciona standalone.
