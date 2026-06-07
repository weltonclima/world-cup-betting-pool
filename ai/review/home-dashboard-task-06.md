# Review — TASK-06 · HomeHeader (Home Dashboard)

> Revisado em: 2026-06-07
> Revisor: Staff Engineer (adversarial)
> Branch: feat/prd-01-auth
> Commits revisados: 175ccf0 (a11y: aria-hidden avatar) + 2789c69 (a11y: removed dead focus-ring)
> Arquivos em escopo:
> - `src/features/home/components/HomeHeader.tsx`
> - `src/features/home/components/__tests__/HomeHeader.test.tsx`
> - `src/features/home/components/index.ts`

---

## Veredicto: `approved with adjustments`

Nenhum BLOCKER. Um WARNING real de desvio de spec. Um WARNING de escopo no barrel.

---

## Resultados dos Checks Automatizados

| Check | Resultado |
|---|---|
| `npx vitest run …/HomeHeader.test.tsx` | PASS — 9/9 testes |
| `npx tsc --noEmit` | 0 erros |
| `mcp__ide__getDiagnostics` (HomeHeader.tsx) | 0 diagnósticos |
| `mcp__ide__getDiagnostics` (HomeHeader.test.tsx) | 0 diagnósticos |
| `mcp__ide__getDiagnostics` (index.ts) | 0 diagnósticos |

---

## Findings

### WARNING-01 — Focus ring ausente no botão do sino

**Classificação:** WARNING
**Arquivo:** `src/features/home/components/HomeHeader.tsx` — linhas 61–73
**Spec §8 (Acessibilidade):**

> "Focus ring — Herdado de Tailwind/Shadcn — garantir `focus-visible:ring-2 ring-ring` no botão"

**Spec §10 (Referência de implementação completa):**

```tsx
className={cn(
  "flex items-center justify-center size-11 rounded-full",
  "text-muted-foreground",
  "disabled:opacity-50 disabled:cursor-not-allowed",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
)}
```

**Implementação atual:**

```tsx
className={cn(
  "flex items-center justify-center size-11 rounded-full",
  "text-muted-foreground",
  "disabled:opacity-50 disabled:cursor-not-allowed",
)}
```

As classes `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` foram **removidas** (commit 2789c69 remove "dead focus-ring"). O botão está `disabled`, então focus via teclado não o atinge em navegadores modernos — daí a classificação como "dead". Porém:

1. A spec é explícita em requerer o focus ring.
2. `aria-disabled="true"` + `disabled` é a combinação usada: browsers modernos tratam `disabled` como não-focusável, mas leitores de tela via `aria-disabled="true"` podem ainda anunciá-lo como existente e navegável em alguns modos de navegação.
3. A remoção cria inconsistência de padrão: quando `disabled` for removido no futuro (MVP+), o desenvolvedor precisará lembrar de adicionar o focus ring.
4. O MASTER.md §2.1 estabelece `--ring` como token de focus — a ausência de `focus-visible:ring-ring` viola o contrato de design system para botões.

**Ação requerida:** Restaurar `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` no `className` do botão.

---

### WARNING-02 — Barrel exporta componentes fora do escopo de TASK-06

**Classificação:** WARNING
**Arquivo:** `src/features/home/components/index.ts`
**Spec §11:**

> "Criar (ou adicionar ao existente): `export { HomeHeader } from './HomeHeader'; export type { HomeHeaderProps } from './HomeHeader';`"

O barrel atual exporta 9 componentes de TASK-07 a TASK-10 além do `HomeHeader`. Isso é além do escopo desta task — porém não é um erro de implementação porque esses componentes foram criados por tasks posteriores que também adicionaram ao barrel. O tsc passa sem erro. O risco é que o barrel agrupa todas as futuras tasks em um único ponto de entrada antecipadamente, o que não segue o princípio de addição incremental por task.

Dado que as tasks posteriores já foram implementadas e o tsc valida tudo, este WARNING é de **processo** (o barrel foi ampliado além do escopo desta task), não de **qualidade de código**.

**Ação:** Nenhuma necessária nesta revisão — os exports adicionais correspondem a implementações válidas de tasks posteriores. Registrado para rastreabilidade.

---

## Conformidade com Critérios de Aceite

| # | Critério | Status |
|---|---|---|
| 1 | Renderiza sem erro com `name: null, uid: null` → `"Olá 👋"` e iniciais `"?"` | PASS (T2, T5) |
| 2 | Com `name: "Ana Lima", uid: "abc123"` → `"Olá, Ana Lima 👋"` e iniciais `"AL"` com cor determinística | PASS (T1, T4, T6) |
| 3 | Avatar usa `getInitials` e `getAvatarVariant` de `userAvatar.ts` — sem duplicação | PASS |
| 4 | Avatar usa primitive `Avatar`/`AvatarFallback` de `src/components/ui/avatar.tsx` | PASS |
| 5 | Sino é `<button disabled>` com `aria-label="Notificações (em breve)"` — não abre nada | PASS (T7) |
| 6 | Botão do sino tem `size-11` (44×44px) — WCAG 2.5.5 | PASS |
| 7 | `Bell` importado como named import com `aria-hidden="true"` | PASS |
| 8 | Nenhum `style={{}}` — toda estilização via Tailwind | PASS |
| 9 | Nenhum `any` — arquivo passa `tsc` sem erros novos | PASS |
| 10 | `HomeHeader` é bloco de conteúdo dentro de `<main>`, não substitui/duplica Header fixo | PASS |
| 11 | Export correto no barrel `index.ts` | PASS |
| 12 | Subtítulo "Bem-vindo ao bolão" visível em `text-muted-foreground` | PASS (T3) |
| 13 | `truncate` no parágrafo da saudação | PASS |
| 14 | `<section aria-label="Boas-vindas">` — região semântica identificável | PASS (T9) |

---

## UI/UX Review

### Violations por Prioridade

| Prioridade | Categoria | Violações encontradas |
|---|---|---|
| P1 — Acessibilidade | Focus ring ausente no botão `disabled` | 1 (WARNING — botão não é focusável em browsers modernos, mas viola spec e design contract) |
| P2 — Touch & Interaction | Área de toque `size-11` = 44×44px | Conforme |
| P3–P10 | Demais categorias | 0 violações |

**BLOCKER count:** 0
**WARNING count:** 1 (WARNING-01 acima)

### Top-3 Prioridades de Correção

1. **Restaurar focus ring no sino** — `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` — 3 classes, 1 linha. Previne regressão quando `disabled` for removido no futuro e mantém conformidade com o design contract.
2. *(sem segundo item de correção obrigatória)*
3. *(sem terceiro item de correção obrigatória)*

### Pontos Fortes (Confirmados)

- **Presentational puro:** zero hooks internos — testável em isolamento, conforme spec §4.2.
- **Reuso correto de helpers:** `getInitials`, `getAvatarVariant`, `AVATAR_CLASSES` importados de `userAvatar.ts` sem duplicação.
- **a11y correta do Avatar:** `aria-hidden="true"` no `AvatarFallback` evita leitura redundante das iniciais pelo leitor de tela enquanto o nome completo é anunciado pela saudação adjacente.
- **`<section aria-label="Boas-vindas">`:** não usa `<header>` nem `role="banner"` — correto para bloco de conteúdo dentro de `<main>`, conforme spec §2.
- **`aria-disabled="true"` + `disabled`:** dupla proteção para compatibilidade com AT mais antigos.
- **Bell `size={20} aria-hidden="true"`:** sem namespace glob, named import correto de `lucide-react`.
- **Zero `any`, zero inline styles:** conformidade com CLAUDE.md regras 1 e 2.
- **Teste T9** usa `getByRole("region", { name: "Boas-vindas" })` — abordagem semântica correta (não `getByLabelText` ou `querySelector`).

---

## Itens Para `/implement` Corrigir

1. **[WARNING-01]** Arquivo `src/features/home/components/HomeHeader.tsx`, no `className` do `<button>` do sino: adicionar `"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"` como linha extra no `cn(...)`.

```tsx
// De:
className={cn(
  "flex items-center justify-center size-11 rounded-full",
  "text-muted-foreground",
  "disabled:opacity-50 disabled:cursor-not-allowed",
)}

// Para:
className={cn(
  "flex items-center justify-center size-11 rounded-full",
  "text-muted-foreground",
  "disabled:opacity-50 disabled:cursor-not-allowed",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
)}
```
