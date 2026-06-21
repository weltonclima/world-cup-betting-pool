# PRD — Web Push + PWA

> Slug: `web-push-pwa`. Sucede PRD-15 (notificações in-app). Escopo travado pelo usuário: **PWA instalável + Web Push** (não Capacitor, não App Store).

## 1. Feature summary

Entregar notificações **no dispositivo** (fora do app aberto) para um web app Next.js já existente, transformando-o em **PWA instalável** e adicionando **Web Push** via Firebase Cloud Messaging (FCM).

Hoje (PRD-15) as notificações são **in-app apenas**: gravadas em `notifications/{id}` (Firestore) e exibidas no sino (`NotificationBell`) quando o usuário abre o app. App fechado = nada chega. Esta feature adiciona a camada de entrega push: o mesmo evento que hoje grava o doc também envia uma push para os dispositivos registrados do usuário, gated por preferência.

**Plataformas-alvo:**
- **Android (Chrome):** push funciona com PWA instalado ou aba normal (service worker basta).
- **iOS (Safari ≥16.4):** push **só** se o usuário instalar o PWA na tela inicial ("Adicionar à Tela de Início"). Aba normal do Safari = sem push. Limitação da Apple, não contornável neste caminho.
- **Desktop (Chrome/Edge/Firefox):** push funciona como bônus.

## 2. Consolidated scope

**Dentro do escopo:**
1. **PWA installable** — `manifest.webmanifest` (nome, ícones, theme, display standalone, start_url), ícones em múltiplas resoluções, meta tags iOS (`apple-mobile-web-app-*`, apple-touch-icon). App passa no critério "instalável" do Chrome e é adicionável à tela inicial no iOS.
2. **Service worker** — `firebase-messaging-sw.js` (background push handler) + SW base. Recebe mensagens FCM com app fechado/background, exibe notificação do sistema, trata clique (abre/foca a rota relevante).
3. **Client de permissão + token FCM** — UI para o usuário **optar** por push (pedir `Notification.requestPermission()` no momento certo, não no load). Obter token FCM via `firebase/messaging` (`getToken` com VAPID key). Renovar/revalidar token. Tratar negação e browsers sem suporte.
4. **Token store** — persistir tokens FCM por usuário no Firestore (`fcm_tokens` ou subcoleção), múltiplos dispositivos por usuário, com metadados (userAgent, criado em, último visto). Limpeza de tokens inválidos (FCM retorna `messaging/registration-token-not-registered`).
5. **Envio server-side** — camada que, junto ao `writeNotifications` atual, envia push via `admin.messaging().sendEachForMulticast()` para os tokens do usuário, **respeitando as mesmas preferências** (`shouldDeliver`). Best-effort (falha de push nunca derruba o fluxo de negócio). Poda tokens mortos pelo retorno do FCM.
6. **Foreground handling** — com app aberto, `onMessage` evita push duplicada (já há sino + toast); decide entre toast in-app vs push do SO.
7. **Preferência push** — estender `notificationPreferences` com opt-in/out de push (distinto do opt-in in-app por tipo, ou reusar os toggles existentes — ver ambiguidades).

**Fora do escopo:**
- Capacitor / APK / App Store / APNs nativo (decisão registrada: fase 2 se iOS sem-PWA virar requisito).
- Offline-first / cache de assets além do mínimo para "installable" (PWA aqui é veículo de push, não app offline).
- Novos tipos de notificação — reusa `system` / `games` / `ranking` do PRD-15.
- Rich push (imagens, action buttons além de abrir) — pode ser fase posterior.

## 3. System understanding relevant to this feature

**Stack:** Next.js 15 App Router, React 19, TS strict, SSR em Firebase App Hosting (Cloud Run). Firebase já presente: client SDK (`src/firebase/client.ts`) e Admin SDK (`src/server/firebaseAdmin.ts`).

**Notificações PRD-15 (a base que esta feature estende):**
- Server-only em `src/server/notifications/`: `factory.ts` (copy por evento), `preferences.ts` (`fetchPreferencesMap` + `shouldDeliver` gate), `write.ts` (`writeNotifications` batch chunked ≤500, append-only, ID determinístico p/ idempotência), `ranking.ts` (`notifyRankingUps`).
- **4 pontos de disparo** (todos server-side, best-effort, já existentes):
  1. `api/predictions/score/route.ts` → `notifyScoreHitsBestEffort` (acertos de palpite).
  2. `api/rankings/recalc/route.ts` + `api/group/rankings/recalc/route.ts` → `notifyRankingUps` (subida de posição).
  3. `api/group/users/_moderation.ts` → moderação (block/unblock).
  4. `api/group/users/promote/route.ts` → promoção a group_admin.
- Gate de preferência: `system` ignora opt-out; `games`/`ranking` respeitam `notificationPreferences/{uid}`.
- Disparo via GitHub Actions cron (`score-cron.yml`, ~30min) que chama `/api/predictions/score` com `x-cron-secret`. Push herda esse pulso automaticamente.

**Firebase config client** (`src/firebase/client.ts`) já lê `NEXT_PUBLIC_FIREBASE_*` incl. `messagingSenderId` e `appId` — pré-requisitos do FCM já presentes. Falta: VAPID key e wiring de `getMessaging`.

**Firestore Rules** (deny-by-default): nova coleção de tokens precisa de regra. Padrão do projeto: dados sensíveis = write `if false` (Admin SDK only) ou owner-scoped. Token FCM é gravado pelo client após permissão → precisa decidir client-write gated vs Route Handler.

## 4. Technical impact analysis

**Módulos afetados:**
- **Novo:** `public/firebase-messaging-sw.js`, `public/manifest.webmanifest`, ícones PWA em `public/`. (Hoje `public/` só tem 2 logos — diretório quase vazio.)
- **Novo:** `src/features/push/` (ou estende `notifications/`) — hook de permissão/token client-side, UI de opt-in.
- **Novo:** `src/server/notifications/push.ts` — envio FCM via Admin Messaging + poda de tokens.
- **Novo:** `src/services/pushTokens.ts` + Route Handler `api/push/tokens` (registrar/remover token) **ou** client-write gated por Rules.
- **Estende:** `src/firebase/client.ts` — `getMessaging`/`getToken`/`onMessage` (client-only, guard SSR).
- **Estende:** os 4 pontos de disparo (ou centraliza no `write.ts`) para chamar push após gravar in-app.
- **Estende:** `src/schemas/notificationPreferences.ts` — flag push (se preferência separada).
- **Layout/root:** `app/layout.tsx` — registrar manifest, meta tags iOS, registrar SW.

**Contratos / dados:**
- Nova coleção Firestore `fcm_tokens/{token}` ou `users/{uid}/fcmTokens/{token}`. Schema Zod novo (token, userId, userAgent, createdAt, lastSeenAt).
- `notificationPreferences` schema possivelmente +1 campo → migração tolerante (default).
- Firestore Rules + possivelmente índice.

**Integrações externas:**
- **FCM** (já é Firebase, mesmo projeto `world-cup-betting-pool-8e93c`). Precisa habilitar Cloud Messaging API e gerar **VAPID key** (par de chaves Web Push) no console Firebase.
- Admin SDK `messaging()` — já disponível via `firebase-admin` 13.10.0 (sem dep nova server-side).

**Arquitetura / rollout:**
- Push é **aditivo e best-effort** — não altera o caminho in-app existente. Feature flag implícito: usuário sem token = só in-app (degrada graciosamente).
- App Hosting/Cloud Run serve `public/` estático — SW e manifest entregues como assets. **Atenção ao escopo do SW** (`/firebase-messaging-sw.js` na raiz para escopo `/`).

## 5. Risks

- **iOS é frágil por design:** push só com PWA instalado, ≥16.4, e o usuário **precisa instalar manualmente** (não há prompt automático no iOS). Risco de expectativa: "não recebo no iPhone" será comum se o usuário não instalou. Mitigar com UX de instrução clara.
- **Service worker scope/caching:** SW mal configurado pode cachear HTML e servir versão velha do app (regressão clássica de PWA). Manter SW mínimo (só push), sem cache de navegação, ou cache versionado.
- **Permissão negada é permanente-ish:** se o usuário nega, o browser não re-pergunta facilmente. Pedir no momento certo (após ação intencional), não no load. Risco de queimar a permissão.
- **Tokens mortos / multi-device:** token FCM expira/roda; enviar para token morto retorna erro — precisa poda, senão acumula lixo e custo. Multi-device exige fan-out por token, não por usuário.
- **Push duplicada com in-app:** app aberto pode mostrar sino + toast + push do SO ao mesmo tempo. `onMessage` foreground precisa suprimir a push do SO.
- **Segredos/config:** VAPID key pública vai no client (`NEXT_PUBLIC_`); a privada fica no Firebase (Admin já autentica via service account — sem segredo extra server-side). Não confundir com `SCORE_SECRET`/`RANKINGS_SECRET` (linhas 45-46 do `.env.production.example`, já existentes, não relacionados a push).
- **Idempotência do cron:** cron re-roda scoring; push **não tem ID determinístico** como o doc in-app — risco de re-enviar push do mesmo evento. Precisa de guarda (ex.: só push para hits recém-criados, não re-enviar para docs já existentes via `writeNotifications` idempotente).
- **Custo/escala:** FCM é grátis em volume razoável, mas fan-out por token em recalc de pool inteiro multiplica chamadas. Batch via `sendEachForMulticast` (até 500/call).

## 6. Ambiguities and gaps

1. **Preferência push: nova flag ou reusa toggles existentes?** `notificationPreferences` hoje tem `games`/`ranking` (system sempre entrega). Push deve: (a) respeitar os mesmos toggles, (b) ter um master switch "push on/off" separado, ou (c) toggle por-tipo independente do in-app? **Recomendo:** master switch push + reusar os toggles por-tipo existentes.
2. **Token store: client-write gated (Rules) ou Route Handler (Admin SDK)?** Projeto tende a Admin SDK para writes sensíveis, mas token FCM é low-risk e owner-scoped. **Recomendo:** Route Handler `api/push/tokens` (consistência com o padrão write-server-side).
3. **`system` ignora opt-out in-app — vale para push também?** Moderação/promoção devem furar o opt-out de push? Provavelmente **não** (push é mais intrusivo) — push deve respeitar opt-out até para system, ou ao menos um master switch. Precisa decisão.
4. **Idempotência de push no cron:** como garantir 1 push por evento sob re-run? Opção: `writeNotifications` retornar quais docs foram **criados de fato** (vs sobrescritos) e só pushar esses. Hoje `write.ts` faz `set` cego (não distingue). Pode exigir ajuste.
5. **Onde centralizar o envio?** Dentro de `writeNotifications` (toda notificação vira push) ou camada separada chamada nos 4 sites? Centralizar reduz repetição mas acopla push ao write in-app. **Recomendo:** função `deliverNotifications` que faz write in-app + push, chamada nos 4 sites.
6. **Ícones PWA:** precisam ser gerados (192, 512, maskable, apple-touch). Há logo-base (`public/logo-*.png`) — usar como fonte?
7. **`apphosting.yaml` / headers:** SW precisa de header correto (`Service-Worker-Allowed`) e o manifest de content-type. Verificar se App Hosting serve `public/` com os headers certos.

## 7. Recommended implementation concerns

- **Ordem natural de tasks** (para o `/plan`): (1) PWA installable base — manifest + ícones + meta + registro SW; (2) FCM client — messaging init + VAPID + permissão/token UI; (3) token store — schema + Route Handler + Rules; (4) envio server-side — `push.ts` + poda + integração nos 4 sites; (5) preferência push + foreground dedup; (6) hardening iOS (instruções de instalação) + idempotência cron.
- **Best-effort em tudo:** nenhum erro de push pode afetar scoring/recalc/moderação. Espelhar o padrão `notifyRankingUps`/`notifyScoreHitsBestEffort` (try/catch, nunca lança).
- **SW mínimo:** só push, sem cache de navegação, para evitar regressão de stale app. Se cachear assets depois, versionar.
- **Testar idempotência sob cron** antes de produção — é o maior risco funcional (spam de push).
- **Lazy-load do messaging:** `getMessaging`/`getToken` client-only, atrás de guard SSR e de `isSupported()` (FCM web não suporta todos os browsers).
- **Frontend (`is_frontend: true`)** nas tasks de UI de opt-in e instruções de instalação iOS — passam por `/ui-spec` + `/patterns:nextjs`.
