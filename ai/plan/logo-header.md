# PLAN — Logo no Header (pós-login)

## 1. Planning summary

Mudança cirúrgica num único componente (`Header.tsx`). Escopo trivial: trocar `<span>` de texto por `<Image>` envolto em `<Link href="/home">`, mais ajuste do teste para mock de `next/image`. Uma única task frontend cobre produção + teste. Sem dependências externas, sem persistência, sem API.

plan-checker skipped (small low-risk plan — 1 task, low risk).

## 2. Recommended execution phases

- **Phase 1 – exposure (UI)**: TASK-01 — substituir identidade textual por logo no Header.

Sem fase de foundation/regras/integração — feature é puramente visual.

## 3. Tasks

### TASK-01 – Logo no Header
- Type: application (frontend UI)
- Goal: Substituir o texto `"Bolão dos Parças"` no `Header` pelo logotipo (`next/image`), clicável → `/home`, propagando para todas as rotas autenticadas via `AppShell`.
- Scope:
  - Trocar `<span>` por `<Link href="/home" aria-label="Página inicial">` envolvendo `<Image>`.
  - Usar `public/logo-login.png` (560×373), altura ~h-8 (32px), `object-contain`, sem distorção.
  - Preservar layout: logo à esquerda, ações (sino + admin) à direita.
  - Ajustar `Header.test.tsx`: adicionar `vi.mock("next/image")`, adicionar asserção de acessibilidade do link do logo.
- Main modules/files likely involved:
  - `src/components/layout/Header.tsx` (produção)
  - `src/components/layout/__tests__/Header.test.tsx` (teste)
  - `src/components/auth/AuthLogo.tsx` (referência de padrão, não modificado)
  - `public/logo-login.png` (asset existente)
- Dependencies: nenhuma
- Story points: 1
- Criticality: low
- Technical risk: low
- Recommended TDD later: no — UI puramente visual, sem regra de negócio/condicional. Teste de acessibilidade adicionado em `/test` (não antes).
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Notes:
  - `is_frontend: true` → spec dispara `/ui-spec` + `/patterns:nextjs` + `/ui-review`.
  - Decisão de asset travada: `logo-login.png` (troféu dourado, contexto autenticado).
  - Mock de `next/image` no jsdom é obrigatório (ver `AuthLogo.test.tsx`).

## 4. Dependency map

TASK-01 — sem dependências (folha única).

## 5. Recommended execution order

1. TASK-01 – Logo no Header

## 6. Planning risks and blockers

- Nenhum blocker. Ambiguidades do PRD (asset, tamanho) resolvidas com defaults razoáveis no escopo da task.
- Único cuidado técnico: mock de `next/image` no teste jsdom — risco baixo, padrão conhecido.
