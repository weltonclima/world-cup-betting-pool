# Revisão de Código — TASK-06: Provedores Globais (QueryClient, Auth, Toaster)

**Revisado em:** 2026-06-05  
**Profundidade:** deep (análise cross-file + foco em race conditions e segurança de auth)  
**Arquivos revisados:** `src/providers/QueryProvider.tsx`, `src/providers/AuthProvider.tsx`, `src/providers/index.tsx`, `src/hooks/useAuth.ts`, `src/hooks/index.ts`, `src/app/layout.tsx`, `src/providers/__tests__/AuthProvider.test.tsx`, `src/providers/__tests__/QueryProvider.test.tsx`, `src/hooks/__tests__/useAuth.test.tsx`  
**Veredicto:** `aprovado com ajustes`

---

## Gates de Verificação

| Gate | Resultado |
|------|-----------|
| `npm run test` | ✓ 97 testes, 13 arquivos, todos verdes |
| `npm run typecheck` | ✓ 0 erros (`tsc --noEmit`) |
| `npm run lint` | ✓ 0 erros/warnings |
| `npm run build` | ✓ Build limpo (após limpar cache `.next` — ver WR-03) |
| IDE diagnostics (5 arquivos) | ✓ 0 erros TypeScript |

---

## Resumo

A implementação cobre corretamente os requisitos centrais da TASK-06:

- `QueryClient` criado via `useState(makeQueryClient)` — instância estável por montagem, nunca recriada por render, nunca singleton de módulo SSR.
- `staleTime = 30 * 60 * 1000` e `gcTime = 24 * 60 * 60 * 1000` corretos e testados.
- `AuthProvider` cobre todos os 7 estados da matriz da spec: resolving, não-autenticado, carregando-perfil, perfil-ok, not-found, parse-error, fetch-error.
- `onAuthStateChanged` corretamente subscrito em `useEffect`, `unsubscribe` chamado no cleanup.
- `userSchema.safeParse` aplicado antes de confiar no doc do Firestore.
- `useAuth` lança explicitamente fora do provider via `createContext(undefined)` + guarda.
- `layout.tsx` permanece Server Component sem `'use client'`.
- Sem `any`, sem estilos inline, totalmente tipado.
- Testes cobrem todos os 8 casos obrigatórios da spec (seção 7.3).

Dois achados classificados como WARNING: uma race condition de setState-após-desmontagem aceita pelo spec mas sem proteção explícita, e um `TooltipProvider` adicionado fora do escopo da task. Nenhum BLOCKER encontrado.

---

## Achados Críticos (BLOCKER)

Nenhum.

---

## Avisos (WARNING)

### WR-01: setState-após-desmontagem — `resolveSession` em voo quando componente é desmontado

**Arquivo:** `src/providers/AuthProvider.tsx:46-96`  
**Issue:** O cleanup do `useEffect` (linha 93-95) chama `unsubscribe()`, impedindo que *novos* eventos de auth disparem `resolveSession`. Porém, se uma chamada de `resolveSession` já estiver em voo (aguardando `getDoc`) no momento da desmontagem, os `setState` dentro dela (linhas 59-60, 64, 70-72, 78-80, 83, 86-89) ainda serão executados sobre um componente desmontado.

No React 18+ isso não lança exceção, mas produz um warning no console em desenvolvimento e constitui potencial para comportamento inesperado em re-montagens rápidas (ex.: Strict Mode, hot-reload, troca de conta).

A spec registra o risco T7 ("último setState vence") para troca rápida de usuário, mas não cobre explicitamente o caso de desmontagem com fetch em voo.

**Fix recomendado:**
```tsx
useEffect(() => {
  let active = true; // token de geração; invalida operações deste ciclo

  const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
    void resolveSession(nextUser);
  });

  async function resolveSession(nextUser: FirebaseUser | null) {
    if (!active) return; // descarta se já desmontado
    setFirebaseUser(nextUser);
    setError(null);

    if (!nextUser) {
      if (active) { setProfile(null); setLoading(false); }
      return;
    }

    if (active) setLoading(true);
    try {
      const snapshot = await getDoc(doc(firestore, "users", nextUser.uid));
      if (!active) return; // resultado obsoleto após desmontagem

      if (!snapshot.exists()) {
        setProfile(null);
        setError("not-found");
        return;
      }
      const parsed = userSchema.safeParse(snapshot.data());
      if (!parsed.success) {
        setProfile(null);
        setError("parse-error");
        return;
      }
      setProfile(parsed.data);
    } catch {
      if (active) { setProfile(null); setError("fetch-error"); }
    } finally {
      if (active) setLoading(false);
    }
  }

  return () => {
    active = false; // invalida qualquer resolveSession em voo
    unsubscribe();
  };
}, []);
```

> Nota: o mesmo token `active` resolve a ambiguidade de troca rápida de usuário (T7), tornando o comportamento determinístico: apenas o resultado do ciclo de vida atual é aplicado.

---

### WR-02: `TooltipProvider` adicionado fora do escopo da TASK-06

**Arquivo:** `src/providers/index.tsx:8,31,35`  
**Issue:** O componente `TooltipProvider` de `@/components/ui/tooltip` foi adicionado ao `Providers` sem ser pedido na spec. A seção 2 ("Fora do escopo") é explícita que nenhum provider além de `QueryProvider`, `AuthProvider` e `Toaster` deve ser adicionado nesta task — inclusive `ThemeProvider` é mencionado explicitamente como fora do escopo.

Embora `TooltipProvider` seja inofensivo tecnicamente (não quebra nada), constitui trabalho fora de escopo que não passou por spec/revisão e que pode mascarar problemas de dependência em testes de componente que não configuram o provider corretamente.

**Fix:** Remover `TooltipProvider` de `src/providers/index.tsx` e adicionar na task de UI que o requisitar (ex.: TASK-11 ou task de componentes).

```tsx
// providers/index.tsx — sem TooltipProvider
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

---

### WR-03: `npm run build` falha com cache `.next` obsoleto entre execuções consecutivas

**Arquivo:** `next.config.ts` (configuração `output: "export"`)  
**Issue:** O gate `npm run build` falha com erros de `ENOTEMPTY` / `ENOENT` em `.next/export` e `.next/build-manifest.json` quando executado sem limpar o diretório `.next` de um build anterior. O problema é específico da combinação `output: "export"` com Next.js 15.5 no Windows — o Next tenta remover `.next/export` mas o diretório já existe de um run anterior.

Execuções com diretório `.next` limpo (`rm -rf .next`) completam com sucesso. Esta condição não é introduzida pela TASK-06 (o `next.config.ts` pertence ao commit inicial e está fora do escopo desta task), mas o critério de aceite da spec (`npm run build` verde) só é satisfeito com o workaround.

**Fix:** Adicionar script `prebuild` no `package.json` para limpar o diretório `.next` antes de cada build:
```json
"scripts": {
  "prebuild": "rimraf .next",
  "build": "next build"
}
```
Ou documentar que `npm run build` requer `rm -rf .next` antes em ambiente de desenvolvimento. Esta correção deve ser aplicada na task que detém a configuração de build (TASK-01/TASK-03 ou uma task de infra de CI).

---

## Análise de Segurança

| Verificação | Resultado |
|-------------|-----------|
| Segredos hardcoded | ✓ Nenhum encontrado |
| `userSchema.safeParse` antes de confiar no doc | ✓ Implementado (linha 75) |
| Acesso ao Firestore apenas para `users/{uid}` autenticado | ✓ `nextUser.uid` validado pelo Firebase Auth |
| `firebaseAuth`/`firestore` importados do barrel `@/firebase` (nunca instanciados diretamente) | ✓ |
| `AuthContext` exportado com valor inicial `undefined` (não vaza estado padrão perigoso) | ✓ |
| `useAuth` lança se `undefined` — sem falha silenciosa | ✓ |
| Sem `eval`, `innerHTML`, `dangerouslySetInnerHTML` | ✓ |

---

## Análise de Race Conditions (AuthProvider)

### Cenário 1: Desmontagem com `getDoc` em voo
**Status:** WARNING (WR-01) — `setState` executado após unmount.  
**Gravidade efetiva:** baixa em produção (React 18 não lança), mas potencialmente problemática em Strict Mode dev.

### Cenário 2: Dois eventos de auth em rápida sucessão (T7 da spec)
**Status:** Aceito pela spec como "último vence". Sem proteção implementada.  
**Nota:** O fix de WR-01 (token `active`) também resolve este cenário tornando o comportamento determinístico.

### Cenário 3: `onAuthStateChanged` dispara múltiplas vezes com o mesmo usuário
**Status:** ✓ Não é problema — `resolveSession` é idempotente para o mesmo `uid`.

### Cenário 4: `setFirebaseUser` e `setError(null)` chamados antes do await (linhas 54-55)
**Status:** ✓ Correto — React 18 batcha múltiplos `setState` síncronos em um único re-render.

### Cenário 5: `return` dentro de `try` (not-found, parse-error) com `finally`
**Status:** ✓ Correto — `finally` executa antes do `return` propagar; `setLoading(false)` é sempre chamado.

---

## Qualidade dos Testes

| Caso obrigatório (spec seção 7.3) | Coberto |
|-----------------------------------|---------|
| `useAuth` lança fora do provider | ✓ |
| `useAuth` retorna contexto dentro do provider | ✓ |
| Estado inicial: `loading=true`, `firebaseUser=null` | ✓ |
| Não autenticado: `loading=false`, `error=null` | ✓ |
| Autenticado + perfil OK: `profile` preenchido, `status`/`role` derivados | ✓ |
| Autenticado sem doc: `error="not-found"` | ✓ |
| Parse-fail: `error="parse-error"` | ✓ |
| Erro de leitura: `error="fetch-error"` | ✓ |
| Unsubscribe ao desmontar | ✓ |
| `makeQueryClient` com `staleTime`/`gcTime` corretos | ✓ |
| Instância `QueryClient` estável entre re-renders | ✓ |

Todos os 11 casos cobertos. Mocks bem isolados (sem rede/emulador). `ContextProbe` é uma abordagem sólida para inspecionar estado via DOM sem depender de implementação interna.

---

## Conformidade com `.claude/CLAUDE.md`

| Regra | Status |
|-------|--------|
| Nunca usar `any` | ✓ |
| Nunca usar estilos inline | ✓ (Toaster via `@/components/ui/sonner` Shadcn) |
| `staleTime: 30 * 60 * 1000` / `gcTime: 24 * 60 * 60 * 1000` | ✓ |
| Componentes totalmente tipados | ✓ |
| `layout.tsx` permanece Server Component | ✓ |
| `QueryClient` via `useState` initializer (não singleton) | ✓ |

---

## Itens Positivos

- **`makeQueryClient` exportada** — decisão correta que facilita teste isolado sem montar a árvore React.
- **`useMemo` no valor do contexto** — evita re-renders desnecessários em consumidores quando estado não muda.
- **Reutilização do wrapper Shadcn `@/components/ui/sonner`** em vez de importar `Toaster` diretamente — conforme nota da spec seção 4.4.
- **Tipos `AuthProfileError` e `AuthContextValue` exportados** do barrel — facilita consumo tipado em testes e em features futuras.
- **Documentação inline** (comentários JSDoc e inline) alinhada com as decisões arquiteturais da spec.

---

_Revisado em: 2026-06-05_  
_Revisor: Claude (staff-engineer adversarial review)_  
_Profundidade: deep_
