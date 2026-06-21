# PLAN — Web Push + PWA

> Fonte: `ai/prd/web-push-pwa.md`. Escopo: PWA instalável + Web Push (FCM). Aditivo ao PRD-15 (in-app), best-effort, degrada gracioso.

## 1. Planning summary

7 tasks em 5 fases. Fundação primeiro (PWA instalável + token store), depois client FCM, depois envio server-side + idempotência (núcleo de risco), depois UX/preferências, por fim validação/release. Risco concentra em **TASK-04** (envio + poda, integration crítica) e **TASK-07** (idempotência push sob cron — maior risco funcional do PRD). iOS é risco de produto, endereçado em **TASK-06**.

## 2. Recommended execution phases

- **Phase 1 – Fundação:** TASK-01 (PWA instalável), TASK-03 (token store) — independentes, paralelizáveis.
- **Phase 2 – Client FCM:** TASK-02 (messaging init + permissão + token).
- **Phase 3 – Envio server-side:** TASK-04 (push.ts + poda + integração nos 4 sites), TASK-07 (idempotência cron).
- **Phase 4 – UX & preferências:** TASK-05 (preferência push + foreground dedup), TASK-06 (UX instalação iOS/Android).
- **Phase 5 – Validação & release:** `/local-env` + `/release` (fora das tasks).

## 3. Tasks

### TASK-01 – PWA instalável (manifest + ícones + SW base + registro)
- Type: infra
- Goal: tornar o app instalável (critério Chrome) e adicionável à tela inicial no iOS, com service worker registrado.
- Scope: `manifest.webmanifest` (nome, theme, display standalone, start_url, ícones), ícones PWA (192/512/maskable/apple-touch) gerados a partir das logos existentes, meta tags iOS (`apple-mobile-web-app-*`), service worker base + registro no client. SW mínimo (sem cache de navegação, evita stale app). **Headers App Hosting (escopo explícito, não opcional):** `Service-Worker-Allowed: /`, content-type do manifest, `Cache-Control` do SW (sem cache do próprio SW). **Done:** `curl` aos headers do deploy confirma SW scope aceito + manifest servido + SW não-cacheado.
- Main modules/files likely involved: `public/manifest.webmanifest`, `public/icons/*`, `public/sw.js` (base), `src/app/layout.tsx` (link manifest + meta + registro SW), `apphosting.yaml` (headers SW/manifest).
- Dependencies: nenhuma.
- Story points: 3
- Criticality: medium
- Technical risk: medium
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/medium
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, ui-spec, implement, test, review
- Notes: is_frontend: true (manifest/meta/registro). SW caching errado = regressão de app velho — manter SW mínimo. Validar header `Service-Worker-Allowed` e content-type do manifest no App Hosting.

### TASK-02 – Client FCM (messaging init + VAPID + permissão + token)
- Type: integration
- Goal: obter permissão de notificação e token FCM do dispositivo, client-side, com guards de suporte/SSR.
- Scope: estender `src/firebase/client.ts` com `getMessaging`/`isSupported` (client-only, guard SSR); hook `usePushRegistration` (pede `Notification.requestPermission()` no momento intencional, obtém `getToken` com VAPID key, trata negação/sem-suporte); `firebase-messaging-sw.js` (background handler) com config FCM; envio do token ao backend (consome TASK-03). VAPID key pública via `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
- Scope adicional (gaps do plan-checker):
  - **SW `notificationclick`** — abre/foca a rota do payload (`clients.openWindow`/focus via `data.url`). Consome o **contrato de payload** definido em TASK-04 (mesmo shape `notification`+`data`).
  - **Gate iOS standalone** — em iOS, só pedir `requestPermission`/`getToken` se `display-mode: standalone` (`navigator.standalone` / `matchMedia('(display-mode: standalone)')`). Aba não-instalada = não pede (não queima permissão).
  - **Token lifecycle** — re-registra token no app load / `onTokenRefresh` (atualiza `lastSeenAt`); no **logout** ou permissão revogada chama `deleteToken` + DELETE em `api/push/tokens` (evita push cruzada em device compartilhado).
  - **Done:** browser sem suporte → opt-in oculto/desabilitado, sem erro lançado.
- Main modules/files likely involved: `src/firebase/client.ts`, `src/firebase/env.ts` (+VAPID), `public/firebase-messaging-sw.js`, `src/features/push/hooks/usePushRegistration.ts`, `src/firebase/messaging.ts` (novo), `src/providers/AuthProvider` (hook de logout p/ cleanup).
- Dependencies: TASK-01 (SW registrado / app instalável). **Pre-gate:** Cloud Messaging API habilitada + `NEXT_PUBLIC_FIREBASE_VAPID_KEY` presente (ação manual no console Firebase) — hard-stop, não iniciar sem isso.
- Story points: 5
- Criticality: high
- Technical risk: high
- Recommended TDD later: no
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: opus/high
  - test: sonnet/medium
  - review: opus/high
- Status: done
- Phases done: spec, implement, test, review
- Notes: is_frontend: true. APIs de browser (Notification, ServiceWorker, FCM) difíceis de unit-testar → TDD não aplica; testar via mocks de `firebase/messaging`. Pedir permissão no momento certo (não no load) — queima a permissão. context7: `firebase/messaging` web API.

### TASK-03 – Token store (schema + Route Handler + Rules)
- Type: persistence
- Goal: persistir tokens FCM por usuário (multi-device), com registro/remoção via Route Handler e Rules.
- Scope: schema Zod `fcmToken` (token, userId, userAgent, createdAt, lastSeenAt); coleção `fcm_tokens/{token}` (ou subcoleção `users/{uid}/fcmTokens`); Route Handler `api/push/tokens` (POST registra/atualiza lastSeen, DELETE remove) com Admin SDK + auth→approved; service client `src/services/pushTokens.ts`; Firestore Rules (write `if false`, leitura owner ou negada) + índice se necessário.
- Main modules/files likely involved: `src/schemas/fcmToken.ts`, `src/app/api/push/tokens/route.ts`, `src/services/pushTokens.ts`, `firestore.rules`, `firestore.indexes.json`, `src/server/notifications/tokens.ts` (helpers de leitura/poda compartilhados com TASK-04).
- Dependencies: nenhuma (paralelo a TASK-01).
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: TDD no Route Handler (auth gate + upsert idempotente por token). Padrão write-server-side (consistência com projeto). Rules test em `test/rules/`.

### TASK-04 – Envio server-side (push.ts + poda + integração 4 sites)
- Type: integration
- Goal: enviar push via Admin Messaging para os tokens do usuário, gated por preferência, best-effort, podando tokens mortos; integrar nos 4 pontos de disparo existentes.
- Scope: `src/server/notifications/push.ts` — busca tokens do uid, `admin.messaging().sendEachForMulticast()` (chunk ≤500), poda tokens com `registration-token-not-registered`; gate via `shouldDeliver` (reusa preferências); função `deliverNotifications` (write in-app + push) ou camada push chamada após write. Best-effort: nunca lança.
- **Contrato de payload (pino cross-plan):** define o shape FCM compartilhado — `notification` (title, body, icon) + `data` (`url`/rota, `type`). TASK-02 SW consome exatamente este shape. Sem isso producer/consumer divergem.
- **5 call sites a integrar (enumerados):** `api/predictions/score/route.ts`, `api/rankings/recalc/route.ts`, `api/group/rankings/recalc/route.ts`, `api/group/users/_moderation.ts` (helper, não rota), `api/group/users/promote/route.ts`. (PRD diz "4 pontos"; `_moderation` é helper compartilhado → 5 sites físicos.)
- **Observabilidade:** log de counts (enviados/podados/falhos) — sem isso, pipeline quebrado = idêntico a funcionando (best-effort silencioso).
- Main modules/files likely involved: `src/server/notifications/push.ts`, `src/server/notifications/tokens.ts`, `src/server/notifications/index.ts`, os 5 call sites acima, `src/server/firebaseAdmin.ts` (getMessaging).
- Dependencies: TASK-03 (token store), TASK-02 (tokens sendo produzidos — funcional, não bloqueante p/ implementar).
- Story points: 5
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: Núcleo da feature. Best-effort obrigatório (espelha `notifyScoreHitsBestEffort`). Fan-out por token. Poda crítica (custo/lixo). Sem `admin-messaging` dep nova (firebase-admin já tem). TDD: gate + poda + fan-out + best-effort.

### TASK-07 – Idempotência de push sob cron
- Type: domain
- Goal: garantir 1 push por evento mesmo com re-run do cron (in-app já é idempotente por ID determinístico; push não).
- Scope: ajustar `writeNotifications` para reportar quais docs foram **criados de fato** vs sobrescritos (ex.: `create` com catch de já-existe, ou pré-check de existência em batch); `push.ts` só envia para os recém-criados. Guard **escopado a notificações de ID determinístico** (games/ranking — o caminho do cron); auto-id (moderação/promoção, fora do cron) sempre pusha — não suprimir repeat legítimo. Cobre o maior risco funcional (spam de push no cron ~30min).
- Main modules/files likely involved: `src/server/notifications/write.ts`, `src/server/notifications/push.ts`, testes em `__tests__/`.
- **Done (regressão in-app):** mudar `set`→`create` NÃO pode quebrar PRD-15 — re-run continua idempotente in-app, sem exceção borbulhando, sem update legítimo perdido. Teste explícito assertando entrega in-app intacta sob re-run.
- Dependencies: TASK-04 (envio existente).
- Story points: 3
- Criticality: critical
- Technical risk: high
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: opus/high
  - implement: opus/high
  - test: sonnet/high
  - review: opus/high
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: Regra de negócio pura → TDD forte. **GSD HG-01 RESOLVIDO por decisão de produto: ranking só notifica top 3 (pódio).** `notifyRankingUps` filtra `newPosition <= 3` → subidas fora do pódio não escrevem doc nem consomem o slot diário, então não mascaram um salto-para-o-pódio no mesmo dia. Design: pré-check de existência em batch (`getAll`) — `set` só dos refs inexistentes (escolhido sobre `create`-nativo p/ preservar batch + best-effort). GSD MD-03 (predicado de id inconsistente p/ `""`) corrigido via `isDeterministic`. Testar: re-run não re-pusha; auto-id (moderação/promoção) sempre pusha; determinístico (games/ranking) pusha 1x; ranking fora do top 3 não notifica.

### TASK-05 – Preferência push + foreground dedup
- Type: application
- Goal: dar ao usuário controle de push (master switch + reuso dos toggles por-tipo) e evitar push duplicada com app aberto.
- Scope: estender `notificationPreferences` schema com `pushEnabled` (migração tolerante, default off até opt-in); UI na tela `notifications/preferences`; gate server-side em `push.ts` (push respeita `pushEnabled` + toggle por-tipo; decisão: `system` respeita master switch de push, diferente do in-app); foreground handler `onMessage` suprime push do SO quando app aberto (já há sino+toast).
- Main modules/files likely involved: `src/schemas/notificationPreferences.ts`, `src/features/notifications/components/PreferencesForm.tsx`, `src/server/notifications/preferences.ts` (`shouldDeliver` push-aware), `src/features/push/hooks` (onMessage foreground), `src/server/notifications/push.ts`.
- Dependencies: TASK-02 (client onMessage), TASK-04 (gate server).
- Story points: 3
- Criticality: medium
- Technical risk: medium
- Recommended TDD later: yes
- Execution cost:
  - spec: sonnet/high
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: opus/high
- Status: done
- Phases done: spec, ui-spec, patterns:nextjs, tdd, implement, test, review, ui-review
- Notes: is_frontend: true. Resolve ambiguidades §6.1/§6.3 do PRD (master switch + system respeita push opt-out). TDD no gate `shouldDeliverPush`. Migração de schema tolerante (default).

### TASK-06 – UX de instalação (Android prompt + iOS tutorial)
- Type: application
- Goal: levar o usuário a instalar o PWA — prompt nativo no Android, tutorial visual no iOS (sem prompt automático).
- Scope: componente que detecta plataforma; Android usa `beforeinstallprompt` (botão "Instalar app"); iOS mostra passo-a-passo ("Compartilhar → Adicionar à Tela de Início"); CTA de ativar notificações pós-instalação; dispensa/persistência de "não mostrar de novo". **iOS: não encadear opt-in de push até o app estar instalado (standalone)** — senão queima permissão (alinha com gate iOS de TASK-02).
- Main modules/files likely involved: `src/features/push/components/InstallPrompt.tsx`, `src/features/push/components/IosInstallGuide.tsx`, `src/features/push/hooks/useInstallPrompt.ts`, ponto de montagem (home ou banner global).
- Dependencies: TASK-01 (instalável), TASK-02 (opt-in de push encadeado).
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
- Status: done
- Phases done: spec, ui-spec, patterns:nextjs, implement, test, review, ui-review
- Notes: is_frontend: true. Risco de produto (iOS), não técnico. `/ui-spec` + `/patterns:nextjs` + ui-ux-pro-max. Sem prompt automático no iOS → instrução visual é o diferencial de adoção.

## 4. Dependency map

```
TASK-01 (PWA base) ─┬─> TASK-02 (client FCM) ─┬─> TASK-04 (envio) ──> TASK-07 (idempotência)
                    │                          │        │
                    │                          │        └─> TASK-05 (prefs + dedup)
                    │                          └────────────^
                    └─> TASK-06 (UX instalação) <─ TASK-02
TASK-03 (token store) ───────────────────────────> TASK-04
```
- TASK-01, TASK-03: sem deps (fundação, paralelas).
- TASK-02: depende de 01.
- TASK-04: depende de 03 (store) + 02 (funcional).
- TASK-07: depende de 04.
- TASK-05: depende de 02 + 04.
- TASK-06: depende de 01 + 02.

## 5. Recommended execution order

1. **TASK-01** – PWA instalável (fundação, sem deps)
2. **TASK-03** – Token store (fundação, sem deps; paralela a 01)
3. **TASK-02** – Client FCM (precisa SW de 01)
4. **TASK-04** – Envio server-side (precisa store de 03)
5. **TASK-07** – Idempotência cron (precisa envio de 04)
6. **TASK-05** – Preferência push + foreground dedup (precisa 02+04)
7. **TASK-06** – UX instalação (precisa 01+02)

## 6. Planning risks and blockers

- **TASK-04 + TASK-07 (núcleo de risco):** envio best-effort + poda + idempotência sob cron. Maior risco funcional do PRD (spam de push). TDD obrigatório nas duas.
- **TASK-02 (integration alta):** APIs de browser difíceis de testar; permissão queimável; depende de VAPID key gerada no console Firebase (pré-requisito externo — habilitar Cloud Messaging API + gerar par VAPID **antes** de TASK-02).
- **iOS (TASK-06):** risco de produto, não técnico — adoção depende de o usuário instalar manualmente. UX é o mitigador.
- **Decisões de ambiguidade do PRD** resolvidas no plano: token store via Route Handler (TASK-03), master switch push + system respeita opt-out (TASK-05), idempotência via `create`-falha-em-duplicata (TASK-07), envio via `deliverNotifications`/camada nos 4 sites (TASK-04). Confirmar no checkpoint.
- **Pré-requisito de infra (HARD-STOP, bloqueia TASK-02):** habilitar Cloud Messaging API e gerar VAPID key no projeto `world-cup-betting-pool-8e93c`. Ação manual do usuário no console Firebase. Não iniciar TASK-02 sem `NEXT_PUBLIC_FIREBASE_VAPID_KEY` presente.
- **gsd-plan-checker (CONCERNS → folded):** gaps integrados sem re-decompor — `notificationclick`+gate iOS+token cleanup+payload contract (TASK-02/04), headers App Hosting (TASK-01), regressão in-app + guard escopado a ID determinístico (TASK-07), observabilidade + 5 call sites (TASK-04).
