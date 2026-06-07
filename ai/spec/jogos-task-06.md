# SPEC — TASK-06: Página Detalhe do Jogo (`/matches/[id]`)
> Feature: Jogos (PRD-03) · Plan: `ai/plan/jogos.md` · Branch: `feat/integracao-api-football`
> Dependências: TASK-02 (DONE), TASK-03 (DONE) · Tipo: ui · Pontos: 2 · TDD: não · Screen: sim

---

## 1. Objetivo

Criar a tela cheia de **Detalhe do Jogo** acessível em `/matches/[id]`.

A tela exibe informação completa da partida (times, bandeiras, data, hora, estádio, cidade, fase, grupo), o status do jogo e o status do palpite do usuário, além de CTAs contextuais para ações de PRD-04 (que ainda não existem — renderizados como botões disabled/placeholder).

---

## 2. Arquivos a criar / modificar

### Criar
```
src/app/(app)/matches/[id]/page.tsx                        ← Server Component (entry point de rota)
src/features/matches/components/MatchDetail.tsx            ← Client Component (composição principal)
src/features/matches/components/MatchDetailActions.tsx     ← Client Component (CTAs contextuais)
src/features/matches/components/__tests__/MatchDetail.test.tsx
src/features/matches/components/__tests__/MatchDetailActions.test.tsx
```

### NÃO modificar
```
src/features/matches/components/index.ts    ← não alterar (instrução do orchestrator)
src/features/matches/index.ts              ← não alterar
src/app/(app)/matches/page.tsx             ← TASK-04 (paralelo)
```

### Imports via path direto (não pelo barrel)
Usar `@/features/matches/components/MatchStatusBadge` etc. diretamente — não via `index.ts`.

---

## 3. Contratos e dependências

### Hook: `useMatchDetail(id: string): MatchDetailData`
Importar de `@/features/matches/hooks/useMatchDetail`.

```ts
interface MatchDetailData {
  match: MatchDetailItem | null;  // null enquanto carrega, em 404, ou uid=null
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}
```

### Tipo: `MatchDetailItem` (= `MatchListItem`)
```ts
interface MatchListItem {
  id: string;
  kickoffAt: string;
  stage: Stage;
  round: number | null | undefined;
  groupId: string | null | undefined;
  venue: MatchWithId["venue"];  // { name: string; city: string } | undefined
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: ResolvedTeam;       // { name: string; flagUrl?: string }
  awayTeam: ResolvedTeam;
  predictionStatus: MatchPredictionStatus;  // "enviado" | "pendente" | "bloqueado"
}
```

### Componentes existentes a reusar (import direto)
- `MatchStatusBadge` — `@/features/matches/components/MatchStatusBadge`
- `GameStatusBadge` — `@/features/matches/components/GameStatusBadge`
- `MatchesErrorState` — `@/features/matches/components/MatchesErrorState`

### Constantes disponíveis
- `STAGE_LABEL_MAP` em `matchLabels.ts` (se existir) ou inline map para fase → pt-BR

---

## 4. Componentes

### 4.1 `src/app/(app)/matches/[id]/page.tsx`

Server Component (sem `"use client"`). Entry point mínimo: extrai `params.id` e delega ao `<MatchDetail>`.

```tsx
// Tipo Next.js 15 — params é Promise<{ id: string }>
export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MatchDetail id={id} />;
}
```

### 4.2 `MatchDetail.tsx`

Client Component (`"use client"`). Responsável por:
1. Chamar `useMatchDetail(id)`.
2. Despachar os 3 estados: loading → skeleton; error → `<MatchesErrorState onRetry={refetch}`; match null (404) → empty state.
3. Renderizar as informações da partida + `<MatchDetailActions>`.

**Layout da tela (mobile-first, full screen):**

```
┌─────────────────────────────────────────────────────┐
│  ← Voltar                     [header de contexto]  │  ← botão back
│                                                      │
│  Fase de Grupos · Grupo C                            │  ← subtítulo contextual
│                                                      │
│    🇧🇷                X              🇫🇷              │  ← bandeiras grandes + "X"
│   Brasil                           França            │  ← nomes
│                                                      │
│  ─────────────────────────────────────────────────  │
│  Detalhes do Jogo                                    │  ← heading
│  Data: 12 de junho de 2026                           │
│  Hora: 16:00                                         │
│  Estádio: Estádio Lusail                             │
│  Cidade: Lusail, Catar                               │
│                                                      │
│  Status do Jogo                                      │  ← heading
│  [badge Agendado]                                    │
│                                                      │
│  Status do Palpite                                   │  ← heading
│  [badge Palpite Enviado]                             │
│  Seu palpite foi enviado com sucesso.                │  ← sub-mensagem opcional
│                                                      │
│  Ações                                               │  ← heading
│  [Editar Palpite / Enviar Palpite]  ← CTA primário  │
│  [Visualizar Palpite]               ← CTA secundário │
│  [Ver Informações da Partida]       ← CTA outline    │
│  [Visualizar Resultado & Estat.]    ← CTA outline    │
└─────────────────────────────────────────────────────┘
```

**Estado loading — skeleton:**
- Bloco times: 2 retângulos de bandeira + texto
- Bloco detalhes: 4 linhas de texto skeleton
- Bloco status jogo/palpite: 2 badges skeleton
- Bloco ações: 3 botões skeleton

**Estado 404 (match === null e !isLoading e !isError):**
```
Jogo não encontrado
Não foi possível encontrar este jogo.
[← Voltar para Jogos]  ← Link para /matches
```

**Estado error:**
```
<MatchesErrorState onRetry={refetch} message="Erro ao carregar detalhes do jogo" />
```

### 4.3 `MatchDetailActions.tsx`

Client Component. Recebe `predictionStatus` e `matchStatus`. Renderiza os CTAs contextuais.

**Regras de CTAs:**

| Status palpite | Status jogo | CTA principal | CTAs extras |
|---|---|---|---|
| `pendente` | `scheduled` | "Enviar Palpite" (disabled placeholder) | "Ver Informações da Partida" (disabled) |
| `enviado` | `scheduled` | "Editar Palpite" (disabled placeholder) | "Visualizar Palpite" (disabled) + "Ver Informações da Partida" (disabled) |
| `bloqueado` | `live`/`finished`/etc | "Visualizar Palpite" (disabled placeholder) | "Ver Informações da Partida" (disabled) + "Visualizar Resultado & Estatísticas" (disabled, só se finished) |

**Regras gerais:**
- Todos os botões CTA são `disabled` (PRD-04 ainda não existe).
- Botões disabled com `aria-disabled="true"` e `disabled` prop.
- Nenhum botão usa `href` (sem rotas de PRD-04 ainda).
- Variantes: primário `default`, secundário `outline`, terciário `ghost`.

```tsx
interface MatchDetailActionsProps {
  predictionStatus: MatchPredictionStatus;
  matchStatus: MatchStatus;
}
```

---

## 5. Lógica de exibição de CTAs

```ts
// Mapeia status → CTAs a exibir
function deriveActions(
  predictionStatus: MatchPredictionStatus,
  matchStatus: MatchStatus,
): ActionConfig[]

interface ActionConfig {
  label: string;
  variant: "default" | "outline" | "ghost";
  disabled: true;
  ariaLabel: string;
}
```

Lógica:
- `bloqueado + finished` → [Visualizar Palpite, Ver Informações da Partida, Visualizar Resultado & Estatísticas]
- `bloqueado + live` → [Visualizar Palpite, Ver Informações da Partida]
- `bloqueado + scheduled` → [Visualizar Palpite, Ver Informações da Partida]  ← (kickoffAt passou mas status ainda scheduled)
- `enviado + scheduled` → [Editar Palpite (default), Visualizar Palpite (outline), Ver Informações da Partida (outline)]
- `pendente + scheduled` → [Enviar Palpite (default), Ver Informações da Partida (outline)]

---

## 6. Lógica de subtítulo contextual (fase + grupo)

```ts
// Em MatchDetail — inline
function deriveSubtitle(match: MatchDetailItem): string {
  const STAGE_LABELS: Record<Stage, string> = {
    grupos: "Fase de Grupos",
    oitavas: "Oitavas de Final",
    quartas: "Quartas de Final",
    semifinal: "Semifinal",
    terceiro: "Disputa do 3º Lugar",
    final: "Final",
  };
  const stage = STAGE_LABELS[match.stage] ?? match.stage;
  return match.groupId ? `${stage} · ${match.groupId}` : stage;
}
```

---

## 7. Mensagem descritiva do palpite

| predictionStatus | Mensagem |
|---|---|
| `enviado` | "Seu palpite foi enviado com sucesso." |
| `pendente` | "Você ainda não enviou um palpite para este jogo." |
| `bloqueado` | "Os palpites para este jogo estão bloqueados." |

---

## 8. Formatação de data e hora

Usar `date-fns` + `ptBR`:
- Data: `format(new Date(kickoffAt), "d 'de' MMMM 'de' yyyy", { locale: ptBR })` → "12 de junho de 2026"
- Hora: `format(new Date(kickoffAt), "HH:mm", { locale: ptBR })` → "16:00"

---

## 9. Acessibilidade

- Botão "Voltar": `<Button variant="ghost" aria-label="Voltar para lista de jogos">`.
- Hierarquia de headings: `<h1>` para título da partida, `<h2>` para seções (Detalhes, Status do Jogo, Status do Palpite, Ações).
- CTAs desabilitados: `disabled` prop + `aria-disabled="true"`.
- Bandeiras: `<img alt={team.name}>`.
- Fallback de bandeira: `aria-label={team.name}` no span.
- `<main>` não é responsabilidade deste componente (AppShell já define).

---

## 10. Responsividade

- Mobile: layout em coluna, bandeiras grandes (`w-16 h-12` ou maior), padding `px-4`.
- Desktop (`md+`): bandeiras ainda maiores, seções lado a lado opcionais, `max-w-2xl mx-auto`.

---

## 11. TypeScript

- Sem `any`. Props tipadas com interfaces explícitas.
- Usar tipos de `@/features/matches/hooks/useMatchDetail` (`MatchDetailItem`, `MatchDetailData`).
- Usar tipos de `@/types` (`Stage`, `MatchStatus`).
- Usar `MatchPredictionStatus` de `@/features/matches/lib/matchesHelpers`.

---

## 12. Testes co-localizados

### `MatchDetail.test.tsx`
- Renderiza skeleton quando `isLoading=true`.
- Renderiza `MatchesErrorState` quando `isError=true`.
- Renderiza empty state com link "Voltar para Jogos" quando `match=null` e não loading/error.
- Renderiza info da partida quando `match` está presente.

### `MatchDetailActions.test.tsx`
- `pendente + scheduled` → exibe "Enviar Palpite" e "Ver Informações da Partida" (disabled).
- `enviado + scheduled` → exibe "Editar Palpite", "Visualizar Palpite" e "Ver Informações da Partida" (disabled).
- `bloqueado + finished` → exibe "Visualizar Palpite", "Ver Informações da Partida" e "Visualizar Resultado & Estatísticas" (disabled).
- Todos os botões têm `aria-disabled="true"`.

---

## 13. Desvios do PRD e decisões tomadas

| # | Decisão |
|---|---|
| D1 | CTAs todos disabled (PRD-04 inexistente) — sem `href` para rotas inexistentes |
| D2 | Import direto de componentes (sem barrel index.ts) — conforme instrução do orchestrator |
| D3 | Subtítulo "Fase de Grupos · Grupo C" inline (sem helper externo) |
| D4 | Mensagem descritiva por predictionStatus → UX mais informativa que apenas o badge |
| D5 | "Visualizar Resultado & Estatísticas" aparece apenas para `finished` (sem resultado para exibir em live) |
