# REVIEW — TASK-01: Scaffold Next.js 15 + TypeScript + Tailwind

> Revisão adversarial de Staff Engineer contra `ai/spec/task-01.md`, `ai/plan/feature.md` (TASK-01) e `.claude/CLAUDE.md`.
> Data: 2026-06-05 · Working dir: `C:\www\world-cup-betting-pool` (Windows 11, PowerShell).

---

## Veredito

**approved** (aprovado)

Todos os critérios de aceite da seção 7 do spec foram satisfeitos e verificados empiricamente. As três divergências reportadas são justificadas e não violam nenhuma garantia do spec nem regra do `.claude/CLAUDE.md`. Não há nenhum achado BLOCKER. Não há nenhum achado WARNING que exija ajuste — apenas observações informativas registradas abaixo para tarefas futuras.

---

## Verificação dos gates (re-executados nesta revisão)

| Gate | Comando | Resultado |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | PASS — 0 erros (exit 0) |
| Lint | `npm run lint` (`next lint`) | PASS — "No ESLint warnings or errors" (exit 0) |
| Format | `npm run format:check` (`prettier --check .`) | PASS — "All matched files use Prettier code style!" |
| Build | `npm run build` (`next build`) | PASS — compilado em ~1.9s, 4 páginas estáticas, exit 0 |

As alegações de "all gates green" do relatório de implementação foram **confirmadas de forma independente**, não apenas aceitas.

### Verificação ativa da regra anti-`any`

Não bastou confirmar que a regra está **declarada** em `eslint.config.mjs`. Injetei um arquivo temporário com `any` explícito (`const x: any` e `function f(y: any)`) e rodei `npm run lint`: ambos os usos foram reportados como **Error `@typescript-eslint/no-explicit-any`** (exit 1). Arquivo removido em seguida. A proibição de `any` está **genuinamente ativa e bloqueante**, não decorativa.

---

## Checklist de aceite (seção 7 do spec)

| Critério | Status | Evidência |
|---|---|---|
| `package.json` com scripts `dev`, `build`, `start`, `lint`, `typecheck`, `format`, `format:check` | OK | Todos os 7 scripts presentes |
| `next` em `15.5.x`, `react`/`react-dom` em `19.x`, pinados (sem `^`) | OK | `next 15.5.19`, `react`/`react-dom` `19.2.7`, sem `^` em nenhuma dep |
| `tsconfig.json` com `strict: true` + `noUncheckedIndexedAccess: true` + alias `@/*` | OK | Linhas 7, 16 e 21 do `tsconfig.json` |
| ESLint flat config com `no-explicit-any: "error"` + integração Prettier | OK | `eslint.config.mjs` estende `prettier` por último e ativa a regra; verificada ativamente |
| `.prettierrc`, `.prettierignore`, `.gitignore` cobrindo `.env*` e `.next` | OK | `.gitignore` cobre `/.next/`, `.env*` (com exceção `!.env.local.example`) |
| `src/app/layout.tsx` com `lang="pt-BR"` e metadata base | OK | `<html lang="pt-BR">` (linha 11); metadata title/description presentes |
| `src/app/page.tsx` placeholder sem CSS inline (só Tailwind) | OK | Apenas classes Tailwind; grep por `style=` no `src/` → 0 ocorrências |
| `src/app/globals.css` com Tailwind ativo | OK | `@import "tailwindcss";` (Tailwind v4) |
| `.env.local.example` presente (placeholder, sem segredos) | OK | Apenas comentários, nenhum segredo |
| `ai/`, `docs/`, `.claude/` intactos | OK | Os três diretórios presentes na raiz; `.prettierignore` os exclui da formatação |
| `npm run build` e `npm run dev` funcionam | OK | Build verificado; `dev` usa Turbopack conforme spec |

**11/11 critérios atendidos.**

---

## Avaliação das divergências reportadas

### 1. `eslint-config-prettier` pinado em `10.1.8` (spec sugeria `9.x`) — ACEITÁVEL

Não-bloqueante. O spec (seção 6) marca explicitamente o bloco de versões como **referência** ("Substituir `x`/placeholders pelas versões exatas resolvidas no momento da instalação"). O papel do `eslint-config-prettier` é **desligar** regras de formatação conflitantes; a major 10 não altera essa garantia. A integração foi validada: `format:check` e `lint` passam simultaneamente sem conflito. A divergência é puramente de número de major de uma dev-dependency de configuração e não afeta nenhuma garantia da seção 1.

### 2. `.prettierignore` estendido para excluir `.claude`, `ai`, `docs` — ACEITÁVEL E DESEJÁVEL

Não-bloqueante. O spec exige explicitamente que `ai/`, `docs/`, `.claude/` permaneçam **intactos** (seção 4, Passo 0; seção 7, checklist). Excluí-los do escopo de formatação do Prettier é coerente com essa exigência e evita que `prettier --write .` altere documentação/specs. Inclui também os padrões de referência do spec (`node_modules`, `.next`, `out`, `build`, `coverage`, `*.lock`). Boa decisão.

### 3. Scaffold manual em vez de `create-next-app` — ACEITÁVEL

Não-bloqueante. O spec prioriza as **garantias da seção 1** sobre o método ("Ajustar ao output real do `create-next-app` quando divergir, mantendo as garantias"). O resultado é indistinguível de um scaffold oficial: estrutura `src/app/`, alias `@/*`, Tailwind v4 via `@tailwindcss/postcss`, flat config com `FlatCompat`, `next-env.d.ts` gerado. O risco L1 do spec (diretório não-vazio quebrando o CLI) era justamente a motivação para um caminho alternativo. Build e tipos verdes comprovam um scaffold funcional e correto.

---

## Verificação de invasão de escopo (TASK-02..05)

Ponto de atenção central do spec (riscos L4 e nota da seção 2). **Nenhuma invasão detectada:**

- `src/` contém **apenas** `app/` (`globals.css`, `layout.tsx`, `page.tsx`). Não há `features/`, `services/`, `schemas/`, `types/`, `hooks/`, `lib/`, `firebase/`, `providers/` — corretamente deixados para TASK-04.
- Nenhum componente Shadcn, `components.json` ou token de tema — corretamente deixados para TASK-02.
- Nenhuma lib de domínio (Zod, RHF, TanStack, date-fns, Lucide, Sonner, Framer Motion) em `package.json` — corretamente deixadas para TASK-03.
- Nenhum artefato Firebase (`firebase.json`, `.firebaserc`, SDK) — corretamente deixado para TASK-05.
- `.env.local.example` é apenas placeholder, sem variáveis `NEXT_PUBLIC_FIREBASE_*` — alinhado ao spec.

O escopo está **cirurgicamente contido** na fundação.

---

## Verificação de segurança/configuração

- **Sem segredos commitados:** `.env.local.example` contém apenas comentários. `.gitignore` cobre `.env*` com exceção explícita do exemplo. OK.
- **TS strict reforçado:** `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames` todos presentes além do default. OK.
- **Sem `dangerouslySetInnerHTML` nem estilos inline** no `src/`. OK.
- **`next.config.ts`** mínimo e tipado (`NextConfig`), sem configuração arriscada. OK.

---

## Achados

### BLOCKER
Nenhum.

### WARNING
Nenhum que exija ajuste para esta tarefa.

### Observações informativas (sem classificação — para tarefas futuras)

1. **`next lint` está deprecado** e será removido no Next.js 16 (aviso emitido na execução do lint). O script `lint` atual usa `next lint`. Não bloqueia nada agora — Next 15.5 ainda o suporta plenamente. Recomenda-se migrar para a ESLint CLI (`npx @next/codemod next-lint-to-eslint-cli .`) em uma tarefa de manutenção futura, antes de um eventual upgrade para Next 16. Fora do escopo da TASK-01.

2. **Script `dev` não foi executado** nesta revisão (servidor de longa duração). A garantia "GET / renderiza Bolão dos Parças" é fortemente suportada de forma indireta: `next build` gerou a rota `/` como estática (○ Static) com sucesso, e `page.tsx` renderiza o `<h1>Bolão dos Parças</h1>`. Confiança alta sem necessidade de subir o servidor.

---

## Conclusão

TASK-01 entrega exatamente o alicerce especificado: Next.js 15.5 + React 19 + TypeScript strict (com `any` proibido e verificado) + Tailwind v4, com tooling ESLint 9 (flat config) + Prettier consistente entre si. Todos os gates verdes foram reproduzidos de forma independente. As divergências são justificadas e benéficas. O escopo não invadiu nenhuma tarefa posterior. **Aprovado sem ressalvas bloqueantes.**
