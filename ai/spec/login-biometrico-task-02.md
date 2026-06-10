# SPEC

## 1. Task id and title
- Task: TASK-02
- Title: Renovação deslizante do session cookie `__session`

## 2. Objetivo
Eliminar o mismatch client↔server da sessão: o estado do Firebase Auth no client persiste indefinidamente (TASK-01), mas o cookie `__session` (servidor/edge) expira fixo em 5 dias sem renovação. Implementar **renovação deslizante**: enquanto a sessão Firebase do client estiver viva e em uso, re-emitir periodicamente o cookie a partir de um ID token **fresco e válido**, de modo que rotas protegidas por servidor não derrubem o usuário antes do client. A renovação NÃO pode estender a sessão sem revalidar o token (sem sessão "imortal").

## 3. In scope
- Função de serviço **`refreshSessionCookie()`** que re-emite o cookie: obtém `getIdToken(true)` do `currentUser` e faz `POST /api/auth/session` (reusa o endpoint e o fluxo de mint já existentes). Best-effort (falha logada, não propaga).
- Refatorar `services/auth.ts` para extrair/expor o mint do cookie (hoje na função privada `createSessionCookie`) e reusá-lo tanto no `signIn` quanto na renovação — sem duplicar lógica.
- **Gatilho de renovação** via hook headless `useSessionRenewal()`:
  - dispara uma tentativa no mount (app load) e em cada `onIdTokenChanged` enquanto autenticado;
  - **throttle**: só re-emite de fato se passou mais que `SESSION_RENEWAL_THROTTLE_MS` desde a última emissão bem-sucedida, registrada em `localStorage` (`bdp.lastSessionMintAt`). Cookie é httpOnly → client não lê a expiração; o timestamp local é a referência.
- Montar o hook uma vez na árvore de providers (`src/providers`), dentro do boundary client.
- Constante de configuração para o throttle (ex.: 1 dia) e documentação do racional (TTL do cookie = 5d; renovar bem antes mantém a sessão server viva entre visitas).
- Limpar o timestamp local no logout (evita tentativa de renovação órfã).

## 4. Out of scope
- Mudar a validade do cookie (continua 5 dias) ou os atributos do cookie (`route.ts` `cookieOptions`).
- Qualquer alteração no `middleware.ts` (edge não tem Admin SDK; renovação é client→Node route).
- WebAuthn/biometria, custom token, claim `role` no token (TASK-05/07/08).
- Renovação server-side automática (ex.: re-mint dentro do middleware) — fora de escopo; a renovação é disparada pelo client.
- Persistência client (TASK-01, já entregue).

## 5. Áreas técnicas envolvidas
- `src/services/auth.ts` — extrair mint reutilizável; adicionar `refreshSessionCookie()`; limpar timestamp no `signOut`.
- `src/hooks/useSessionRenewal.ts` (novo) — efeito + `onIdTokenChanged` + throttle via localStorage.
- `src/providers/*` — montar o hook uma vez (ex.: componente headless dentro de `AuthProvider`/`Providers`).
- `src/app/api/auth/session/route.ts` — **sem mudança** (reusado como está; `POST` já faz `verifyIdToken` → `createSessionCookie`).

## 6. Regras e comportamento
- **Anti-imortal (segurança):** a renovação SÓ ocorre com um ID token fresco. `getIdToken(true)` força refresh; se a sessão Firebase foi revogada/expirada, a chamada falha → nenhuma renovação → o cookie expira naturalmente em 5d. O `POST /api/auth/session` revalida o token (`verifyIdToken`) antes de emitir; token inválido → 401 → sem cookie novo. Nunca estender o cookie "às cegas".
- **Throttle:** no máximo uma emissão por janela `SESSION_RENEWAL_THROTTLE_MS`. `onIdTokenChanged` (~1×/h enquanto aberto) e o mount podem disparar muitas vezes; só a primeira após a janela efetivamente re-emite. Reduz POSTs sem deixar o cookie envelhecer perto dos 5d.
- **No-op seguro:** sem `currentUser`, sem `window`/`localStorage`, ou dentro da janela de throttle → não faz POST.
- **Best-effort:** falha de rede/servidor na renovação é logada e ignorada (não derruba app nem desloga; o cookie segue válido até a expiração natural).
- **Idempotência/concorrência:** evitar renovações concorrentes sobrepostas (guard simples de "em andamento") — uma emissão por vez.
- **Logout:** `signOut` limpa o timestamp local além de limpar o cookie (DELETE já existente).
- O timestamp só é atualizado em emissão **bem-sucedida** (`response.ok`); falha não avança a janela (permite retry na próxima oportunidade).

## 7. Contratos e interfaces
- `services/auth.ts`:
  - `refreshSessionCookie(): Promise<void>` — re-emite o cookie a partir do token fresco; best-effort; respeita throttle (ou throttle fica no hook — ver nota). No-op se deslogado.
  - mint reutilizável interno (ex.: `mintSessionCookie()`), usado por `signIn` e `refreshSessionCookie`.
  - chave de throttle e constante exportadas para teste (ex.: `SESSION_RENEWAL_THROTTLE_MS`, `LAST_MINT_STORAGE_KEY`).
- `hooks/useSessionRenewal.ts`:
  - `useSessionRenewal(): void` — efeito que assina `onIdTokenChanged(firebaseAuth, …)` e chama a renovação com throttle; cleanup remove a subscription.
- Endpoint: reusa `POST /api/auth/session` `{ idToken } → 200 { status: "success" }` (sem mudança de contrato).
- `firebase/auth`: `onIdTokenChanged(auth, cb)` (API modular firebase 12, mesma lib já confirmada na TASK-01).

## 8. Impacto de dados e persistência
- Nenhuma mudança em Firestore/schema/índices.
- Novo uso de `localStorage` (`bdp.lastSessionMintAt`) — timestamp não sensível (epoch ms da última emissão). Não guardar token nem dado de sessão ali.

## 9. Testes obrigatórios (TDD — escrever antes)
- **`refreshSessionCookie`:**
  - deslogado (`currentUser` null) → no-op, sem `getIdToken`/fetch.
  - logado → `getIdToken(true)` + `POST /api/auth/session` com o token; em `response.ok`, timestamp atualizado.
  - **anti-imortal:** `getIdToken` rejeitando (token revogado) → não faz POST, não avança timestamp, não lança.
  - best-effort: `POST` não-ok ou fetch rejeitando → logado, não lança, timestamp NÃO avança.
- **Throttle:**
  - dentro da janela (timestamp recente) → no-op (sem POST).
  - fora da janela (timestamp antigo/ausente) → re-emite.
  - timestamp só avança em sucesso.
- **`useSessionRenewal`:**
  - assina `onIdTokenChanged` no mount e desassina no unmount.
  - dispara renovação (throttled) em evento de token.
- **`signOut`:** limpa `bdp.lastSessionMintAt`.
- **Concorrência:** chamadas sobrepostas não disparam POSTs paralelos (uma emissão por vez).
- Vitest. Mock de `firebase/auth` (`onIdTokenChanged`, `currentUser.getIdToken`), `fetch`, e `localStorage`. Verificar resultado via JSON real (resumo rtk mente em load-failure).

## 10. Critérios de aceite
- Enquanto autenticado e usando o app, o cookie `__session` é re-emitido antes de envelhecer perto dos 5 dias (renovação deslizante comprovada por teste de throttle + re-mint).
- Renovação exige token fresco válido; sessão revogada NÃO renova (anti-imortal coberto por teste).
- Falhas de renovação são best-effort (não quebram app, não deslogam).
- `middleware.ts`, atributos e TTL do cookie inalterados.
- `signOut` limpa o estado de throttle local.
- `typecheck` (sem `any`), `lint` e testes passam.

## 11. Constraints
- TypeScript strict, sem `any`.
- Não importar `firebase-admin` no client.
- Reusar o `POST /api/auth/session` existente — não criar endpoint novo (decisão N2).
- Não alterar `middleware.ts` nem a forma/atributos do cookie.
- Comentários/domínio em pt-BR. Sem estilos inline (N/A, sem UI).
- Best-effort: disponibilidade do app acima da garantia de renovação.
- Não logar tokens nem conteúdo de sessão.

## 12. Execution cost profile
- tdd: sonnet/high
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/medium

## 13. Frontend indicator
- is_frontend: false
- reason: Hook headless de renovação de sessão + camada de serviço + reuso de Route Handler. Sem telas, componentes visuais, layout ou interação de usuário. (O hook é montado na árvore de providers, mas não renderiza UI.)

## 14. Open questions
- Valor exato do throttle: proposto **1 dia** (`SESSION_RENEWAL_THROTTLE_MS = 24h`). Com cookie de 5d, garante folga ampla; ajustável sem mudança estrutural. Confirmar se há preferência (ex.: 12h) — não bloqueia implementação.
