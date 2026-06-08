# PRD — Central de Notificações (PRD-08)

> Fonte: `docs/prd-08/PRD-08-Central-Notificacoes.md` + PNGs `PRD08-01..03` (fonte de verdade visual).
> Feature slug: `central-notificacoes`. Versão 1.0. **Compatível Firebase Spark (sem Cloud Functions).**

## 0. Decisões travadas (modo automático)

| Ref | Decisão |
|-----|---------|
| D1 | **Sem Cloud Functions / FCM / email / push** (escopo V1 explícito). Notificações = docs Firestore lidas/escritas pelo client. |
| D2 | **Geração de notificações:** criadas client-side nos pontos de evento já existentes (aprovação/bloqueio admin via `useUpdateUserStatus`; atualização de ranking; novos jogos via Route Handlers). Serviço `createNotification`. |
| D3 | **Header bell + badge** integrados ao `Header.tsx` existente (hoje só tem link admin). |
| D4 | **Preferências** vivem em Perfil → Notificações (liga ao PRD-06 Configurações "Gerenciar Notificações"). |

## 1. Feature summary

Central de Notificações in-app. Sino no Header com badge de não-lidas; tela lista com filtros por
categoria (Todas/Sistema/Jogos/Ranking/Bolão); tela de detalhe com ações contextuais (Ver Ranking /
Ver Jogo / Voltar); tela de Preferências (switches por categoria) acessível pelo Perfil. Tudo via
Firestore, sem serviços pagos.

## 2. Consolidated scope

**Três telas (fonte de verdade = PNGs):**

1. **Central de Notificações** (`PRD08-01`): lista com Título, mensagem resumida, data, status de
   leitura; filtros Todas/Sistema/Jogos/Ranking/Bolão. Estados loading(skeleton)/empty/error.
   Abrir item → marca como lida.
2. **Detalhe da Notificação** (`PRD08-02`): Título, mensagem completa, data, hora; ações conforme
   tipo (Ver Ranking / Ver Jogo / Voltar).
3. **Preferências de Notificação** (`PRD08-03`): switches On/Off por categoria (Sistema, Jogos,
   Ranking, Bolão). Localização: Perfil → Notificações.

**Header/Badge:** ícone 🔔 no Header; badge com contador de não-lidas (ex.: 🔔 3).

**Tipos de notificação:** Sistema (cadastro aprovado/rejeitado, conta bloqueada/reativada), Jogos
(novos jogos, prazo encerrando, fase liberada), Ranking (atualizado, mudança de posição, top 10),
Bolão (início Copa, encerramento fase/bolão).

**Em escopo:** coleções `notifications` e `notificationPreferences`; serviço CRUD client-side;
hooks React Query (`["notifications"]`, `["notification", id]`, `["notification-preferences"]`);
geração de notificações nos pontos de evento existentes; Header bell+badge; 3 telas; Firestore Rules
(usuário só acessa as próprias).

**Fora de escopo (V1):** Push, FCM, email, WhatsApp, Telegram, Cloud Functions.

## 3. System understanding (relevant parts only)

- **Não existe** `features/notifications/`. Criar do zero.
- `Header.tsx` existe (link admin role-gated) → adicionar bell+badge.
- `services/users.ts`, `features/admin/hooks/useUpdateUserStatus.ts` — pontos onde gerar
  notificações de Sistema (aprovação/bloqueio).
- `services/rankings.ts` / Route Handlers — pontos p/ notificações de Ranking/Jogos (best-effort
  client-side; sem Cloud Function).
- `firestore.rules` existe na raiz → adicionar regras `notifications`/`notificationPreferences`.
- UI base: badge, tabs (filtros), sheet/dialog, skeleton patterns (reuso de `RankingSkeleton` style),
  switch (**provável novo primitivo Shadcn** p/ preferências). date-fns p/ data/hora.
- React Query infra (`providers/`), `_apiClient.ts`.

## 4. Technical impact analysis

- **STACK:** Next.js App Router (rotas `(app)/notificacoes`, `(app)/notificacoes/[id]`,
  preferências em `(app)/profile/configuracoes/notificacoes` ou `(app)/notificacoes/preferencias`),
  TanStack Query, Zod, RHF (preferências), Shadcn (switch, badge, tabs), date-fns, Sonner.
- **ARCHITECTURE:**
  - `schemas/notifications.ts` + `schemas/notificationPreferences.ts`.
  - `services/notifications.ts`: `listNotifications(uid, filter)`, `getNotification(id)`,
    `markAsRead(id)`, `markAllAsRead(uid)`, `createNotification(payload)`, `getPreferences(uid)`,
    `updatePreferences(uid, prefs)`.
  - `features/notifications/`: hooks (`useNotifications`, `useNotification`, `useUnreadCount`,
    `usePreferences`), components (lista, item, filtros, detalhe, preferências form, bell+badge),
    lib (mapeamento tipo→ação/rota, agrupamento por data).
  - Integrar bell no `Header.tsx`; badge usa `useUnreadCount`.
  - Hook de geração: chamar `createNotification` respeitando `notificationPreferences` do usuário
    (não criar se categoria desligada).
- **INTEGRATIONS / persistência:** `notifications/{id}` (userId, type, title, message, isRead,
  createdAt), `notificationPreferences/{uid}` (system, games, ranking, pool booleans).
- **CONCERNS:**
  - **Segurança:** Rules — usuário lê/atualiza só `notifications` onde `userId==auth.uid`;
    `notificationPreferences/{uid}` só o dono. Quem **cria** notificação p/ outro usuário? Sem
    Cloud Function, o admin (client) cria notificação no doc de outro usuário (ex.: aprovação) →
    Rules precisam permitir admin `create` em `notifications` de terceiros. A1.
  - **Geração sem backend:** eventos de ranking/jogos disparados por scheduler/Route Handler — sem
    Cloud Function, geração depende de quem dispara o update rodar client-side. Cobertura parcial. A2.
  - **Badge realtime vs polling:** React Query staleTime; sem realtime push. Polling/refetch on focus.

## 5. Risks

- **Criação cross-user sem Cloud Function:** admin client cria notificação no doc de outro usuário →
  Rules mais permissivas p/ admin (risco se mal modeladas). Mitigar: Rules restritas (admin só cria,
  campos validados).
- **Notificações de Ranking/Jogos** podem não ter gatilho client-side confiável (dependem de
  scheduler server-side) → cobertura parcial; documentar quais tipos realmente disparam V1.
- **Badge sem realtime:** contador pode ficar levemente desatualizado (aceitável V1).
- **Switch primitivo** ausente no Shadcn local → adicionar.

## 6. Ambiguities and gaps

| # | Ambiguidade | Resolução adotada |
|---|---|---|
| A1 | Quem cria notificação de Sistema p/ outro usuário (aprovação) sem Cloud Function | **Admin client** cria via `createNotification`; Rules permitem admin `create` em `notifications` de terceiros (campos validados). |
| A2 | Notificações de Ranking/Jogos — gatilho real V1 | ✅ **RESOLVIDO: só Sistema garantido V1** (aprovação/bloqueio/reativação via admin client-side). Serviço + Rules + telas completos (recebem qualquer tipo). Ranking/Jogos/Bolão = pendência documentada até gatilho server-side. |
| A3 | Rota das Preferências | `(app)/notificacoes/preferencias`, linkada de Perfil→Configurações→"Gerenciar Notificações". |
| A4 | "Fase liberada", "novos jogos" — origem | Dependem de integracao-api-football; gerar quando Route Handler de matches detectar novidade (pendência se não houver hook). |
| A5 | Ordenação/paginação da lista | Ordenar `createdAt` desc; <100 users, sem paginação V1 (limit 50). |

## 7. UI/Layout impact

- **UI Impact:** yes
- **Platforms:** both (mobile-first; PNGs mobile)
- **Screens:** Central de Notificações, Detalhe da Notificação, Preferências de Notificação +
  alteração no Header (bell+badge).
- **Product type:** central de notificações in-app de PWA de bolão esportivo.
- **Recommended style direction:** travada por `design-system/MASTER.md` (verde Copa, cards, badges,
  Shadcn, mobile-first). Overrides p/ lista/detalhe/preferências.
- **Design complexity:** medium.

## 8. Implementation concerns (high-level, no tasks yet)

- `schemas/` + `services/notifications.ts` (CRUD + preferências).
- `features/notifications/`: hooks, lista+filtros, detalhe, preferências (RHF+switch), bell+badge.
- Integrar bell no `Header.tsx`; `useUnreadCount`.
- Geração nos pontos de evento existentes (aprovação/bloqueio garantidos; ranking/jogos best-effort).
- Firestore Rules: `notifications` (dono lê/atualiza; admin cria p/ terceiros),
  `notificationPreferences` (dono). Adicionar primitivo `switch` Shadcn.
- Respeitar preferências antes de criar notificação. Estados loading/empty/error; responsividade.
- Liga ao PRD-06 (Configurações→Gerenciar Notificações) — depende de Perfil hub.
