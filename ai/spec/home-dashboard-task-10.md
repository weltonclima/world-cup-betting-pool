# Spec — Home Dashboard · TASK-10: Página /home: integração + estados

> Gerado em 2026-06-07 · Feature: home-dashboard · PRD: ai/prd/home-dashboard.md
> Contrato visual: ai/screen/home-dashboard-task-06.md
> Dependências: TASK-05 (useHomeDashboard), TASK-06 (HomeHeader), TASK-07 (cards de métrica), TASK-08 (cards de jogo/fase), TASK-09 (NoticesCard)

---

## 1. Objetivo

Substituir o placeholder `src/app/(app)/home/page.tsx` pela Home Dashboard real,
compondo `HomeHeader` + grade responsiva de 8 cards usando o compositor
`useHomeDashboard`. Implementar os 3 estados de tela: **loading** (skeletons por
card), **error** (página-level com retry), **success** (cards com dados reais).
Responsivo mobile-first (360–1024px+). Budget < 2s, sem layout shift.

---

## 2. Arquivos envolvidos

| Arquivo | Ação |
|---|---|
| `src/features/home/components/HomeDashboard.tsx` | **Criar** — client component principal |
| `src/app/(app)/home/page.tsx` | **Substituir** — entry point server/client mínimo |
| `src/features/home/components/index.ts` | **Atualizar** — exportar `HomeDashboard` |
| `src/features/home/components/__tests__/HomeDashboard.test.tsx` | **Criar** — testes |

---

## 3. Arquitetura da solução

```
src/app/(app)/home/page.tsx          ← Server Component (ou Client mínimo)
  └── <HomeDashboard />              ← "use client" — toda a lógica de estado
        ├── useHomeDashboard()       ← compositor TASK-05 (orquestra 7 queries)
        ├── useAuth()                ← lê profile.name + firebaseUser.uid
        └── renderização condicional:
              isError  → <ErrorState refetch={refetch} />
              isLoading → skeletons por card
              success  → <HomeHeader> + grid de cards
```

### 3.1 Decisão de design: erro em nível de página

O compositor `useHomeDashboard` expõe `isError` agregado (any query falhou) e
`refetch` agregado (refetch de todas as queries). Por isso, o estado de erro é
tratado em **nível de página** em `HomeDashboard.tsx`, não por card individual.
Esta é uma **emenda ao §5.3 do contrato visual** (screen contract): ao invés de
múltiplos botões de retry por card, há um único estado de erro de página com
"Erro ao carregar dashboard" + "Tentar Novamente".

**Justificativa:** simplifica a UX (um retry recarrega tudo), alinha ao que
`useHomeDashboard` expõe nativamente, e evita múltiplos re-renders parciais.

---

## 4. Especificação de `HomeDashboard.tsx`

### 4.1 Imports e dependências

```ts
"use client";

// Hooks
import { useAuth } from "@/hooks/useAuth";
import { useHomeDashboard } from "@/features/home/hooks/useHomeDashboard";

// Cards e skeletons (via barrel @/features/home/components)
import {
  HomeHeader,
  RankingCard, RankingCardSkeleton,
  CorrectScoresCard, CorrectScoresCardSkeleton,
  AccuracyCard, AccuracyCardSkeleton,
  NextMatchCard, NextMatchCardSkeleton,
  CurrentStageCard, CurrentStageCardSkeleton,
  LastResultsCard, LastResultsCardSkeleton,
  PerformanceCard, PerformanceCardSkeleton,
  NoticesCard, NoticesCardSkeleton,
} from "@/features/home/components";

// UI
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
```

### 4.2 Estado de erro (página-level)

```tsx
{/* Estado de erro — aria-live="polite" para anúncio ao leitor de tela */}
<div
  role="alert"
  aria-live="polite"
  className="flex flex-col items-center gap-4 py-12 px-4"
>
  <AlertCircle size={40} className="text-destructive" aria-hidden="true" />
  <p className="text-base font-semibold text-foreground text-center">
    Erro ao carregar dashboard
  </p>
  <p className="text-sm text-muted-foreground text-center">
    Não foi possível carregar os dados. Tente novamente.
  </p>
  <Button
    variant="outline"
    size="sm"
    onClick={refetch}
    className="min-h-[44px]"
  >
    Tentar Novamente
  </Button>
</div>
```

### 4.3 Estado de loading — orquestração de skeletons por card

O `useHomeDashboard` expõe `isLoading` agregado (any query em loading). Para a
página, usar `isLoading` como flag única — quando true, todos os skeletons
renderizam simultaneamente (sem granularidade por query individual, já que
`useHomeDashboard` não expõe loading por query).

```tsx
{/* HomeHeader skeleton */}
{isLoading ? (
  <div className="mb-6 flex items-center gap-3" aria-hidden="true">
    <div className="size-12 rounded-full bg-muted animate-pulse motion-reduce:animate-none shrink-0" />
    <div className="flex flex-col gap-2 flex-1">
      <div className="h-5 w-2/5 rounded bg-muted animate-pulse motion-reduce:animate-none" />
      <div className="h-4 w-1/3 rounded bg-muted animate-pulse motion-reduce:animate-none" />
    </div>
  </div>
) : (
  <HomeHeader name={profile?.name ?? null} uid={firebaseUser?.uid ?? null} />
)}

{/* Métrica 3-col */}
<div className="grid grid-cols-3 gap-3">
  {isLoading ? <RankingCardSkeleton /> : <RankingCard summary={ranking} />}
  {isLoading ? <CorrectScoresCardSkeleton /> : <CorrectScoresCard totalCorrect={performance.totalCorrect} />}
  {isLoading ? <AccuracyCardSkeleton /> : <AccuracyCard accuracy={performance.accuracy} />}
</div>

{/* Cards full-width */}
{isLoading ? <NextMatchCardSkeleton /> : <NextMatchCard nextMatch={nextMatch} />}
{isLoading ? <CurrentStageCardSkeleton /> : <CurrentStageCard currentStage={currentStage} />}
{isLoading ? <LastResultsCardSkeleton /> : <LastResultsCard results={recentResults} />}
{isLoading ? <PerformanceCardSkeleton /> : <PerformanceCard summary={performance} />}
{isLoading ? <NoticesCardSkeleton /> : <NoticesCard notices={notices} />}
```

### 4.4 Estado de sucesso

Todos os cards recebem dados via props do compositor. Cards já tratam seus
próprios empty states internamente (arrays vazios, null).

### 4.5 Leitura de uid e profile

```tsx
const { profile, firebaseUser } = useAuth();
// uid necessário para useHomeDashboard (internamente)
// profile.name para HomeHeader
```

---

## 5. Especificação de `src/app/(app)/home/page.tsx`

Server Component mínimo — apenas renderiza `<HomeDashboard />`. Sem lógica,
sem data fetching, sem wrappers adicionais (AuthGuard e AppShell já estão no
layout pai `src/app/(app)/layout.tsx`).

```tsx
import { HomeDashboard } from "@/features/home/components/HomeDashboard";

export default function HomePage() {
  return <HomeDashboard />;
}
```

> Nota: `HomeDashboard` tem `"use client"` — Next.js 15 trata isso corretamente.
> O `page.tsx` pode permanecer Server Component (sem diretiva) pois apenas importa
> um client component. Não adicionar `"use client"` no page.tsx.

---

## 6. Atualização do barrel `components/index.ts`

Adicionar ao final:

```ts
// Composição da página Home Dashboard (TASK-10)
export * from "./HomeDashboard";
```

---

## 7. Responsividade

Seguir §1 do contrato visual (ai/screen/home-dashboard-task-06.md):
- Container: `flex flex-col gap-4` (herdado do AppShell `<main>`)
- Grade de métricas: `grid grid-cols-3 gap-3` em todos os breakpoints
- Cards restantes: full-width em todos os breakpoints (MVP)
- `max-w-4xl mx-auto` centraliza em tablet/desktop (já no AppShell)

---

## 8. Acessibilidade

- `role="alert" aria-live="polite"` no container de erro
- Skeletons com `aria-hidden="true"` no div externo do header skeleton
- Skeletons de cards já têm `role="status" aria-busy="true"` (implementados nas TASKs 07–09)
- Botão "Tentar Novamente" com `min-h-[44px]` (área de toque WCAG 2.5.5)
- Ícone de erro com `aria-hidden="true"`

---

## 9. Especificação dos testes (`HomeDashboard.test.tsx`)

### 9.1 Mocks necessários

```ts
vi.mock("@/firebase", () => ({ firebaseAuth: {}, firestore: {} }));
vi.mock("@/hooks/useAuth");
vi.mock("@/features/home/hooks/useHomeDashboard");
```

### 9.2 Cenários obrigatórios

| ID | Cenário | Verificação |
|---|---|---|
| T1 | isLoading=true | Skeletons renderizados (role="status" presente); header real NÃO renderizado |
| T2 | isError=true | "Erro ao carregar dashboard" visível; botão "Tentar Novamente" presente |
| T3 | Retry chama refetch | Clicar "Tentar Novamente" chama `refetch` mockado |
| T4 | isLoading=false, isError=false | HomeHeader renderizado com nome correto |
| T5 | Sucesso com dados | Pelo menos um card de dados renderizado (ex: RankingCard) |
| T6 | Sucesso sem dados | Cards empty states (arrays vazios, nulls) sem crash |

### 9.3 Estratégia de mock

```ts
// Mock de useAuth
vi.mocked(useAuth).mockReturnValue({
  profile: { name: "Ana Lima", ... },
  firebaseUser: { uid: "uid-test" },
  ...
} as AuthContextValue);

// Mock de useHomeDashboard
vi.mocked(useHomeDashboard).mockReturnValue({
  ranking: null,
  performance: { totalCorrect: 0, accuracy: 0, gamesPredicted: null, wrong: null },
  nextMatch: null,
  recentResults: [],
  currentStage: { stage: null, roundLabel: null },
  notices: [],
  isLoading: true,  // varia por cenário
  isError: false,   // varia por cenário
  refetch: vi.fn(),
});
```

---

## 10. Restrições e regras

- TypeScript strict — sem `any`
- Sem estilos inline — apenas classes Tailwind
- Comentários em pt-BR
- Sem nova dependência de biblioteca
- Tokens semânticos win/loss (já em globals.css desde TASK-07)
- `"use client"` apenas em `HomeDashboard.tsx` — `page.tsx` fica como Server Component

---

## 11. Critérios de aceite

- [ ] `npx vitest run src/features/home` — todos os testes passam (incluindo os novos de HomeDashboard)
- [ ] `npx tsc --noEmit` — sem erros de tipo
- [ ] `npx vitest run` completo — sem regressão
- [ ] Estado loading: skeletons visíveis, sem layout shift vs estado de dados
- [ ] Estado error: mensagem de erro + botão retry funcional
- [ ] Estado sucesso: HomeHeader + 8 cards renderizados
- [ ] Responsivo: grade 3-col de métricas em 360px, cards full-width abaixo
