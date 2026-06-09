# SPEC — TASK-09: CTA contextual + bloco "Meu Palpite" no detalhe do jogo

> PRD: `ai/prd/palpites.md` | Plano: `ai/plan/palpites.md` | Branch: `feat/integracao-api-football`
> Tipo: ui | SP: 2 | Criticidade: medium | Risco técnico: low
> TDD recomendado: no. Screen: yes — `ai/screen/palpites-task-09.md`.
> Depende de: TASK-06 (hooks de mutação + usePredictions), TASK-07 (rota /matches/[id]/predict existe)

---

## 1. Objetivo

Ligar o detalhe de jogo (PRD-03, já existente) ao fluxo de palpite (PRD-04):

1. **CTA contextual** em `MatchDetailActions.tsx` — 3 estados funcionais (hoje todos `disabled`):
   - **Enviar Palpite** (sem palpite + não-travado) → navega para `/matches/[id]/predict`.
   - **Editar Palpite** (com palpite + não-travado) → navega para `/matches/[id]/predict`.
   - **Palpite bloqueado** (travado, qualquer status de lock) → sem ação, read-only.
2. **Bloco "Meu Palpite"** em `MatchDetail.tsx` — exibe o placar palpitado (`homeScore × awayScore`) quando o usuário tem palpite para este jogo.

Esta tarefa é puro _wiring_ de estado + navegação em tela existente. Não duplica lógica de lock (reusa `isPredictionLocked` de `@/features/predictions/lib`). Não cria novos hooks — usa `usePredictions` (TASK-06) e `useMatchDetail` (PRD-03), que já estão disponíveis.

---

## 2. Investigação: estado atual dos arquivos

### 2.1 `MatchDetailActions.tsx` — estado PRD-03 (hoje)

**Arquivo:** `src/features/matches/components/MatchDetailActions.tsx`

**Linhas-chave:**

- **L1-11 (comentário):** documenta que todos os botões são `disabled` e que o link para PRD-04 ainda não existe.
- **L29-32 (props):** recebe apenas `predictionStatus: MatchPredictionStatus` + `matchStatus: MatchStatus`. Não recebe `matchId` nem `prediction` (palpite completo).
- **L45-130 (`deriveActions`):** retorna `ActionConfig[]` — estrutura com `label`, `ariaLabel`, `variant`, `icon`. Sem `href` (botões são `disabled`).
- **L142-165 (componente):** mapeia actions para `<Button disabled aria-disabled="true">`. **Nenhum botão tem `href` ou handler funcional.**

**O que TASK-09 muda:**
- Adicionar `matchId: string` e `prediction: Prediction | undefined` às props.
- Substituir `<Button disabled>` por `<Link>` (Next.js) ou `<Button asChild><Link>` para os CTAs Enviar/Editar.
- Deixar o estado "bloqueado" como botão desabilitado real (com cadeado).
- Remover as ações placeholder que não fazem parte do escopo PRD-04 (ver §3.2 abaixo).
- Adicionar `matchId` ao href de navegação.

### 2.2 `MatchDetail.tsx` — estado PRD-03 (hoje)

**Arquivo:** `src/features/matches/components/MatchDetail.tsx`

**Linhas-chave:**

- **L272 (`useMatchDetail`):** orquestra match + teams + predictions internamente. `useMatchDetail(id)` já chama `usePredictions(uid)` e expõe `match.predictionStatus`.
- **L318 (`predictionMessage`):** deriva mensagem textual de `match.predictionStatus` (ex.: "Você ainda não enviou um palpite para este jogo."). Esta mensagem permanece.
- **L398-428 (card de status + ações):** seção que contém `MatchStatusBadge`, `MatchStatusBadge`, `MatchDetailActions`. **Bloco "Meu Palpite" não existe ainda.**
- **L422-425 (`<MatchDetailActions>`):** chamado com apenas `predictionStatus` e `matchStatus`. Precisa receber também `matchId` e o palpite do usuário.

**O que TASK-09 muda:**
- Extrair o palpite do usuário (`usePredictions`) para passar a `MatchDetailActions` e ao bloco "Meu Palpite".
- Adicionar bloco "Meu Palpite" no card de status, antes ou após as ações (ver §4.3).
- Passar `matchId={id}` e `prediction={existingPrediction}` para `<MatchDetailActions>`.

### 2.3 `useMatchDetail` — o que expõe

**`src/features/matches/hooks/useMatchDetail.ts` (L50-109):**

O hook não expõe o array de palpites diretamente — só deriva `predictionStatus` (string). Para acessar o palpite completo (homeScore + awayScore), `MatchDetail.tsx` precisa chamar `usePredictions(uid)` e filtrar por `matchId`. O `uid` já vem de `useAuth()`, que `useMatchDetail` usa internamente — mas `MatchDetail.tsx` não tem acesso direto a esse dado.

**Decisão:** Chamar `useAuth()` em `MatchDetail.tsx` para obter `uid`, depois chamar `usePredictions(uid)` para filtrar o palpite. Isso evita alterar a interface de `useMatchDetail` e reutiliza o mesmo query key (`predictionsKeys.all()`), que já está em cache (sem request extra).

Alternativamente, extrair `uid` + `usePredictions` direto no componente — abordagem mais simples e sem modificar `useMatchDetail`.

### 2.4 `isPredictionLocked` — importação

**`src/features/predictions/lib/predictionsHelpers.ts` (L64-68):**

```ts
export function isPredictionLocked(match: MatchWithId, now: Date): boolean
```

Reexportado pelo barrel `@/features/predictions/lib`. `MatchDetail.tsx` importa de `@/features/predictions/lib`.

**Nota importante:** `MatchDetailItem` é um alias de `MatchListItem`, não de `MatchWithId`. Verificar compatibilidade de tipo. `MatchListItem` inclui `kickoffAt` e `status` — os dois campos que `isPredictionLocked` usa. Porém `isPredictionLocked` exige `MatchWithId`. A solução é fazer cast com `as MatchWithId` (os campos necessários existem) ou passar os campos individualmente ao extrair uma função local. **Preferir cast tipado** (`match as MatchWithId`) pois o shape é compatível — apenas o tipo nominal difere.

### 2.5 Testes existentes que serão afetados

**`src/features/matches/components/__tests__/MatchDetailActions.test.tsx`:**
- T3, T4, T8, T12: verificam `aria-disabled=true` e `disabled` em todos os botões. Esses testes falharão quando os CTAs Enviar/Editar virarem links habilitados. **Os testes precisam ser atualizados** para verificar o comportamento correto (links navegáveis vs botão desabilitado).
- T1: verifica texto "Enviar Palpite" — continua válido.
- T5: verifica texto "Editar Palpite" — continua válido.

**`src/features/matches/components/__tests__/MatchDetail.test.tsx`:**
- T11: verifica heading "Ações" — continua válido.
- Os testes não verificam o bloco "Meu Palpite" (não existia). Novos testes serão adicionados.

---

## 3. Escopo

### 3.1 Dentro do escopo

- `src/features/matches/components/MatchDetailActions.tsx` — substituir botões disabled por CTAs funcionais; adicionar bloco "Meu Palpite".
- `src/features/matches/components/MatchDetail.tsx` — adicionar `useAuth`/`usePredictions`, bloco "Meu Palpite" no card de status/ações, passar `matchId` e `prediction` para `<MatchDetailActions>`.
- `src/features/matches/components/__tests__/MatchDetailActions.test.tsx` — atualizar testes T3/T4/T8/T12 (CTAs agora são links habilitados); adicionar testes para novos estados.
- `src/features/matches/components/__tests__/MatchDetail.test.tsx` — adicionar testes para bloco "Meu Palpite".

### 3.2 Fora do escopo

- Botões "Ver Informações da Partida", "Visualizar Resultado & Estatísticas" — placeholder de PRDs futuros. **Manter desabilitados** (não fazem parte do PRD-04).
- Botão "Visualizar Palpite" (separado dos CTAs de create/edit) — já coberto pelo bloco "Meu Palpite" inline; manter como disabled/placeholder ou remover conforme decisão de design (ver §4.2).
- `useUpsertPrediction`, `usePredictions`, `isPredictionLocked` — não modificar.
- Route Handler `/api/predictions` — não tocar.
- Criação de novos hooks ou serviços.

---

## 4. Implementação detalhada

### 4.1 `MatchDetailActions.tsx` — nova interface e implementação

#### Novas props

```ts
export interface MatchDetailActionsProps {
  predictionStatus: MatchPredictionStatus;
  matchStatus: MatchStatus;
  matchId: string;                  // NOVO — para montar href de navegação
  prediction: Prediction | undefined; // NOVO — palpite atual (undefined se não existe)
}
```

#### Lógica de CTAs por estado

| Estado | Condição | CTA primário | Comportamento |
|---|---|---|---|
| Enviar Palpite | `predictionStatus === "pendente"` e não-travado | Link primário | `href="/matches/${matchId}/predict"` |
| Editar Palpite | `predictionStatus === "enviado"` e não-travado | Link primário | `href="/matches/${matchId}/predict"` |
| Bloqueado | `predictionStatus === "bloqueado"` OU match não-scheduled | Botão desabilitado | `disabled + aria-disabled` + ícone Lock |

**Nota sobre lock:** O lock é derivado de `matchStatus` e `predictionStatus` (via `useMatchDetail`, que já calculou). Não é necessário chamar `isPredictionLocked` diretamente em `MatchDetailActions` — o `predictionStatus === "bloqueado"` ou `matchStatus !== "scheduled"` são suficientes para determinar o estado travado neste componente.

#### Implementação simplificada

```tsx
"use client";

import { Lock, Pencil, Send } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { MatchPredictionStatus } from "@/features/matches/lib/matchesHelpers";
import type { Prediction } from "@/types";
import type { MatchStatus } from "@/types";

export interface MatchDetailActionsProps {
  predictionStatus: MatchPredictionStatus;
  matchStatus: MatchStatus;
  matchId: string;
  prediction: Prediction | undefined;
}

export function MatchDetailActions({
  predictionStatus,
  matchStatus,
  matchId,
}: MatchDetailActionsProps) {
  const isLocked =
    matchStatus !== "scheduled" || predictionStatus === "bloqueado";

  const predictHref = `/matches/${matchId}/predict`;

  // Estado bloqueado — botão desabilitado
  if (isLocked) {
    return (
      <div className="flex flex-col gap-3">
        <Button
          variant="outline"
          disabled
          aria-disabled="true"
          aria-label="Palpite bloqueado — prazo encerrado"
          className="w-full min-h-[44px] justify-start gap-2"
        >
          <Lock size={16} aria-hidden="true" />
          Palpite bloqueado
        </Button>
      </div>
    );
  }

  // Com palpite — Editar
  if (predictionStatus === "enviado") {
    return (
      <div className="flex flex-col gap-3">
        <Button
          variant="default"
          asChild
          className="w-full min-h-[44px] justify-start gap-2"
        >
          <Link href={predictHref} aria-label="Editar palpite para este jogo">
            <Pencil size={16} aria-hidden="true" />
            Editar Palpite
          </Link>
        </Button>
      </div>
    );
  }

  // Sem palpite — Enviar
  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="default"
        asChild
        className="w-full min-h-[44px] justify-start gap-2"
      >
        <Link href={predictHref} aria-label="Enviar palpite para este jogo">
          <Send size={16} aria-hidden="true" />
          Enviar Palpite
        </Link>
      </Button>
    </div>
  );
}
```

**Decisões:**
- `Button asChild` com `<Link>` — padrão Shadcn para botões que navegam; preserva estilo do Button com semântica de link.
- Botão bloqueado: `disabled + aria-disabled="true"` — comunica estado para tecnologia assistiva; ícone `Lock` reforça visualmente.
- Remover botões placeholder "Ver Informações", "Visualizar Resultado" do escopo TASK-09 — são PRDs futuros e não devem poluir o CTA principal. Se necessário mantê-los, ficam abaixo como `outline disabled`.
- Sem `href` no estado bloqueado — sem navegação possível.

### 4.2 Decisão sobre botões secundários existentes

Os botões "Ver Informações da Partida", "Visualizar Palpite" e "Visualizar Resultado & Estatísticas" existem no PRD-03 como placeholders. No PRD-04, o bloco "Meu Palpite" substitui a função de "Visualizar Palpite" inline. As outras ações são futuras (PRDs de estatísticas).

**Decisão:** Simplificar `MatchDetailActions` para mostrar apenas o CTA principal de palpite (Enviar / Editar / Bloqueado). Ações secundárias futuras serão re-adicionadas quando os PRDs correspondentes forem implementados. Esta simplificação reduz ruído e melhora o foco no CTA de palpite.

### 4.3 `MatchDetail.tsx` — adições

#### A. Imports adicionais (topo do arquivo)

```tsx
import { useAuth } from "@/hooks/useAuth";
import { usePredictions } from "@/features/predictions/hooks";
import { isPredictionLocked } from "@/features/predictions/lib";
import type { MatchWithId } from "@/types";
```

#### B. No corpo do componente `MatchDetail` (após `useMatchDetail`)

```tsx
export function MatchDetail({ id }: MatchDetailProps) {
  const { match, isLoading, isError, refetch } = useMatchDetail(id);

  // NOVO: uid + palpite do usuário para o bloco "Meu Palpite"
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;
  const { data: predictions } = usePredictions(uid);
  const existingPrediction = predictions?.find((p) => p.matchId === id);

  // ... (estados loading/error/404 inalterados)
```

**Nota:** `usePredictions(uid)` usa o mesmo query key `predictionsKeys.all()` que já está em cache (via `useMatchDetail` → `usePredictions` interno). Não há request duplo — TanStack Query deduplica.

#### C. Bloco "Meu Palpite" — inserido no card de status

Inserir **antes** da seção "Ações", após o bloco "Status do Palpite":

```tsx
{/* Meu Palpite (quando existe palpite para este jogo) */}
{existingPrediction && (
  <>
    <div className="border-t border-border" />
    <div className="flex flex-col gap-2">
      <SectionHeading>Meu Palpite</SectionHeading>
      <div
        className="flex items-center justify-center gap-4 py-2"
        aria-label={`Seu palpite: ${match.homeTeam.name} ${existingPrediction.homeScore} a ${existingPrediction.awayScore} ${match.awayTeam.name}`}
      >
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-muted-foreground">{match.homeTeam.name}</span>
          <span className="text-3xl font-bold text-foreground">
            {existingPrediction.homeScore}
          </span>
        </div>
        <span
          className="text-xl font-bold text-muted-foreground"
          aria-hidden="true"
        >
          ×
        </span>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-muted-foreground">{match.awayTeam.name}</span>
          <span className="text-3xl font-bold text-foreground">
            {existingPrediction.awayScore}
          </span>
        </div>
      </div>
    </div>
  </>
)}
```

#### D. Atualização de `<MatchDetailActions>`

```tsx
<MatchDetailActions
  predictionStatus={match.predictionStatus}
  matchStatus={match.status}
  matchId={id}                        {/* NOVO */}
  prediction={existingPrediction}     {/* NOVO */}
/>
```

### 4.4 Ordem das seções no card de status/ações (após TASK-09)

```
card de status
├── Status do Jogo    (GameStatusBadge)
├── [divider]
├── Status do Palpite (MatchStatusBadge + mensagem)
├── [divider]
├── Meu Palpite       (bloco novo — só se existingPrediction definido)
│   └── homeScore × awayScore com nomes dos times
├── [divider]
└── Ações             (MatchDetailActions — CTA funcional)
```

---

## 5. Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/features/matches/components/MatchDetailActions.tsx` | **Modificar** — novas props `matchId`/`prediction`; CTAs funcionais via `Link`; lógica de lock simplificada |
| `src/features/matches/components/MatchDetail.tsx` | **Modificar** — adicionar `useAuth`/`usePredictions`; bloco "Meu Palpite"; atualizar call de `<MatchDetailActions>` |
| `src/features/matches/components/__tests__/MatchDetailActions.test.tsx` | **Modificar** — atualizar T3/T4/T8/T12; adicionar testes de navegação e estado bloqueado com cadeado |
| `src/features/matches/components/__tests__/MatchDetail.test.tsx` | **Modificar** — adicionar testes do bloco "Meu Palpite" |

---

## 6. Contrato de imports

### `MatchDetailActions.tsx`
```ts
"use client";
import { Lock, Pencil, Send } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { MatchPredictionStatus } from "@/features/matches/lib/matchesHelpers";
import type { Prediction, MatchStatus } from "@/types";
```

### `MatchDetail.tsx` (adições)
```ts
import { useAuth } from "@/hooks/useAuth";
import { usePredictions } from "@/features/predictions/hooks";
// isPredictionLocked NÃO é necessário em MatchDetail.tsx — a derivação já está
// em useMatchDetail (via deriveMatchPredictionStatus) e em MatchDetailActions.tsx.
```

**Proibições:**
- Sem `import ... from "@/firebase/admin"` — arquivos client.
- Sem estilos inline `style={{}}`.
- Sem `any`.
- Sem valores hexadecimais.

---

## 7. Atualização de testes

### `MatchDetailActions.test.tsx` — mudanças necessárias

**Props de fixture agora exigem `matchId` e `prediction`:**

```tsx
// Helper de render
const renderActions = (
  predictionStatus: MatchPredictionStatus,
  matchStatus: MatchStatus,
  matchId = "match-001",
  prediction?: Prediction,
) =>
  render(
    <MatchDetailActions
      predictionStatus={predictionStatus}
      matchStatus={matchStatus}
      matchId={matchId}
      prediction={prediction}
    />,
  );
```

**Testes a atualizar:**

- **T3, T4** (pendente+scheduled): remover verificação de `disabled`/`aria-disabled` no botão "Enviar Palpite" — agora é `<Link>` habilitado. Verificar `href="/matches/match-001/predict"`.
- **T8** (enviado+scheduled): remover `aria-disabled` do botão primário "Editar Palpite" — agora é `<Link>`. Verificar `href`.
- **T12** (bloqueado+finished): verificar que o botão de lock está `disabled` e exibe ícone Lock (texto "Palpite bloqueado").

**Novos testes:**

```
T-NOVO-1: pendente+scheduled → link "Enviar Palpite" com href correto
T-NOVO-2: enviado+scheduled  → link "Editar Palpite" com href correto
T-NOVO-3: bloqueado+finished → botão "Palpite bloqueado" com disabled=true
T-NOVO-4: live (qualquer status de palpite) → botão "Palpite bloqueado" disabled
T-NOVO-5: finished + enviado → botão "Palpite bloqueado" disabled
```

### `MatchDetail.test.tsx` — adições

```
T-NOVO-A: bloco "Meu Palpite" aparece quando existingPrediction definido
T-NOVO-B: placar palpitado exibido corretamente (homeScore × awayScore)
T-NOVO-C: bloco "Meu Palpite" NÃO aparece quando prediction undefined
```

Para os novos testes em `MatchDetail.test.tsx`, adicionar mock de `useAuth` + `usePredictions` no topo do arquivo (já existe mock de `useAuth`). Adicionar mock de `@/features/predictions/hooks`:

```ts
vi.mock("@/features/predictions/hooks", () => ({
  usePredictions: vi.fn(() => ({ data: [], isLoading: false, isError: false })),
}));
```

---

## 8. Estados e fluxo do CTA

```
MatchDetail carrega (useMatchDetail + usePredictions)
  └── match.status = "scheduled" + predictionStatus = "pendente"
        └── CTA: [Enviar Palpite] → Link /matches/[id]/predict (habilitado)
  └── match.status = "scheduled" + predictionStatus = "enviado"
        └── CTA: [Editar Palpite] → Link /matches/[id]/predict (habilitado)
        └── Bloco "Meu Palpite": homeScore × awayScore
  └── match.status != "scheduled" OU predictionStatus = "bloqueado"
        └── CTA: [Palpite bloqueado] (disabled, Lock icon)
        └── Bloco "Meu Palpite": exibe se prediction existe
```

---

## 9. Acessibilidade — checklist (nível standard)

| Requisito | Implementação |
|---|---|
| CTA "Enviar/Editar Palpite" toque ≥ 44px | `min-h-[44px]` no Button |
| Estado bloqueado comunicado não só por cor | Texto "Palpite bloqueado" + ícone Lock + `disabled` |
| Estado bloqueado para screen reader | `disabled` + `aria-disabled="true"` + `aria-label` descritivo |
| Links com label claro | `aria-label="Enviar palpite para este jogo"` / `"Editar palpite para este jogo"` |
| Bloco "Meu Palpite" acessível | `aria-label` no container com score em texto (ex.: "Seu palpite: Brasil 2 a 1 França") |
| Ícones decorativos | `aria-hidden="true"` em Send, Pencil, Lock |
| Focus ring | Herdado do `Button` Shadcn (`focus-visible:ring-2 focus-visible:ring-ring`) |
| Sem `tabIndex` positivo | — |

---

## 10. Critérios de aceitação

- [ ] `MatchDetailActions` recebe `matchId` e `prediction` sem erro TypeScript.
- [ ] Estado "pendente + scheduled": renderiza link "Enviar Palpite" com `href="/matches/${matchId}/predict"` habilitado.
- [ ] Estado "enviado + scheduled": renderiza link "Editar Palpite" com `href="/matches/${matchId}/predict"` habilitado.
- [ ] Estado "bloqueado" (qualquer matchStatus não-scheduled): renderiza botão `disabled` com ícone Lock e texto "Palpite bloqueado".
- [ ] Estado "finished" (qualquer predictionStatus): renderiza botão `disabled` com ícone Lock.
- [ ] Bloco "Meu Palpite" aparece em `MatchDetail` quando `existingPrediction` definido.
- [ ] Bloco "Meu Palpite" exibe `homeScore × awayScore` com nomes dos times.
- [ ] Bloco "Meu Palpite" NÃO aparece quando sem palpite.
- [ ] `<MatchDetailActions>` recebe `matchId={id}` e `prediction={existingPrediction}`.
- [ ] Sem regressão nos testes existentes de `MatchDetail.test.tsx` (T1–T17).
- [ ] Testes de `MatchDetailActions.test.tsx` atualizados — sem falsos positivos de `disabled`.
- [ ] `rtk tsc` sem erros após implementação.
- [ ] Sem `any`, sem estilos inline, sem valores hex.

---

## 11. O que esta tarefa NÃO faz

- Não cria `useUpsertPrediction` nem `usePredictions` — TASK-06.
- Não cria a rota `/matches/[id]/predict` — TASK-07.
- Não cria a lista de palpites `/predictions` — TASK-08.
- Não modifica `useMatchDetail` — compositor existente (PRD-03).
- Não altera Security Rules — TASK-05.
- Não adiciona testes automáticos além dos listados — `/test` separado.
- Não exibe pontuação "3/1/0" — removido por decisão A6 do PRD.
