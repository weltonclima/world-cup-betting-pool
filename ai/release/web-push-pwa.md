# RELEASE PLAN — Web Push + PWA

> Fonte: `ai/prd/web-push-pwa.md` + `ai/plan/web-push-pwa.md`. Todas 7 tasks `done`. Commit topo: `a804f65 feat(push): PWA instalável + Web Push via FCM`. Branch `fix/home-screen-data-bugs` = 57 commits à frente de `main`, 0 atrás.

## 1. Release summary

Adiciona camada de **entrega push no dispositivo** (app fechado/background) ao web app Next.js, sobre o PRD-15 (notificações in-app). Dois blocos:

- **PWA instalável** — `manifest.webmanifest`, ícones (192/512/maskable/apple-touch), meta tags iOS, service worker base (`sw.js`) + registro. App passa no critério "instalável" do Chrome e é adicionável à tela inicial no iOS.
- **Web Push via FCM** — client de permissão/token (`usePushRegistration`), token store (`fcm_tokens/{token}` + Route Handler `api/push/tokens`), envio server-side best-effort (`push.ts` via `sendEachForMulticast`, poda de tokens mortos), integração nos 5 call sites de disparo, idempotência sob cron, preferência push (master switch + reuso dos toggles por-tipo), UX de instalação Android/iOS.

**Aditivo e best-effort:** caminho in-app do PRD-15 inalterado. Usuário sem token / sem VAPID key = só in-app, degrada gracioso. Feature-flag implícita = presença de `NEXT_PUBLIC_FIREBASE_VAPID_KEY` + opt-in por-usuário (default off).

**Sistema afetado:** `src/server/notifications/` (push.ts, write.ts, tokens.ts), `src/features/push/`, `src/firebase/` (messaging), `public/` (manifest/SW/ícones), `next.config.ts` (headers PWA), `firestore.rules` (coleção fcm_tokens), `notificationPreferences` schema (+pushEnabled), 5 rotas de disparo.

**Runtime:** Next.js 15 SSR em Firebase App Hosting (Cloud Run). Sem dep nova server-side (firebase-admin já tem `messaging()`).

## 2. Deployment prerequisites

**HARD-STOP (sem isto, push não funciona):**
1. **`NEXT_PUBLIC_FIREBASE_VAPID_KEY`** — atualmente **vazia** em `.env.production.example`. Gerar par VAPID Web Push no console Firebase (projeto `world-cup-betting-pool-8e93c`) e setar a chave pública no env de produção do App Hosting (`apphosting.yaml` env / secret). Ausente → opt-in de push fica oculto (build não quebra, mas feature inerte).
2. **Cloud Messaging API habilitada** no projeto Firebase. Ação manual no console.

**Deploy de regras/config:**
3. **Firestore Rules** — `firestore.rules` ganhou bloco `fcm_tokens/{token}` (write `if false` / leitura owner). Deploy das rules **junto** com o código (`firebase deploy --only firestore:rules`). Sem isso, Route Handler escreve via Admin SDK (ok), mas leitura owner-scoped do client falha.
4. **Headers PWA** — em `next.config.ts` (não `apphosting.yaml`): `sw.js` e `firebase-messaging-sw.js` no-cache + content-type JS; `manifest.webmanifest` content-type + must-revalidate. Servidos pelo runtime SSR — confirmar pós-deploy via `curl`.

**Sem migração de índice:** nenhum índice composto novo necessário para `fcm_tokens` (acesso por doc-id = token, e query por `userId` é igualdade simples).

## 3. Data and migration considerations

- **Nova coleção `fcm_tokens/{token}`** — criada sob demanda no primeiro opt-in. Sem backfill.
- **`notificationPreferences` +`pushEnabled`** — migração **tolerante**: campo ausente = push off (default seguro até opt-in explícito). Docs existentes do PRD-15 continuam válidos sem rewrite.
- **`write.ts` mudou `set`→pré-check de existência em batch (`getAll`)** para idempotência de push — risco de regressão in-app coberto por teste (`write.test.ts`): re-run continua idempotente in-app, sem exceção, sem update legítimo perdido.
- **Ordenação:** deploy de rules e código pode ser simultâneo (rules são backward-compatible — só adicionam coleção nova). VAPID key pode ser setada antes ou depois do deploy de código (ausência só oculta o opt-in).
- **Sem destruição de dados.** Tudo aditivo.

## 4. Rollout strategy

**Recomendado: monitoring-first, direto (sem feature flag explícita).**

A feature já é auto-gated:
1. Deploy do código + rules.
2. **Validação de assets** (curl): SW scope aceito, manifest servido com content-type certo, SW não-cacheado.
3. **Setar VAPID key** em produção → ativa o opt-in.
4. **Canary manual:** opt-in no próprio device (1 Android instalado + 1 iOS instalado standalone), disparar evento real (scoring cron ou ação de moderação), confirmar push recebida 1x.
5. **Observar 1 ciclo de cron (~30min)** antes de anunciar — é o maior risco funcional (spam de push por re-run). Logs `[notifications/push] enviados/falhas/podados` confirmam comportamento.
6. Abrir opt-in ao restante dos usuários (já default off por-usuário — adoção é orgânica via UX de instalação).

Sem necessidade de phased rollout server-side: cada usuário opta individualmente e o default é off.

## 5. Monitoring and validation

**Logs server-side** (Cloud Run / App Hosting) — `push.ts` emite por uid:
- `[notifications/push] enviados=N falhas=N podados=N (tokens=N)` — saúde do fan-out.
- `[notifications/push] falha no envio ao uid=...` / `falha no envio best-effort` — erros isolados (não derrubam negócio).

**Watch list pós-deploy:**
- **Idempotência cron:** após 2+ ciclos de scoring, `enviados` não deve repetir push do mesmo evento (in-app já idempotente; push só p/ recém-criados de ID determinístico).
- **Poda:** `podados > 0` esperado ao longo do tempo (tokens mortos). `podados` crescendo sem `enviados` = problema de registro.
- **Assets PWA:** `curl -I` em `/sw.js`, `/firebase-messaging-sw.js`, `/manifest.webmanifest` — headers corretos (no-cache nos SW, content-type no manifest).
- **Opt-in funcional:** browser sem suporte → opt-in oculto, sem erro lançado no console client.

**Blind spots:**
- Entrega real ao dispositivo não é observável server-side (FCM aceita ≠ usuário viu). Confiar em canary manual.
- iOS: sucesso depende de instalação manual standalone — não há sinal server-side de "não instalado".

## 6. Risks

**Técnicos:**
- **SW caching → app velho gruda** (regressão clássica PWA). Mitigado: SW mínimo (sem cache de navegação) + headers no-cache nos dois SW (`next.config.ts`). Validar headers pós-deploy.
- **Spam de push no cron** (maior risco funcional). Mitigado: idempotência via pré-check batch + guard escopado a ID determinístico (TASK-07, TDD). Validar 1 ciclo antes de anunciar.
- **Tokens mortos / multi-device** — poda via retorno `registration-token-not-registered`. Sem poda = lixo/custo.
- **`write.ts set→getAll`** — regressão potencial no in-app PRD-15. Coberto por teste explícito; confirmar verde no gate.

**Operacionais:**
- **VAPID key vazia em produção** = feature inerte silenciosa (build passa, push não aparece). Checklist hard-stop.
- **Rules não deployadas** = leitura owner-scoped falha. Deploy rules junto com código.

**Produto:**
- **iOS frágil por design** — push só com PWA instalado standalone, ≥16.4, instalação manual. Expectativa "não recebo no iPhone" será comum. Mitigado por UX de instrução (TASK-06).
- **Permissão queimável** — pedida só em momento intencional (não no load) e gated a standalone no iOS.

**Compatibilidade:** browsers sem FCM → opt-in oculto via `isSupported()`. Sem regressão.

## 7. Rollback considerations

- **Rollback suave (desligar push, manter in-app):** remover/esvaziar `NEXT_PUBLIC_FIREBASE_VAPID_KEY` em produção → opt-in oculto, nenhum push novo, in-app PRD-15 intacto. Não requer redeploy de código se env for hot-swappable; senão redeploy com env vazia.
- **Rollback de código:** reverter para o commit anterior a `a804f65`. Caminho in-app é independente (best-effort em try/catch) — reverter push não afeta scoring/recalc/moderação.
- **SW já registrado nos devices:** após rollback, o `sw.js`/`firebase-messaging-sw.js` com no-cache expira rápido; sem rollback do SW, devices podem manter SW órfão (inofensivo — sem VAPID/token não recebe push). Para limpar, publicar SW vazio que faz `self.registration.unregister()`.
- **Rules:** a coleção `fcm_tokens` é aditiva; reverter rules é opcional (regra extra não afeta o resto). Tokens persistidos ficam órfãos sem custo relevante.
- **Sem migração destrutiva** → nenhum rollback de dados necessário.

## 8. Release checklist

**Pré-deploy (hard-stop):**
- [ ] Cloud Messaging API habilitada no projeto `world-cup-betting-pool-8e93c`.
- [ ] Par VAPID Web Push gerado no console Firebase; chave pública pronta.
- [ ] `NEXT_PUBLIC_FIREBASE_VAPID_KEY` setada no env de produção do App Hosting.
- [ ] Gate verde: `lint` + `test` + `build` (`/gate` ou `rtk vitest run` + `rtk next build`).
- [ ] Teste de regressão in-app (PRD-15) verde sob re-run (`write.test.ts`).

**Deploy:**
- [ ] Deploy de código (App Hosting).
- [ ] Deploy de rules: `firebase deploy --only firestore:rules` (bloco `fcm_tokens`).

**Pós-deploy (validação):**
- [ ] `curl -I` `/sw.js` → `Service-Worker-Allowed: /` + no-cache + content-type JS.
- [ ] `curl -I` `/firebase-messaging-sw.js` → no-cache + content-type JS.
- [ ] `curl -I` `/manifest.webmanifest` → `application/manifest+json`.
- [ ] App passa em "instalável" no Chrome (DevTools → Application → Manifest).
- [ ] Canary: opt-in em 1 Android (PWA instalado) → push recebida 1x ao disparar evento real.
- [ ] Canary: opt-in em 1 iOS standalone (≥16.4, adicionado à tela inicial) → push recebida.
- [ ] App aberto: `onMessage` suprime push do SO (sino+toast só) — sem duplicata.
- [ ] Logout / revogação → token removido (DELETE `api/push/tokens`), sem push cruzada.

**Monitoramento (1ª 24h):**
- [ ] Observar ≥2 ciclos de cron (~30min): sem re-push do mesmo evento (idempotência).
- [ ] Logs `[notifications/push] enviados/falhas/podados` coerentes; `podados` aparece com o tempo.
- [ ] Sem erro lançado no client em browser sem suporte (opt-in oculto).
