# SPEC — AUTH TASK-04: Expor `refreshProfile` no AuthProvider

> Entrada: `ai/plan/auth.md` (TASK-04) + `.claude/CLAUDE.md`.
> Tipo: `application` · Criticidade: `high` · Risco técnico: `medium` · Story points: 3.
> TDD: sim · Screen: não · Dependências: nenhuma.

> Nota de naming: o slot `ai/spec/task-04.md` já está ocupado pelo SPEC da TASK-04
> do plano `feature.md` (fundação PRD-00, "Estrutura de pastas + barrels"). Para
> não sobrescrever artefato não relacionado, este SPEC do plano `auth.md` foi
> gravado como `ai/spec/auth-task-04.md` (consistente com `auth-task-01.md`).

---

## 1. Objetivo

Permitir releitura manual do perfil `users/{uid}` sem depender de um novo evento
`onAuthStateChanged`. O fluxo de carga/parse do perfil (hoje embutido no
`useEffect` do provider) é extraído para uma função reutilizável, invocável tanto
pelo ciclo de `onAuthStateChanged` quanto sob demanda via `refreshProfile`.

Motivação (R4): após o admin aprovar um usuário `pending`, o documento muda no
Firestore mas o Firebase Auth **não** emite novo `onAuthStateChanged`. Sem um
refresh manual, o usuário ficaria preso na tela Pending até relogar. A TASK-09
(botão "Atualizar Status") é o consumidor direto.

---

## 2. Escopo

### Dentro do escopo
- Extrair a leitura/parse do perfil (`getDoc(users/{uid})` → `userSchema.safeParse`
  → `setProfile`/`setError`) para uma função reutilizável (`loadProfile`).
- Adicionar `refreshProfile(): Promise<void>` ao `AuthContextValue` e provê-la no
  `value` do contexto.
- Guarda de concorrência/staleness: ignorar resultado se o usuário corrente mudou
  ou se o provider desmontou durante o `await`.

### Fora do escopo
- Nenhuma alteração visual/UI (isso é TASK-09).
- Nenhuma mudança nos campos/comportamento existentes do contexto — apenas
  **extensão**.
- Não altera o contrato de `AuthGuard`, `AuthLayout`, `useAuth`.

> Não alterar `firestore.rules`, schemas, tipos nem configs. Só
> `src/providers/AuthProvider.tsx` (+ ajuste mínimo nos testes para refletir o
> contrato estendido).

---

## 3. Contrato (após mudança)

```ts
export interface AuthContextValue {
  firebaseUser: FirebaseUser | null;   // inalterado
  profile: User | null;                // inalterado
  status: UserStatus | null;           // inalterado
  role: Role | null;                   // inalterado
  loading: boolean;                    // inalterado
  error: AuthProfileError | null;      // inalterado
  /** NOVO: relê users/{uid} sob demanda. No-op seguro se deslogado. */
  refreshProfile: () => Promise<void>;
}
```

### Semântica de `refreshProfile`
- **Deslogado** (`firebaseUser === null`): no-op seguro. Não chama `getDoc`, não
  altera estado, resolve a Promise normalmente.
- **Logado**: relê `users/{uid}`, ligando `loading` durante a operação e
  atualizando `profile`/`error`:
  - doc existe e válido → `setProfile(parsed)`, `setError(null)`.
  - doc não existe → `setProfile(null)`, `setError("not-found")`.
  - doc inválido → `setProfile(null)`, `setError("parse-error")`.
  - falha de leitura → `setProfile(null)`, `setError("fetch-error")`.
- **Guarda de staleness**: captura a geração corrente; se durante o `await` o
  usuário mudar (novo `onAuthStateChanged`) ou o provider desmontar, o resultado
  é descartado (sem `setState`).

---

## 4. Decisão de implementação

A lógica de resolução do perfil hoje vive dentro do `useEffect` e fecha sobre uma
flag local `active` (token de geração por ciclo do effect) e sobre `nextUser`.
Para reusá-la em `refreshProfile` (chamado fora do `useEffect`), o guard de
concorrência é promovido a refs estáveis:

- `mountedRef: useRef<boolean>` — true enquanto o provider está montado.
- `generationRef: useRef<number>` — contador monotônico incrementado a cada
  troca de usuário (`onAuthStateChanged`) **e** a cada `refreshProfile`. Unifica o
  guard: qualquer ciclo novo invalida resultados em voo de ciclos anteriores.

Função reutilizável `loadProfile(uid: string, generation: number): Promise<void>`:
faz o `getDoc` + `safeParse` e só aplica `setState` quando
`mountedRef.current && generation === generationRef.current`.

- `onAuthStateChanged` → incrementa `generationRef`, seta `firebaseUser`, e
  chama `loadProfile(uid, generation)` (ou trata o caso deslogado).
- `refreshProfile` (memoizado com `useCallback`, deps só de refs estáveis) →
  lê `firebaseUser` corrente via ref; se null, no-op; senão incrementa
  `generationRef` e chama `loadProfile(uid, generation)`.

Como `refreshProfile` precisa do `firebaseUser` corrente sem recriar o callback a
cada render, mantém-se também um `firebaseUserRef` espelhando o estado.

`refreshProfile` é incluída no `value` memoizado. Por ser estável (deps de refs),
não muda a identidade do `value` além do que já mudava.

---

## 5. Riscos / mitigação

| # | Risco | Mitigação |
|---|---|---|
| R4 | Race com `onAuthStateChanged` (stale state) | Contador de geração compartilhado (`generationRef`); resultado aplicado só se geração ainda for a corrente. |
| T1 | `setState` após unmount | `mountedRef` checado antes de cada `setState`. |
| T2 | Quebra de consumidores existentes | Campo apenas adicionado; nenhum existente removido/alterado. `useAuth.test.tsx` (que constrói um literal de `AuthContextValue`) é estendido com a nova função para refletir o contrato. |

---

## 6. Plano de teste (TDD)

Ambiente: `@testing-library/react` + `jsdom` (já configurados — ver
`vitest.config.ts` e `package.json`). Reusa o padrão de mocks do
`AuthProvider.test.tsx` (mock de `firebase/auth`, `firebase/firestore`, `@/firebase`).

A `ContextProbe` é estendida para expor um botão que dispara `refreshProfile`.

Casos novos para `refreshProfile`:
1. **pending → approved**: monta logado com perfil `pending`; troca o mock do
   `getDoc` para retornar `approved`; clica em refresh; espera `status === "approved"`.
2. **no-op deslogado**: `callback(null)`; limpa o histórico do mock; clica em
   refresh; `getDoc` não é chamado e o estado permanece inalterado.
3. **approved → not-found**: logado com perfil válido; troca mock para doc
   inexistente; clica em refresh; espera `error === "not-found"`, `profile === null`.

Casos existentes (regressão): todos os testes atuais de `AuthProvider` e
`useAuth` devem continuar passando.

Comando: `npx vitest run`.
