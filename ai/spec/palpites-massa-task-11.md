# SPEC — TASK-11 · Tela Resumo dos 12 Grupos (PRD03-05)

> Feature: `palpites-massa` · Plan: `ai/plan/palpites-massa.md` (TASK-11) · PRD: `ai/prd/palpites-massa.md` (§6.1)
> Design contract: `design-system/MASTER.md` (+ `ai/screen/palpites-massa-task-06.md` para tema `.palpites-theme`)
> Wireframe: `docs/prd-03-1/PRD03-05-Resumo-12-Grupos.png`
> Gerado: 2026-06-07

---

## 1. Objetivo

Visão consolidada (somente leitura) dos 12 grupos (A–L) antes da etapa de melhores terceiros. Para cada grupo, exibe o 1º e o 2º colocados **previstos** (classificados diretos) e marca o 3º como **candidato a melhor terceiro**. Mostra ✓ por grupo concluído. CTA "Continuar" (rótulo do wireframe: "Ver Melhores Terceiros") fica **desabilitado** enquanto houver qualquer grupo incompleto.

Esta tela é **visual e não pontuada** (decisão A2 do PRD). Nada é persistido aqui — a classificação é derivada client-side dos placares previstos do grupo via `computeGroupStandings` (TASK-02).

## 2. Escopo

### Inclui
- Rota `(app)/predictions/resumo-grupos/page.tsx` (Client Component) — data-fetching + derivação + tema.
- Componente apresentacional `GroupsSummary.tsx` (props-driven; sem hooks de dados).
- Helper puro `groupsSummaryData.ts` → `buildGroupsSummary(...)` que deriva a lista de 12 grupos resumidos a partir de `matches`, `predictions` e mapa de times.
- Estados: loading, error (com retry), empty (sem dados de grupos).
- CTA "Ver Melhores Terceiros" → `/predictions/melhores-terceiros` (etapa TASK-12), desabilitado enquanto incompleto.

### Não inclui
- Persistência (A2/A3 — nada gravado).
- Ajuste manual de desempate (A7).
- Cálculo de melhores terceiros (é a próxima etapa, TASK-12).
- Edição da tabela completa 1º–4º (é a TASK-10 — aqui só o resumo 1º/2º/3º-candidato).
- Edição do barrel `src/features/predictions/components/index.ts` (orquestrador adiciona pós-merge).

## 3. Contrato de dados

### Entrada (page → helper)
- `matches: MatchWithId[]` (de `useMatches`) — filtra `stage === "grupos"` e agrupa por `groupId`.
- `predictions: Prediction[]` (de `usePredictions(uid)`).
- `teams: TeamWithId[]` (de `useTeams`) — mapa `id → { name, flagUrl, code }` para exibir nome/bandeira.

### Saída do helper (`buildGroupsSummary`)
```ts
interface GroupSummaryTeam {
  teamId: string;
  name: string;          // resolvido via teamMap; fallback = teamId
  flagUrl?: string;
  position: number;      // 1 | 2 | 3
}
interface GroupSummaryItem {
  groupId: string;       // "A".."L" (normalizado, sem prefixo "Group/Grupo")
  label: string;         // "Grupo A"
  first?: GroupSummaryTeam;   // 1º previsto (undefined se incompleto)
  second?: GroupSummaryTeam;  // 2º previsto
  third?: GroupSummaryTeam;   // 3º previsto (candidato a melhor terceiro)
  filled: number;        // jogos com palpite no grupo
  total: number;         // total de jogos do grupo (esperado 6)
  isComplete: boolean;   // filled === total && total > 0
}
interface GroupsSummaryData {
  groups: GroupSummaryItem[];   // ordenado por groupId asc (A→L)
  allComplete: boolean;         // todos os grupos completos (e há ao menos 1)
  completeCount: number;        // nº de grupos concluídos
}
```

### Regras de derivação
- **Agrupamento:** `matches` com `stage === "grupos"` e `groupId` não nulo são agrupados por `groupId` normalizado (`normalizeGroupId`: remove prefixo "Group "/"Grupo ", trim, uppercase → "A").
- **Classificação por grupo:** `computeGroupStandings(groupMatches, predictions)` (TASK-02) → posições 1–4. Extrai positions 1, 2, 3.
- **Completo:** `filled === total` e `total > 0`. `filled` = nº de matches do grupo com prediction correspondente (por `match.id`).
- **1º/2º/3º só aparecem quando o grupo está completo** — antes disso a classificação prevista é parcial/instável; o resumo mostra apenas o progresso ("X / Y") e estado "em andamento". (Mantém a tela honesta: só consolida quando há os 6 placares.)
- **Ordenação dos grupos:** alfabética por `groupId` (A→L). Grupos sem nenhum match são omitidos (não deveria ocorrer com dados completos).

## 4. Estados de UI

| Estado | Condição | Render |
|---|---|---|
| Loading | `uid === null \|\| matches.isLoading \|\| predictions.isLoading \|\| teams.isLoading` | Skeleton `role="status"` "Carregando resumo dos grupos" |
| Error | `matches.isError \|\| predictions.isError \|\| teams.isError` | Mensagem "Erro ao carregar o resumo dos grupos" + botão "Tentar novamente" → refetch |
| Empty | sucesso e `groups.length === 0` | "Nenhum grupo encontrado" + subtítulo orientando |
| Sucesso | há grupos | Lista de 12 cards de grupo + CTA |

CTA "Ver Melhores Terceiros": `disabled` quando `!allComplete`; quando desabilitado, exibe texto auxiliar "Conclua todos os 12 grupos para continuar" e contagem "X / 12 grupos concluídos".

## 5. Acessibilidade (nível standard, MASTER §10)
- Container raiz da rota com classe `.palpites-theme` (shell verde — MASTER §2.4-palpites).
- Lista semântica: `<ul>`/`<li>` por grupo; cada grupo é uma `<section>` com `aria-label="Grupo A"`.
- Linhas de classificado com posição textual ("1º", "2º", "3º") — status nunca só por cor. ✓ de grupo concluído = ícone `CheckCircle2` + `aria-label="Concluído"` (cor `text-win` é reforço, não única pista).
- 3º marcado com rótulo textual "candidato a melhor terceiro" (badge com texto), não só cor.
- CTA desabilitado: `disabled` real + `aria-disabled`; mensagem auxiliar associada via texto visível.
- Skeleton/empty/error com `role="status"`; botão retry com nome acessível.
- Bandeiras: `<img alt="">` decorativo (nome textual ao lado é a informação); nomes sempre visíveis.
- Touch targets ≥ 44px no CTA e botão retry.

## 6. Tokens / estilo (sem hex, sem style inline exceto geométrico)
- Cards: `rounded-xl border border-border bg-card shadow-sm p-4`.
- Título de grupo: `text-sm font-semibold text-foreground`.
- Posição/labels: `text-xs text-muted-foreground` / `text-sm`.
- ✓ concluído: `CheckCircle2 text-win` (token esportivo; depende de `--color-win` em globals.css — já presente conforme screen-06).
- Badge "candidato": `bg-secondary text-secondary-foreground` (neutro) com texto.
- CTA: `bg-primary text-primary-foreground` (verde herdado de `.palpites-theme`).
- Barra de progresso por grupo (quando incompleto): trilho `bg-muted`, preenchimento `bg-primary`; largura % é o **único** `style` (geométrico) permitido — alinhado à exceção documentada em screen-06.

## 7. Critérios de aceite
1. Lista os 12 grupos A–L ordenados, cada um com rótulo "Grupo X".
2. Grupo completo exibe 1º, 2º (classificados) e 3º (marcado como candidato a melhor terceiro) com nome do time + ✓.
3. Grupo incompleto exibe progresso "X / 6" e estado "em andamento" (sem classificados).
4. CTA "Ver Melhores Terceiros" desabilitado enquanto houver grupo incompleto; habilitado e navegável (`/predictions/melhores-terceiros`) quando todos completos.
5. Loading, error (com retry) e empty cobertos.
6. Sem persistência; derivação 100% client-side via `computeGroupStandings`.
7. TS strict (sem `any`), Tailwind por token (sem hex), Lucide named, `next/link`, mobile-first, WCAG AA.
8. Não edita `components/index.ts`; `page.tsx` importa `GroupsSummary` pelo caminho do arquivo.

## 8. Arquivos
- `src/app/(app)/predictions/resumo-grupos/page.tsx`
- `src/features/predictions/components/GroupsSummary.tsx`
- `src/features/predictions/components/groupsSummaryData.ts` (helper puro)
- `src/features/predictions/components/__tests__/GroupsSummary.test.tsx`
- `ai/spec/palpites-massa-task-11.md` (este) · `ai/screen/palpites-massa-task-11.md`
