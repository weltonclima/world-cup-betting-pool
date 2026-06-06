# REVIEW — TASK-03: Instalar e configurar libs obrigatórias

> Revisão adversarial de Staff Engineer contra `ai/spec/task-03.md`, `ai/plan/feature.md` (TASK-03) e `.claude/CLAUDE.md`.
> Data: 2026-06-05 · Working dir: `C:\www\world-cup-betting-pool` (Windows 11, PowerShell).

---

## Veredito

**rejected** (rejeitado)

Foram encontrados **3 BLOCKERs** e **1 WARNING**. Os BLOCKERs cobrem: (1–2) duas libs obrigatórias com pin quebrado (prefixo `^`) em violação direta ao critério de aceite de pinagem exata; (3) invasão de escopo severa — providers wired em `layout.tsx` e pasta `src/providers/` criada, trabalho explicitamente proibido pelo spec e reservado para a TASK-06.

---

## Verificação dos gates (re-executados nesta revisão)

| Gate | Comando | Resultado |
|---|---|---|
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | PASS — exit 0 |
| Lint | `npm run lint` (`next lint`) | PASS — "No ESLint warnings or errors" (exit 0) |
| Build | `npm run build` (`next build`) | **FAIL** — `ENOENT: _not-found/page.js.nft.json` (exit 1) |

> **Nota sobre o build:** A falha ocorre na fase `Collecting build traces` com um `ENOENT` sobre `.next/server/app/_not-found/page.js.nft.json`. É um bug conhecido do Next.js 15 no Windows com a geração de trace files para a rota `_not-found` — **não é causada pelas libs da TASK-03**. A compilação Webpack (`✓ Compiled successfully`), a verificação de tipos e a geração de todas as 11 páginas estáticas completam sem erros. O build gate permanece **vermelho** e deve ser corrigido antes de qualquer deploy, mas a causa-raiz é ambiental/framework, não desta task. Registrado como WARNING (não BLOCKER) pois a raiz não é código desta tarefa.

---

## Checklist de aceite (seção 7 do spec)

| Critério | Status | Evidência |
|---|---|---|
| As 9 libs presentes em `dependencies` | PARCIAL — ver BLOCKER-01/02 | 9 entradas presentes, mas 2 com `^` |
| Todas pinadas (sem `^`/`~`) | **FALHOU** | `lucide-react: "^1.17.0"`, `sonner: "^2.0.7"` |
| Majors corretos | OK | Zod 4, RHF 7, resolvers 5, react-query 5, react-table 8, date-fns 4, lucide 1.x, sonner 2, motion 12 |
| `motion` instalado (não `framer-motion`) | OK | `"motion": "12.40.0"` — sem `^`, correto |
| `npm install` sem conflito de peer | OK | Sem `--legacy-peer-deps` nem `--force` |
| Smoke file removido (opção A) | OK | `src/lib/_smoke-imports.ts` não existe |
| `src/lib/` preservado | OK | `src/lib/utils.ts` + `src/lib/index.ts` presentes |
| `typecheck` verde | OK | exit 0 |
| `lint` verde | OK | exit 0 |
| `build` verde | **FALHOU** | exit 1 — bug ambiental Windows/Next.js 15 |
| `src/app/layout.tsx` inalterado — sem provider/Toaster | **FALHOU** | `<Providers>` wired; imports de `@/providers` adicionados |

---

## Achados

---

### BLOCKER-01: `lucide-react` não pinada — prefixo `^` presente

**Arquivo:** `package.json:38`

**Classificação:** BLOCKER

**Problema:** A spec exige explicitamente pinagem exata (sem `^`/`~`) para todas as 9 libs obrigatórias como critério de aceite binário: "Todas **pinadas** (sem `^`/`~`)". `lucide-react` está declarada como `"^1.17.0"`, o que permite que qualquer `npm install` futuro instale `1.x.y` posterior (inclusive breaking changes dentro da semver — o pacote estava em `0.x` até recentemente e ainda tem histórico de breaking API changes). A regra de pinagem exata é explicitamente motivada no spec como controle de reprodutibilidade e mitigação do risco R4 (compat React 19 + Next 15).

**Correção:**
```jsonc
// package.json — linha 38
// Antes:
"lucide-react": "^1.17.0",
// Depois:
"lucide-react": "1.17.0",
```

Executar `npm install --save-exact lucide-react@1.17.0` para regravar o pin e regenerar `package-lock.json`.

---

### BLOCKER-02: `sonner` não pinada — prefixo `^` presente

**Arquivo:** `package.json:46`

**Classificação:** BLOCKER

**Problema:** Idêntico ao BLOCKER-01. `sonner` está declarada como `"^2.0.7"`, violando o critério de aceite de pinagem exata. A lib está em major 2 (saiu de 1.x recentemente) e o histórico de breaking changes entre majors é relevante.

**Correção:**
```jsonc
// package.json — linha 46
// Antes:
"sonner": "^2.0.7",
// Depois:
"sonner": "2.0.7",
```

Executar `npm install --save-exact sonner@2.0.7` para regravar o pin e regenerar `package-lock.json`.

---

### BLOCKER-03: Invasão de escopo — providers wired em `layout.tsx` e `src/providers/` criados

**Arquivos:**
- `src/app/layout.tsx` (linhas 5, 18–20)
- `src/providers/index.tsx`
- `src/providers/QueryProvider.tsx`
- `src/providers/AuthProvider.tsx`
- `src/providers/__tests__/QueryProvider.test.tsx`
- `src/providers/__tests__/AuthProvider.test.tsx`

**Classificação:** BLOCKER

**Problema:** O spec é inequívoco em múltiplos pontos:

> "Esta tarefa é **somente instalação + validação de smoke import**. Ela **NÃO** monta nenhum provider, contexto ou wiring de runtime (QueryClient, AuthProvider, Toaster) — isso é responsabilidade explícita da **TASK-06**."

> "Nenhuma alteração em `src/app/layout.tsx`, `src/app/page.tsx`, providers ou config."

> "**Nenhum** provider/contexto/Toaster montado (zero alteração em `src/app/layout.tsx`)."

O `layout.tsx` atual (resultado desta task) importa e monta `<Providers>`, que internamente compõe `<QueryProvider>`, `<AuthProvider>`, `<TooltipProvider>` e `<Toaster />`. Além disso, a pasta `src/providers/` foi criada com três componentes completos e seus testes — trabalho da TASK-06 executado antecipadamente.

Consequências: (a) viola o contrato de escopo entre tasks; (b) o `AuthProvider` consome `src/firebase` e `src/schemas` que, se ainda não existirem em um estado validado, podem esconder erros silenciosos; (c) a TASK-06 precisará entender o que já foi feito (acoplamento implícito entre tasks); (d) o processo de revisão por tarefa perde validade.

**Correção:**

1. Reverter `src/app/layout.tsx` para o estado anterior à TASK-03 (sem `<Providers>`, sem import de `@/providers`).
2. Remover `src/providers/` e seus testes (ou mover para a branch/tarefa correta da TASK-06).
3. Confirmar que `layout.tsx` corresponde ao estado gerado pela TASK-01/TASK-02 (apenas `Geist`, `globals.css`, `cn`, metadata e HTML shell).

---

## WARNING

---

### WARNING-01: Build gate vermelho por bug ambiental Windows/Next.js 15

**Arquivo:** ambiente de build / `_not-found` route

**Classificação:** WARNING (causa-raiz externa ao escopo da task)

**Problema:** `npm run build` falha com:
```
[Error: ENOENT: no such file or directory, open
  'C:\www\world-cup-betting-pool\.next\server\app\_not-found\page.js.nft.json']
```

O erro ocorre na fase `Collecting build traces`, após compilação Webpack bem-sucedida, verificação de tipos e geração de todas as páginas estáticas. É um bug conhecido do Next.js 15 no Windows relacionado à rota `_not-found` e à geração de `.nft.json` (trace files). Não é causado por nenhuma lib instalada nesta task.

**Impacto:** O gate `npm run build` não pode ser certificado como verde neste ambiente. Um CI/CD em Linux provavelmente passaria. O BLOCKER-03 (providers) pode ou não mascarar erros adicionais dependendo do estado das dependências.

**Ação sugerida:** Registrar o issue no tracker (possível workaround: `output: 'standalone'` no `next.config.ts` ou upgrade para Next.js patch que corrija o trace bug). Não requer correção de código desta task, mas deve ser resolvido antes de qualquer deploy.

---

### WARNING-02 (Informativo): `@base-ui/react` com `^` em `dependencies`

**Arquivo:** `package.json:28`

**Classificação:** WARNING

**Problema:** `"@base-ui/react": "^1.5.0"` aparece em `dependencies` sem pin exato. Não é uma das 9 libs obrigatórias da TASK-03, mas é uma dep de runtime com `^` em um projeto que adota pinagem total. Se veio de outra task (TASK-02 — Shadcn), deve seguir o mesmo padrão de pinagem do restante das deps da seção.

**Ação sugerida:** Pinar com `npm install --save-exact @base-ui/react@1.5.0` (ou versão atual) na task responsável pela introdução deste pacote.

---

## Resumo dos achados

| # | Severidade | Critério violado | Arquivo |
|---|---|---|---|
| BLOCKER-01 | BLOCKER | Pinagem exata — `lucide-react` tem `^` | `package.json:38` |
| BLOCKER-02 | BLOCKER | Pinagem exata — `sonner` tem `^` | `package.json:46` |
| BLOCKER-03 | BLOCKER | Escopo — providers wired em `layout.tsx`; `src/providers/` criado | `layout.tsx`, `src/providers/` |
| WARNING-01 | WARNING | Gate `build` vermelho (bug ambiental Windows/Next.js 15) | Ambiente |
| WARNING-02 | WARNING | `@base-ui/react` com `^` (dep de outra task, fora de pin) | `package.json:28` |

**Ações obrigatórias antes da aprovação:**

1. `npm install --save-exact lucide-react@1.17.0 sonner@2.0.7` — corrigir pins (BLOCKER-01 e BLOCKER-02).
2. Reverter `src/app/layout.tsx` para o estado pré-TASK-03 (remover `<Providers>` e imports de `@/providers`) — BLOCKER-03.
3. Remover ou mover `src/providers/` e seus testes para a TASK-06 — BLOCKER-03.
4. Investigar e resolver o bug do `build` (WARNING-01) em ambiente CI ou com workaround documentado.
