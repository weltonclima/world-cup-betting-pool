# SPEC — TASK-09: Session cookie httpOnly (`/api/auth/session`)

> Plan: `ai/plan/integracao-api-football.md` (TASK-09) · Type: api · Criticality: high · Risco R3 / Ambiguidade A3
> Objetivo: sessão verificável no servidor/edge sem expor o ID token ao browser. É a entrada do middleware `/admin/*` (TASK-10) e usa o custom claim `role` (TASK-08).
> Depende de: TASK-08 (custom claim `role` no token).

## 1. Fluxo atual mapeado (antes da TASK-09)

| Local | Comportamento | Observação |
|---|---|---|
| `src/services/auth.ts` (`signIn`/`signOut`) | sign-in/sign-out apenas via Firebase Auth client (`signInWithEmailAndPassword` / `firebaseSignOut`). | NÃO havia nada server-side; sessão só existia no IndexedDB do SDK client. |
| `src/providers/AuthProvider.tsx` | deriva `role`/`status` do **doc Firestore** (`getDoc users/{uid}`), não do token. | Inalterado nesta task. O cookie é para consumo server/edge, não para o client. |
| `src/components/layout/PendingApprovalScreen.tsx` e `BlockedScreen.tsx` | chamavam `firebaseAuth.signOut()` **direto**, sem passar pela camada de serviço. | Repontados para `signOut()` do serviço → o session cookie agora é limpo nesses logouts também. |
| `src/firebase/admin.ts` | já existia Admin SDK server-only (`adminAuth`), usado por código de servidor. | Reaproveitei o **mesmo padrão de credencial** no novo `src/server/firebaseAdmin.ts` (exigido pelo enunciado da task). |
| Route Handlers `/api/*` | **nenhum existia** ainda (TASK-04 ainda não implementada). | `/api/auth/session` é o primeiro Route Handler do projeto. |

## 2. Arquivos

Criados:
- `src/server/firebaseAdmin.ts` — init do Admin SDK para o servidor Next (singleton, server-only). Exporta `getAdminApp()` e `getAdminAuth()`.
- `src/app/api/auth/session/route.ts` — Route Handler `POST` (cria session cookie) + `DELETE` (logout). Exporta `SESSION_COOKIE_NAME`.
- `src/app/api/auth/session/__tests__/route.test.ts` — testes do handler com `@/server/firebaseAdmin` mockado.

Alterados:
- `src/services/auth.ts` — `signIn` chama `POST /api/auth/session` pós-login; `signOut` chama `DELETE` pré-logout. Helpers internos `createSessionCookie`/`clearSessionCookie` (best-effort).
- `src/components/layout/PendingApprovalScreen.tsx` e `src/components/layout/BlockedScreen.tsx` — trocam `firebaseAuth.signOut()` por `signOut()` do serviço (para também limpar o cookie).
- `src/services/__tests__/auth.test.ts` — mock de `@/firebase` ganhou `currentUser` (getter) + `fetch` global stub; novos casos para criação/limpeza do cookie.
- `src/components/layout/__tests__/PendingApprovalScreen.test.tsx` — mock trocado de `@/firebase` para `@/services/auth` (`signOut`).

NÃO tocados (fora do escopo / outras tasks): `functions/**`, `src/server/{apiFootball,cache,mappers}/**`, `next.config`, `firebase.json`, `middleware` (TASK-10).

## 3. Variáveis de ambiente necessárias (nomes, sem valores)

Server-side (NUNCA `NEXT_PUBLIC_*`):

| Var | Quando | Papel |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | dev/manual com projeto real | JSON do service account em uma linha. Admin SDK usa `cert(...)`. Já presente em `.env.local`. |
| `GOOGLE_APPLICATION_CREDENTIALS` **ou** ADC do runtime | Firebase App Hosting / Cloud Run (TASK-07b) | Caminho do JSON OU credencial injetada pelos metadados do runtime → `applicationDefault()`. **Não precisa setar `FIREBASE_SERVICE_ACCOUNT_KEY` em App Hosting.** |
| `NEXT_PUBLIC_FIREBASE_USE_EMULATORS` | dev local com emulador | `"true"` → Admin SDK dispensa credencial e fala com `FIREBASE_AUTH_EMULATOR_HOST`. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | sempre | usado como `projectId` no modo ADC/emulador. Já existe (client SDK). |

Ordem de resolução de credencial em `src/server/firebaseAdmin.ts`:
1. emulador (`NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true`) → sem credencial;
2. `FIREBASE_SERVICE_ACCOUNT_KEY` presente → `cert(JSON)`;
3. fallback → `applicationDefault()` (App Hosting / `GOOGLE_APPLICATION_CREDENTIALS`).

## 4. Shape do cookie

- Nome: `__session` (constante `SESSION_COOKIE_NAME`). **Fixo**: é o único cookie repassado pelo CDN do Firebase Hosting/App Hosting ao backend.
- Valor: session cookie do Firebase (`createSessionCookie`), NÃO o ID token.
- Atributos: `httpOnly: true` (JS do browser não lê), `secure: true` em produção (`NODE_ENV === "production"`; desligado em dev HTTP), `sameSite: "lax"`, `path: "/"`.
- `maxAge`: 5 dias (`5*24*60*60` s). O Admin SDK recebe `expiresIn` em **ms** (`5 dias`); o cookie em **s**.
- Logout (`DELETE`): mesmo nome, `value: ""`, `maxAge: 0` (expira imediatamente).

## 5. Fluxo login/logout

**Login** (`signIn`):
1. `signInWithEmailAndPassword` (Firebase Auth client).
2. `createSessionCookie()`: `firebaseAuth.currentUser.getIdToken(true)` — `true` **força refresh** para carregar o custom claim `role` fresco (TASK-08; token em cache pode ter claim antigo por ~1h).
3. `POST /api/auth/session { idToken }`.
4. Handler: `getAdminAuth().verifyIdToken(idToken)` → `createSessionCookie(idToken,{expiresIn})` → seta `__session` → 200.

**Logout** (`signOut`):
1. `clearSessionCookie()`: `DELETE /api/auth/session` → handler expira o cookie (200, idempotente).
2. `firebaseSignOut` (Firebase Auth client).

**Best-effort:** falha de rede/servidor em `createSessionCookie`/`clearSessionCookie` é logada (`console.error`) e NÃO derruba o login/logout client. Sem cookie, apenas rotas protegidas por servidor (TASK-10) ficam inacessíveis; o estado client do AuthProvider (baseado no doc Firestore) segue funcionando.

## 6. Segurança

- `__session` é `httpOnly` → imune a roubo via XSS por leitura de `document.cookie`.
- `secure` em produção → só trafega em HTTPS.
- `sameSite=lax` → mitiga CSRF em navegação cross-site (POST cross-site não envia o cookie).
- Admin SDK (`firebase-admin`) só em `src/server/firebaseAdmin.ts` com `import "server-only"` → erro de build se vazar para o bundle client. Chave privada nunca chega ao browser.
- Handler com `runtime = "nodejs"` (firebase-admin não roda no edge) e `dynamic = "force-dynamic"` (respostas de auth nunca cacheadas).
- Mensagens de erro genéricas (`"Não autorizado."`) — não vazam detalhe do motivo.

## 7. Decisões

- **Reaproveitar padrão de credencial** do `src/firebase/admin.ts` existente, mas em `src/server/firebaseAdmin.ts` (exigido pelo enunciado) e acrescentando o caminho `applicationDefault()` para App Hosting (o `admin.ts` legado não tinha ADC).
- **API lazy via funções** (`getAdminAuth()`) em vez de export de instância: evita inicializar o Admin SDK no import (relevante para mockar nos testes sem disparar `server-only`/credencial).
- **Integração mínima**: estendi `signIn`/`signOut` no serviço (ponto único) em vez de espalhar `fetch` pelos componentes. Os dois screens que faziam `firebaseAuth.signOut()` direto foram repontados ao serviço.
- **`signUp` NÃO cria session cookie**: o cadastro nasce `status:pending` e cai na tela de Aguardando Aprovação (sem acesso interno); criar cookie ali não traz valor e aumentaria o churn. O cookie é criado no `signIn` subsequente (pós-aprovação). Documentado como decisão consciente.
- **5 dias** de validade: equilíbrio entre conveniência (<100 usuários) e janela de exposição; alinhado ao exemplo do enunciado.

## 8. O que NÃO dá para validar sem credenciais reais / runtime

- `verifyIdToken` e `createSessionCookie` **reais** exigem service account válido (ou Auth emulator) — os testes mockam `@/server/firebaseAdmin`. Não foi feita chamada real ao Admin SDK.
- O comportamento de `applicationDefault()` no App Hosting só é verificável no deploy (TASK-07b).
- A entrega ponta-a-ponta do cookie `__session` pelo CDN do App Hosting ao backend só se valida em produção.
- O consumo do cookie pelo middleware é da TASK-10 (não implementada aqui).
- `next build`/`next start` não foi exercido (enunciado dispensa; static export já removido; deploy é TASK-07b).

## 9. Casos de teste (todos verdes)

Route Handler (`route.test.ts`, `@/server/firebaseAdmin` mockado):
- POST sucesso: `verifyIdToken` + `createSessionCookie({expiresIn:5d ms})` chamados; cookie `__session` httpOnly, sameSite=lax, path=/, maxAge=5d s; 200.
- POST token inválido: `verifyIdToken` rejeita → 401, sem cookie, `createSessionCookie` não chamado.
- POST falha ao criar cookie: `createSessionCookie` rejeita → 401, sem cookie.
- POST body sem `idToken` → 400 (Zod), nenhuma chamada ao Admin SDK.
- DELETE → 200, cookie `__session` com value vazio e maxAge 0 (httpOnly).

Serviço (`auth.test.ts`, `fetch` e `currentUser` mockados):
- signIn cria session cookie: `getIdToken(true)` + `POST /api/auth/session` com `{idToken}`.
- signOut limpa cookie: `DELETE /api/auth/session` antes do `firebaseSignOut`.
- demais casos pré-existentes (signUp/rollback/reset) seguem verdes.

## 10. Resultado de verificação

- `npx vitest run` (suíte completa): **683 passed / 0 failed**, 0 suítes com falha. Recorte da task (api/server/auth/pending): **117 passed / 0 failed**, incluindo os 5 do route handler.
- `npx tsc --noEmit`: **sem erros**.
- `.vt9.json` lido via JSON (não via resumo rtk) e removido após conferência.

## 11. Riscos / dependências

1. **App Hosting credencial (TASK-07b)**: o caminho `applicationDefault()` só é exercitado no deploy real. Se o runtime não injetar ADC, o handler lança no primeiro POST.
2. **Refresh do claim (TASK-08)**: `getIdToken(true)` garante claim fresco no cookie no momento do login. Mudança de role de quem JÁ está logado só reflete no próximo `signIn`/refresh (não há re-emissão automática do cookie nesta task).
3. **Middleware (TASK-10)** depende deste cookie; a verificação no edge usará `jose` (firebase-admin não roda no edge). Fora do escopo aqui.
4. **`signUp` sem cookie** (decisão §7): se algum fluxo futuro precisar de sessão server-side logo após o cadastro, terá de criar o cookie explicitamente.
5. **CSRF residual**: `sameSite=lax` cobre o caso comum; como o POST exige um `idToken` válido obtido do SDK client (não anexado automaticamente), o risco é baixo. Sem token CSRF dedicado (não exigido para o público <100).
