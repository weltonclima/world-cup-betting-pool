# SPEC

## 1. Task id and title
- Task: TASK-01
- Title: Persistência client explícita do Firebase Auth

## 2. Objetivo
Tornar a persistência da sessão do Firebase Auth no client **explícita e intencional** (`local`, sobrevive a reload/fechar aba), em vez de depender do default implícito do SDK. Garantir que a configuração esteja aplicada antes de qualquer operação de sign-in, sem introduzir corrida com o primeiro `onAuthStateChanged`. Registrar o achado de auditoria de persistência (estado atual client vs server) como documentação.

## 3. In scope
- Aplicar `setPersistence(firebaseAuth, browserLocalPersistence)` na inicialização do client (`src/firebase/client.ts`).
- Expor o resultado dessa chamada como uma `Promise` aguardável (ex.: `authPersistenceReady`) para que o fluxo de sign-in possa garantir que a persistência foi aplicada antes de autenticar.
- Fazer `signIn` (e `signUp`, se aplicável) aguardarem essa prontidão antes de chamar `signInWithEmailAndPassword` / `createUserWithEmailAndPassword`.
- Guard client-only: a chamada só roda no browser (`typeof window !== "undefined"`), nunca em SSR/edge.
- Compatibilidade com o caminho de emulador já existente (não regredir `connectAuthEmulator`).
- Documentar o achado de auditoria (Frente A): client persiste indefinidamente via persistência local; cookie `__session` server expira fixo em 5d sem renovação → mismatch que a TASK-02 corrige. Registrar como comentário no código e/ou nota curta no spec/PR.

## 4. Out of scope
- Renovação deslizante do cookie `__session` (TASK-02).
- Qualquer fluxo WebAuthn/biometria (TASK-03+).
- Toggle "manter conectado" (`local` vs `session`) — decisão travada: `local` fixo.
- Alteração da validade ou lógica do cookie de sessão.
- Mudanças em `middleware.ts`.

## 5. Áreas técnicas envolvidas
- `src/firebase/client.ts` — chamada de `setPersistence` + export da prontidão.
- `src/services/auth.ts` — `signIn`/`signUp` aguardam a prontidão antes de autenticar.
- `src/providers/AuthProvider.tsx` — apenas verificar que `onAuthStateChanged` não conflita; sem mudança de comportamento esperada.

## 6. Regras e comportamento
- Persistência alvo: **`browserLocalPersistence`** (localStorage) — sessão sobrevive a reload e fechamento de aba. É o comportamento esperado para "manter logado".
- `setPersistence` é **assíncrono** (`Promise<void>`). A aplicação não pode autenticar antes dela resolver, sob risco de a sessão ser gravada com persistência diferente da pretendida.
- Em caso de falha de `setPersistence` (ambiente sem storage, modo privado restrito): **best-effort** — logar e seguir; o SDK cai no fallback de persistência disponível. Não derrubar o app nem bloquear o login. A ausência de persistência local só significa que a sessão não sobrevive ao fechar a aba.
- A chamada é **idempotente** e segura sob hot reload (singleton do app já existente).

## 7. Contratos e interfaces
- `src/firebase/client.ts` passa a exportar, além de `firebaseApp`, `firebaseAuth`, `firestore`:
  - `authPersistenceReady: Promise<void>` — resolve quando `setPersistence` concluiu (ou falhou em best-effort). No server (sem `window`), resolve imediatamente.
- `signIn(email, password)`: assinatura inalterada; internamente `await authPersistenceReady` antes de `signInWithEmailAndPassword`.
- Sem novos endpoints, eventos ou contratos de rede.
- Imports de `firebase/auth`: `setPersistence`, `browserLocalPersistence` (API confirmada via context7 para firebase 12.x — `setPersistence(auth, persistence): Promise<void>`).

## 8. Impacto de dados e persistência
- Nenhuma mudança de schema, Firestore ou índices.
- Muda apenas onde/como o SDK do Firebase Auth grava o estado de sessão no browser (já era local por default; agora explícito).

## 9. Testes obrigatórios
- **`src/firebase/client.ts` / barrel:** `authPersistenceReady` está exportado e é uma `Promise`. (Mock de `firebase/auth` — `setPersistence` chamado com `browserLocalPersistence`.)
- **`signIn` aguarda a prontidão:** teste de `services/auth.ts` garantindo que `signInWithEmailAndPassword` só é chamado após `authPersistenceReady` resolver (ordem). Verificar via mock que `setPersistence` foi invocado.
- **Best-effort:** `setPersistence` rejeitando NÃO propaga erro a `signIn` nem impede a autenticação.
- **Server-safe:** sem `window`, `authPersistenceReady` resolve sem chamar `setPersistence`.
- **Regressão emulador:** o guard de emulador continua funcionando (não reconecta em hot reload).
- Vitest. Verificar resultado real via JSON em caso de falha de carga (resumo do runner pode mascarar load-failure).

## 10. Critérios de aceite
- `setPersistence(firebaseAuth, browserLocalPersistence)` é chamado uma vez na init client, guardado por `typeof window !== "undefined"`.
- `signIn` comprovadamente aguarda `authPersistenceReady` antes de autenticar.
- Falha de `setPersistence` não quebra login nem app (best-effort logado).
- Nenhuma regressão em `onAuthStateChanged`/`AuthProvider` nem no caminho de emulador.
- `typecheck` (sem `any`), `lint` e suíte de testes passam.
- Achado de auditoria de persistência documentado (comentário no código).

## 11. Constraints
- TypeScript strict, sem `any`.
- Sem estilos inline; N/A (não há UI).
- Comentários/domínio em pt-BR.
- Não importar `firebase-admin` no client.
- Manter `src/firebase/client.ts` como única fonte do singleton de Auth/Firestore client.
- Best-effort em falhas de persistência — disponibilidade do login acima da garantia de persistência.

## 12. Execution cost profile
- tdd: n/a
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/medium

## 13. Frontend indicator
- is_frontend: false
- reason: Configuração de inicialização do SDK Firebase Auth e camada de serviço. Sem telas, componentes, layout ou interação de usuário.

## 14. Open questions
- Nenhuma que bloqueie. Decisões travadas no plano (`local` fixo, best-effort). `browserLocalPersistence` escolhido sobre `indexedDBLocalPersistence` por ser o padrão explícito mais portável; ambos são "local" — sem impacto funcional para o usuário.
