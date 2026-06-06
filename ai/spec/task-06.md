# SPEC — TASK-06: Provedores globais (QueryClient, Auth, Toaster)

> Entrada: `ai/plan/feature.md` (TASK-06) + `ai/prd/feature.md` (camada estado/dados, riscos) + `.claude/CLAUDE.md` (cache 30min/24h, controle de acesso status/role, fluxo de auth).
> Tipo: `application` · Criticidade: `critical` · Risco técnico: `medium` · Story points: 3.
> TDD: **sim** · Screen: não · Dependências: **TASK-03** (libs) + **TASK-05** (Firebase) — Wave 3.

---

## 1. Objetivo

Montar os **provedores raiz** da aplicação e o hook de sessão, formando a camada de **estado/dados** sobre a qual todas as features do MVP serão construídas:

- **React Query** com `QueryClient` configurado (cache 30min/24h) e instância estável (não recriada a cada render).
- **AuthProvider** que escuta o estado de autenticação do Firebase (`onAuthStateChanged`), carrega o perfil do usuário em `users/{uid}` (validado com `userSchema`/Zod) e expõe `{ firebaseUser, profile, status, role, loading }` via Context.
- **Toaster** (Sonner) montado globalmente.
- **`useAuth`** — hook tipado que lê o `AuthContext` e lança erro se usado fora do provider.
- Wiring no `src/app/layout.tsx` (layout permanece **Server Component** envolvendo um boundary `'use client'` de `Providers`).

### Truths que devem ser verdadeiras ao fim
- `src/providers/QueryProvider.tsx` — Client Component, `QueryClient` com `defaultOptions.queries.staleTime = 30*60*1000` e `gcTime = 24*60*60*1000`, instância criada via `useState` (estável por render).
- `src/providers/AuthProvider.tsx` — Client Component, escuta `onAuthStateChanged`, carrega/valida perfil do Firestore, expõe Context tipado; trata os 4 estados (não autenticado, autenticado-sem-perfil, perfil carregando, falha de parse).
- `src/providers/index.tsx` — compõe `QueryProvider > AuthProvider` e monta `<Toaster />`; é o que o `layout.tsx` usa para envolver `children`.
- `src/hooks/useAuth.ts` — hook tipado, lança se fora do provider.
- `src/app/layout.tsx` — envolve `children` com `<Providers>`; **continua sem `'use client'`** (Server Component).
- Sem `any`, sem estilos inline, totalmente tipado (`.claude/CLAUDE.md`).
- Testes (Vitest + `@testing-library/react`) cobrindo: `useAuth` fora do provider, transições de estado do `AuthProvider`, opções padrão do `QueryClient`.
- `npm run typecheck`, `npm run lint`, `npm run build` e `npm run test` **verdes**.

---

## 2. Escopo

### Dentro do escopo
- `src/providers/QueryProvider.tsx` — provider React Query + `QueryClient` configurado.
- `src/providers/AuthProvider.tsx` — `AuthContext` + listener Firebase + carga do perfil Firestore.
- `src/providers/index.tsx` — composição de providers + `<Toaster />` (passa a ser `.tsx`; o atual barrel `index.ts` vazio é substituído — ver 4.5).
- `src/hooks/useAuth.ts` — hook de leitura do contexto + reexport no barrel `src/hooks/index.ts`.
- Wiring em `src/app/layout.tsx`.
- Testes unitários (seção 7) + deps de teste (`@testing-library/react`, `@testing-library/dom`, `jsdom`) e ajuste do `vitest.config.ts` para ambiente `jsdom` nos testes de componente.

### Fora do escopo (tarefas posteriores)
- **Telas de Login/Cadastro/Aprovação** e formulários de auth → **PRD-01**. Aqui não há UI de autenticação, apenas o provider/estado.
- **Guard de rota por status** (redirect `pending`/`blocked`) → **TASK-11** (app shell). `AuthProvider` apenas **expõe** `status`/`role`; não roteia.
- **Hooks de dados de domínio** (queries de matches/predictions etc.) → PRDs futuros. Aqui só a infra de `QueryClient`.
- **Persistência do cache** (React Query persister / Local Storage) — `.claude/CLAUDE.md` cita Local Storage para sessão/preferências, mas isso é refinamento posterior; não é requisito desta task.
- **ThemeProvider** (`next-themes` está instalado) — não pedido nesta task; não adicionar.

> Não criar lógica de domínio, telas de feature, nem tocar em schemas/Firestore além de **ler** `users/{uid}`.

---

## 3. Dependências npm a adicionar

Runtime já instalado: `@tanstack/react-query@5.101.0`, `sonner@^2.0.7`, `firebase@12.14.0`, `zod@4.4.3`. **Nada novo de runtime.**

Apenas **devDeps de teste** (ainda não presentes):

```bash
npm install -D @testing-library/react @testing-library/dom @testing-library/jest-dom jsdom
```

| Pacote | Tipo | Papel |
|---|---|---|
| `@testing-library/react` | devDependency | `render`/`renderHook` para testar provider e `useAuth` |
| `@testing-library/dom` | devDependency | peer dependency de `@testing-library/react` |
| `@testing-library/jest-dom` | devDependency | matchers (`toBeInTheDocument` etc.) — opcional, mas útil |
| `jsdom` | devDependency | ambiente DOM para os testes de componente no Vitest |

> `react`/`react-dom@19.2.7` já satisfazem o peer de `@testing-library/react`. Confirmar versões compatíveis com React 19 no momento da instalação.

---

## 4. Código

Restrições (`.claude/CLAUDE.md`): TS strict, **sem `any`**, **sem estilos inline**, componentes totalmente tipados, **toda consulta ao Firestore** conceitualmente via TanStack Query — exceção justificada: o **listener de sessão** usa `onAuthStateChanged` (idioma do Firebase, baseado em subscription, não em fetch pontual), que é a forma correta e não deve ser forçado para dentro de uma query.

Imports do Firebase vêm do barrel client: `import { firebaseAuth, firestore } from "@/firebase"` (já exporta `firebaseAuth`/`firestore`). Tipos de domínio de `@/types` (`User`, `Role`, `UserStatus`).

### 4.1 `src/providers/QueryProvider.tsx` — React Query

Client Component. `QueryClient` criado **uma vez** via inicializador de `useState` (nunca recriado por render, nunca compartilhado entre requests no server). Config de cache do `.claude/CLAUDE.md`.

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Cache padrão do projeto (.claude/CLAUDE.md):
const STALE_TIME = 30 * 60 * 1000; // 30 minutos
const GC_TIME = 24 * 60 * 60 * 1000; // 24 horas

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME,
        gcTime: GC_TIME,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // Inicializador do useState → instância estável por montagem do componente.
  // NÃO usar `new QueryClient()` direto no corpo (recriaria a cada render).
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

> **Por que `useState(makeQueryClient)` e não módulo-singleton:** no App Router, um singleton de módulo seria compartilhado entre requisições no servidor (vazamento de dados entre usuários). O inicializador de `useState` garante: (a) uma instância por árvore montada no client; (b) estabilidade entre renders. Passa-se a **referência da função** `makeQueryClient` (lazy), não `makeQueryClient()`.

### 4.2 `src/providers/AuthProvider.tsx` — sessão + perfil

Client Component. Define `AuthContext`, escuta `onAuthStateChanged` e, havendo usuário, carrega `users/{uid}` com `getDoc`, validando com `userSchema`. Expõe a forma de contexto da seção 5.

```tsx
"use client";

import {
  createContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { firebaseAuth, firestore } from "@/firebase";
import { userSchema } from "@/schemas";
import type { Role, User, UserStatus } from "@/types";

export interface AuthContextValue {
  /** Usuário autenticado no Firebase Auth, ou null se deslogado. */
  firebaseUser: FirebaseUser | null;
  /** Perfil validado de `users/{uid}`, ou null (deslogado / sem doc / parse-fail). */
  profile: User | null;
  /** Status de acesso (derivado de profile), ou null se indisponível. */
  status: UserStatus | null;
  /** Papel (derivado de profile), ou null se indisponível. */
  role: Role | null;
  /** true enquanto resolve sessão e/ou carrega o perfil. */
  loading: boolean;
  /** Erro de carga/parse do perfil (ex.: doc inválido), senão null. */
  error: AuthProfileError | null;
}

export type AuthProfileError = "not-found" | "parse-error" | "fetch-error";

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [error, setError] = useState<AuthProfileError | null>(null);
  // Começa carregando: ainda não sabemos se há sessão.
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Subscription de sessão (idioma Firebase). Retorna o unsubscribe.
    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      // Cada mudança de auth reinicia a resolução do perfil.
      void resolveSession(nextUser);
    });

    async function resolveSession(nextUser: FirebaseUser | null) {
      setFirebaseUser(nextUser);
      setError(null);

      if (!nextUser) {
        // Não autenticado.
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const snapshot = await getDoc(doc(firestore, "users", nextUser.uid));

        if (!snapshot.exists()) {
          // Autenticado, mas sem doc de perfil (ex.: cadastro incompleto).
          setProfile(null);
          setError("not-found");
          return;
        }

        const parsed = userSchema.safeParse(snapshot.data());
        if (!parsed.success) {
          // Doc existe mas não bate com o schema → não confiar nele.
          setProfile(null);
          setError("parse-error");
          return;
        }

        setProfile(parsed.data);
      } catch {
        // Falha de rede/permissão ao ler o perfil.
        setProfile(null);
        setError("fetch-error");
      } finally {
        setLoading(false);
      }
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      status: profile?.status ?? null,
      role: profile?.role ?? null,
      loading,
      error,
    }),
    [firebaseUser, profile, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
```

> **Sobre "toda consulta usa TanStack Query":** o **listener** de sessão é subscription, não fetch — fica fora dessa regra (idioma Firebase). A **leitura do perfil** poderia, em refinamento futuro, ser uma `useQuery` keyada por `uid` (cache 30min/24h). Para esta task, manter o `getDoc` dentro do efeito de sessão é aceitável e mais simples, pois o ciclo de vida do perfil está acoplado ao de `onAuthStateChanged`. Decisão registrada na seção 9 (alternativa T-React-Query).

> **Concorrência:** uma troca rápida de usuário pode disparar duas resoluções. Para esta task (< 100 usuários, troca de conta rara) o último `setState` vence. Se quiser robustez, guardar um token de geração no efeito e ignorar resultados obsoletos (opcional — seção 9).

### 4.3 `src/hooks/useAuth.ts` — hook tipado

```ts
import { useContext } from "react";

import { AuthContext, type AuthContextValue } from "@/providers/AuthProvider";

/**
 * Lê o AuthContext. Lança se usado fora do <AuthProvider>.
 * Garante consumidor sempre com contexto definido (sem checagem de undefined).
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth deve ser usado dentro de <AuthProvider>.");
  }
  return ctx;
}
```

> Reexportar em `src/hooks/index.ts`: `export { useAuth } from "./useAuth";` (substitui o `export {}` placeholder).

### 4.4 `src/providers/index.tsx` — composição + Toaster

Compõe `QueryProvider` (externo) > `AuthProvider` (interno) e monta `<Toaster />` do Sonner. Ordem importa: auth pode, no futuro, usar React Query → query precisa estar acima.

```tsx
"use client";

import type { ReactNode } from "react";
import { Toaster } from "sonner";

import { QueryProvider } from "./QueryProvider";
import { AuthProvider } from "./AuthProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        {children}
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </QueryProvider>
  );
}
```

> **`<Toaster />`** dentro do boundary client. Props (`richColors`, `position`) são configuração da lib, não estilo inline. Se o projeto já tiver um wrapper Shadcn de `sonner` (TASK-02 lista um componente `sonner`), **reusar esse** em vez de importar `Toaster` direto — verificar `src/components/ui/sonner.tsx`; se existir, importar dele.

> **Barrel:** o arquivo atual é `src/providers/index.ts` (vazio). Esta task o **substitui por `index.tsx`** exportando `Providers`. Remover o `index.ts` antigo para não haver dois barrels concorrentes. Reexportar também `QueryProvider`/`AuthProvider`/`AuthContext`/tipos se conveniente para os testes.

### 4.5 `src/app/layout.tsx` — wiring (Server Component)

O layout **permanece Server Component** (sem `'use client'`). Envolve apenas `children` com `<Providers>` (boundary client). Metadata e fontes continuam no server.

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Providers } from "@/providers";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Bolão dos Parças",
  description: "Prognósticos da Copa do Mundo 2026",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={cn("font-sans", geist.variable)}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

---

## 5. Forma do `AuthContext`

| Campo | Tipo | Significado |
|---|---|---|
| `firebaseUser` | `FirebaseUser \| null` | Usuário do Firebase Auth (`firebase/auth`). `null` = deslogado. |
| `profile` | `User \| null` | Doc `users/{uid}` validado por `userSchema`. `null` = deslogado / sem doc / parse-fail. |
| `status` | `UserStatus \| null` | `profile.status` (`pending`/`approved`/`blocked`) ou `null`. |
| `role` | `Role \| null` | `profile.role` (`user`/`admin`) ou `null`. |
| `loading` | `boolean` | `true` enquanto resolve sessão e/ou carrega perfil. |
| `error` | `AuthProfileError \| null` | `"not-found"` \| `"parse-error"` \| `"fetch-error"` \| `null`. |

`User`, `Role`, `UserStatus` vêm de `@/types` (derivados de Zod na TASK-07). `FirebaseUser` é `import { type User as User } from "firebase/auth"` (renomeado para `FirebaseUser` para não colidir com o `User` de domínio).

### Matriz de estados (saída do provider)

| Cenário | `firebaseUser` | `profile` | `status`/`role` | `loading` | `error` |
|---|---|---|---|---|---|
| Resolvendo sessão (inicial) | `null` | `null` | `null` | `true` | `null` |
| Não autenticado | `null` | `null` | `null` | `false` | `null` |
| Autenticado, carregando perfil | `User` | `null` | `null` | `true` | `null` |
| Autenticado + perfil OK | `User` | `User` | preenchidos | `false` | `null` |
| Autenticado, sem doc de perfil | `User` | `null` | `null` | `false` | `"not-found"` |
| Autenticado, doc inválido (parse-fail) | `User` | `null` | `null` | `false` | `"parse-error"` |
| Autenticado, erro de leitura | `User` | `null` | `null` | `false` | `"fetch-error"` |

---

## 6. Considerações de SSR (Next 15 App Router)

- **`layout.tsx` é Server Component** e assim permanece. Não recebe `'use client'`. Renderiza o `<html>/<body>` no servidor e injeta `<Providers>` (client) como filho.
- **Todos os providers são `'use client'`** (`QueryProvider`, `AuthProvider`, `Providers`), pois usam hooks (`useState`/`useEffect`/`useContext`) e APIs de browser (Firebase Auth/Firestore client SDK).
- **`QueryClient` nunca como singleton de módulo no server** — seria compartilhado entre requests. Resolvido pelo inicializador de `useState` (4.1).
- **Firebase Auth roda só no browser** — `onAuthStateChanged` dispara no client; durante SSR/primeiro paint, `loading=true` e `firebaseUser=null`. Componentes que dependem de auth devem tratar `loading` (evita hydration mismatch ao não renderizar conteúdo dependente de sessão antes do client resolver).
- **Sem `window`/`localStorage` no corpo dos módulos** — qualquer acesso fica dentro de `useEffect` (já é o caso). O barrel `@/firebase` (client) só é importado por componentes client, então não é avaliado no server além do necessário.

---

## 7. Testes (TDD)

`.claude/CLAUDE.md` + plano marcam TDD = sim ("sessão = regressão-prone"). Vitest 4 já instalado. Adicionar `@testing-library/react` + `jsdom` (seção 3). Mockar `firebase/auth` e `firebase/firestore` para não tocar rede/emulador nos testes unitários.

### 7.1 Ajuste de ambiente — `vitest.config.ts`

O config atual usa `environment: "node"` (ok para schemas). Testes de componente precisam de DOM. Opções:

- **Recomendado:** usar `// @vitest-environment jsdom` no topo dos arquivos de teste de componente (mantém `node` como default global para os testes de schema, que são maioria), **ou**
- Migrar para `environmentMatchGlobs` / projetos do Vitest 4 para aplicar `jsdom` só a `*.tsx`/`*.dom.test.ts`.

Manter `include` cobrindo `src/**/*.test.{ts,tsx}` (adicionar `tsx`).

### 7.2 Mocks

```ts
// Exemplo de mock (vi.mock) — ajustar caminhos ao import real do provider.
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
  // ...
}));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
}));
vi.mock("@/firebase", () => ({
  firebaseAuth: {},
  firestore: {},
}));
```

> Estratégia: controlar o callback de `onAuthStateChanged` (capturá-lo do mock e invocá-lo manualmente com `null` ou um fake `FirebaseUser`) e o retorno de `getDoc` (`{ exists: () => boolean, data: () => unknown }`) para dirigir cada transição.

### 7.3 Casos obrigatórios

**`src/hooks/__tests__/useAuth.test.tsx`**
- [ ] `useAuth` **lança** `"useAuth deve ser usado dentro de <AuthProvider>."` quando renderizado **sem** provider (`renderHook(useAuth)` → espera erro).
- [ ] `useAuth` retorna o valor do contexto quando dentro do `<AuthProvider>`.

**`src/providers/__tests__/AuthProvider.test.tsx`** (dirigir o callback do mock de `onAuthStateChanged`)
- [ ] **Estado inicial:** antes do callback, `loading=true`, `firebaseUser=null`, `profile=null`.
- [ ] **Não autenticado:** callback com `null` → `loading=false`, `firebaseUser=null`, `profile=null`, `error=null`.
- [ ] **Autenticado → perfil OK:** callback com fake user + `getDoc` retorna doc válido → `profile` preenchido, `status`/`role` derivados, `loading=false`, `error=null`.
- [ ] **Autenticado, sem doc:** `getDoc.exists()===false` → `profile=null`, `error="not-found"`, `loading=false`.
- [ ] **Autenticado, parse-fail:** `getDoc` retorna objeto que **não** passa no `userSchema` → `profile=null`, `error="parse-error"`, `loading=false`.
- [ ] **Erro de leitura:** `getDoc` rejeita → `profile=null`, `error="fetch-error"`, `loading=false`.
- [ ] **Unsubscribe:** ao desmontar, o `unsubscribe` retornado por `onAuthStateChanged` é chamado.

**`src/providers/__tests__/QueryProvider.test.tsx`**
- [ ] `QueryClient` exposto tem `defaultOptions.queries.staleTime === 30*60*1000` e `gcTime === 24*60*60*1000`. (Ler via um componente filho que faz `useQueryClient().getDefaultOptions()`, ou testar `makeQueryClient()` extraído.)
- [ ] A instância é **estável** entre re-renders (não recriada).

> Para a asserção das opções, considerar **exportar `makeQueryClient`** de `QueryProvider.tsx` (ou um módulo `queryClient.ts`) e testá-la isoladamente — mais simples e direto que inspecionar via árvore.

---

## 8. Passo a passo de implementação (ordem TDD)

1. **Instalar devDeps de teste** (seção 3) e ajustar `vitest.config.ts`/`include` p/ `tsx` + `jsdom` (7.1).
2. **Escrever testes primeiro** (seção 7) — vermelhos.
3. **Implementar `QueryProvider.tsx`** (4.1) → teste de opções/estabilidade verde.
4. **Implementar `AuthProvider.tsx`** (4.2) com `AuthContext`/tipos (seção 5) → testes de transição verdes.
5. **Implementar `useAuth.ts`** (4.3) + reexport no barrel de hooks → teste de "lança fora do provider" verde.
6. **Implementar `providers/index.tsx`** (4.4): compor + `<Toaster />`; remover `index.ts` antigo.
7. **Wire `app/layout.tsx`** (4.5).
8. **Verificar** com a seção 10 e reportar saída real.

---

## 9. Riscos e mitigações (desta tarefa)

| # | Risco | Mitigação |
|---|---|---|
| T1 | `QueryClient` recriado a cada render | Inicializador de `useState(makeQueryClient)` (referência lazy), nunca `new` no corpo |
| T2 | `QueryClient` vazando entre requests no SSR | Instância por árvore client via `useState`; sem singleton de módulo |
| T3 | `useAuth` usado fora do provider → estado indefinido silencioso | `createContext(undefined)` + throw explícito no hook |
| T4 | Doc de perfil corrompido/divergente do schema | `userSchema.safeParse`; em falha, `profile=null` + `error="parse-error"` (não confiar no doc) |
| T5 | Hydration mismatch (auth só resolve no client) | Estado inicial `loading=true`; consumidores tratam `loading` antes de renderizar conteúdo dependente de sessão |
| T6 | Listener não removido (leak) | Retornar `unsubscribe` no cleanup do `useEffect`; teste cobre o unsubscribe |
| T7 | Troca rápida de usuário → resultado obsoleto sobrescreve | Aceito p/ esta task (último vence); opção de token de geração registrada se necessário |
| T-React-Query | Perfil fora do TanStack Query (regra "toda consulta usa Query") | Justificado: ciclo do perfil acoplado a `onAuthStateChanged` (subscription). Refino futuro: `useQuery` keyada por `uid` |

---

## 10. Critérios de aceite e verificação

```bash
npm run test         # vitest run → todos os casos da seção 7 verdes
npm run typecheck    # tsc --noEmit → 0 erros, sem any
npm run lint         # next lint → 0 erros/warnings
npm run build        # next build → sucesso (layout server + Providers client)
```

Checklist:
- [ ] `QueryProvider.tsx` é `'use client'`, `QueryClient` via `useState(makeQueryClient)`, `staleTime=30min`/`gcTime=24h`.
- [ ] `AuthProvider.tsx` é `'use client'`, escuta `onAuthStateChanged`, lê `users/{uid}` com `getDoc`, valida com `userSchema`, expõe `{ firebaseUser, profile, status, role, loading, error }`.
- [ ] Os 4+ estados tratados (não-auth, auth-sem-perfil, perfil-carregando, parse-fail) conforme matriz (seção 5).
- [ ] `useAuth.ts` lança fora do provider; reexportado no barrel `src/hooks/index.ts`.
- [ ] `providers/index.tsx` compõe `QueryProvider > AuthProvider` + `<Toaster />`; `index.ts` antigo removido.
- [ ] `app/layout.tsx` envolve `children` com `<Providers>` e **permanece Server Component** (sem `'use client'`).
- [ ] Sem `any`, sem estilos inline; tudo tipado.
- [ ] `test`, `typecheck`, `lint`, `build` verdes.

---

## 11. Notas para as próximas tarefas
- **TASK-11** (app shell) consome `useAuth` para o **guard de rota por status** (`pending`/`blocked` → tela "Aguardando Aprovação" / bloqueio) e estados logado/deslogado. Esta task entrega o estado; o roteamento é lá.
- **PRD-01** (auth) usa `firebaseAuth` para login/cadastro e cria o doc `users/{uid}` (resolvendo o estado `"not-found"` desta task no fluxo de cadastro).
- **Refino de cache:** mover a leitura do perfil para `useQuery` keyada por `uid` (cache 30min/24h) e, se desejado, persistir sessão/preferências em Local Storage (citado em `.claude/CLAUDE.md`).
