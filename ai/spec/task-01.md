# SPEC — TASK-01: Scaffold Next.js 15 + TypeScript + Tailwind

> Entrada: `ai/plan/feature.md` (TASK-01) + `ai/prd/feature.md` + `.claude/CLAUDE.md`.
> Tipo: `infra` · Criticidade: `critical` · Risco técnico: `low` · Story points: 2.
> TDD: não · Screen: não · Dependências: nenhuma (tarefa bloqueante — Wave 1).

---

## 1. Objetivo

Inicializar o projeto **Bolão dos Parças** como aplicação **Next.js 15 (App Router)** com **React 19**, **TypeScript em modo strict (sem `any`)** e **Tailwind CSS**, deixando uma base que **compila e roda localmente** (`npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck` verdes).

Esta tarefa é o alicerce de todas as demais (TASK-02..11 dependem direta ou indiretamente dela). Ela NÃO entrega tela de produto — entrega apenas o esqueleto técnico, `layout.tsx` mínimo, `globals.css` com Tailwind e o tooling de qualidade (ESLint + Prettier).

### Truths que devem ser verdadeiras ao fim
- Projeto Next.js 15 + React 19 + TS strict compila (`tsc --noEmit` sem erros).
- `npm run dev` sobe a aplicação e renderiza uma página inicial mínima.
- `npm run build` conclui sem erros.
- TypeScript `strict: true`, `noUncheckedIndexedAccess: true` e **proibição explícita de `any`** ativos.
- Tailwind aplicado via `globals.css`; estilização inline proibida (regra do projeto).
- ESLint (flat config, ESLint 9) + Prettier configurados e consistentes entre si.
- `.gitignore` cobre `node_modules`, `.next`, `.env*`, artefatos de build.

---

## 2. Escopo

### Dentro do escopo
- Scaffold via `create-next-app` (App Router, TypeScript, Tailwind, ESLint, `src/`, alias `@/*`).
- `package.json` com scripts npm padronizados e dependências pinadas.
- `tsconfig.json` strict reforçado (além do default do create-next-app).
- Configuração Tailwind (v4 — config-light via `globals.css` + PostCSS).
- `next.config.ts` base.
- `.gitignore`, `.prettierrc`, `.prettierignore`.
- ESLint flat config (`eslint.config.mjs`) integrando `eslint-config-next` + `eslint-config-prettier` + regra anti-`any`.
- `src/app/layout.tsx` (root layout mínimo, `lang="pt-BR"`, metadata base).
- `src/app/page.tsx` (página inicial placeholder mínima).
- `src/app/globals.css` (diretivas Tailwind + reset mínimo).
- `.env.local.example` vazio/placeholder (estrutura de env será preenchida em TASK-05).
- `README.md` mínimo com comandos de execução.

### Fora do escopo (tarefas posteriores)
- Shadcn UI e tema/tokens de design → **TASK-02**.
- Libs obrigatórias (Zod, RHF, TanStack, etc.) → **TASK-03**.
- Estrutura completa de `features/`, `services/`, `schemas/`, etc. → **TASK-04**.
- Firebase, providers, dados, regras, functions, deploy → **TASK-05..11**.
- Qualquer tela de feature ou navegação/guard → **TASK-11**.

> Importante: **não** criar a árvore completa de pastas de domínio nesta tarefa. Aqui só nasce o `src/app/` gerado pelo scaffold. A estrutura de `features/`, `services/`, etc. é responsabilidade explícita da TASK-04 — evitar invadir o escopo dela.

---

## 3. Decisões técnicas e versões

> Versões alvo verificadas (junho/2026). Pinar versões (sem `^`) para garantir reprodutibilidade e mitigar risco R4 (compat React 19 + Next 15 + Shadcn).

| Item | Decisão | Versão alvo |
|---|---|---|
| Next.js | App Router, Turbopack em dev | `15.5.x` (última estável da linha 15) |
| React / React DOM | requerido pelo Next 15 | `19.x` |
| TypeScript | strict, sem `any` | `5.x` (última 5 estável) |
| Tailwind CSS | v4 (PostCSS plugin) | `4.x` |
| ESLint | flat config (ESLint 9) | `9.x` |
| eslint-config-next | regras Next + react-hooks | casar com Next `15.5.x` |
| Prettier | formatação | `3.x` |
| Node | runtime de build/dev | `>= 20.x` LTS |

Decisões de scaffold:
- **App Router** (não Pages Router) — exigência do `.claude/CLAUDE.md`.
- **`src/` directory**: sim (toda a estrutura vive em `src/`).
- **Import alias**: `@/*` → `./src/*`.
- **Turbopack** habilitado em `dev` (flag `--turbopack`) por velocidade; build padrão.
- **`lang="pt-BR"`** no `<html>` — produto é em português.
- **Tailwind v4**: configuração via `@import "tailwindcss"` em `globals.css` + `@tailwindcss/postcss`. Não criar `tailwind.config.ts` pesado; tokens de tema entram na TASK-02. (Se o scaffold gerar Tailwind v3 com `tailwind.config.ts`, manter o que o `create-next-app` produzir — não forçar downgrade/upgrade manual arriscado; o ponto é compilar com Tailwind funcional.)

---

## 4. Passo a passo de implementação

### Passo 0 — Pré-checagem
- Working dir: `C:\www\world-cup-betting-pool`. Já contém `ai/`, `docs/`, `.claude/`.
- Garantir que NÃO há `package.json` ainda (greenfield). O scaffold deve ser gerado **dentro** deste diretório, sem sobrescrever `ai/`, `docs/`, `.claude/`.
- Como o diretório não está vazio, usar `create-next-app .` (diretório atual) ou gerar em pasta temporária e mover. Preferir scaffold no diretório atual respondendo aos prompts de forma não-interativa (flags).

### Passo 1 — Scaffold
Executar (PowerShell) no diretório do projeto:

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --turbopack --no-git
```

- `--no-git`: o diretório não é repo git (ver `Is directory a git repo: No`). Não inicializar git aqui — fora do escopo.
- Se o CLI reclamar de diretório não vazio (`ai/`, `docs/`, `.claude/` presentes), gerar em subpasta temporária e mover os arquivos de scaffold para a raiz, **preservando** `ai/`, `docs/`, `.claude/`.

### Passo 2 — Pinar versões
- Em `package.json`, remover os `^` das deps principais (`next`, `react`, `react-dom`, `typescript`, `tailwindcss`, `eslint`, `eslint-config-next`) deixando versões exatas.
- Confirmar `react` e `react-dom` em `19.x` e `next` em `15.5.x`.

### Passo 3 — Reforçar `tsconfig.json` strict
Garantir as flags abaixo (além do default). Ver bloco de referência na seção 6.

### Passo 4 — Prettier + integração ESLint
- Adicionar `prettier` e `eslint-config-prettier` como devDependencies.
- Criar `.prettierrc` e `.prettierignore`.
- Ajustar `eslint.config.mjs` (flat config) para: estender `next/core-web-vitals` + `next/typescript`, desativar conflitos de formatação via `eslint-config-prettier`, e **proibir `any`** (`@typescript-eslint/no-explicit-any: "error"`).

### Passo 5 — Scripts npm
Padronizar scripts em `package.json` (ver seção 6).

### Passo 6 — Arquivos base
- Ajustar `src/app/layout.tsx` (lang pt-BR + metadata).
- Substituir `src/app/page.tsx` pelo placeholder mínimo (sem CSS inline).
- Garantir `src/app/globals.css` com Tailwind.
- Criar `.env.local.example` (placeholder).
- Criar/ajustar `README.md`.

### Passo 7 — Verificação
Rodar a sequência da seção 7 e garantir tudo verde.

---

## 5. Arquivos afetados

| Caminho | Ação | Conteúdo |
|---|---|---|
| `package.json` | criar | deps pinadas + scripts |
| `tsconfig.json` | criar/ajustar | strict reforçado, alias `@/*` |
| `next.config.ts` | criar | config base |
| `postcss.config.mjs` | criar | plugin Tailwind |
| `eslint.config.mjs` | criar/ajustar | flat config + prettier + no-explicit-any |
| `.prettierrc` | criar | regras de formatação |
| `.prettierignore` | criar | ignorar build/deps |
| `.gitignore` | criar/ajustar | node_modules, .next, .env*, build |
| `src/app/layout.tsx` | criar/ajustar | root layout, lang pt-BR, metadata |
| `src/app/page.tsx` | ajustar | placeholder mínimo |
| `src/app/globals.css` | criar/ajustar | Tailwind + reset |
| `.env.local.example` | criar | placeholder |
| `README.md` | criar | comandos de execução |

---

## 6. Conteúdo de referência

> Os blocos abaixo são **referência** (alinhada a Next 15 / Tailwind v4 / ESLint 9). Ajustar ao output real do `create-next-app` quando divergir, mantendo as garantias da seção 1.

### `package.json` — scripts e versões (referência)
```jsonc
{
  "name": "bolao-dos-parcas",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "dependencies": {
    "next": "15.5.4",
    "react": "19.1.0",
    "react-dom": "19.1.0"
  },
  "devDependencies": {
    "@types/node": "20.x",
    "@types/react": "19.x",
    "@types/react-dom": "19.x",
    "typescript": "5.x",
    "tailwindcss": "4.x",
    "@tailwindcss/postcss": "4.x",
    "eslint": "9.x",
    "eslint-config-next": "15.5.4",
    "eslint-config-prettier": "9.x",
    "prettier": "3.x"
  }
}
```
> Substituir `x`/placeholders pelas versões exatas resolvidas no momento da instalação. As versões `15.5.4` / `19.1.0` são alvo de referência; usar a última estável da linha 15.5 e React 19 que o `create-next-app@latest` resolver, e então pinar.

### `tsconfig.json` — strict reforçado (referência)
```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```
- `strict: true` cobre `noImplicitAny` (qualquer `any` implícito vira erro).
- `noUncheckedIndexedAccess` adiciona segurança a acessos por índice.
- A proibição de `any` **explícito** é reforçada na regra ESLint abaixo.

### `eslint.config.mjs` — flat config (referência)
```js
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.config({
    extends: ["next/core-web-vitals", "next/typescript", "prettier"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  }),
];

export default eslintConfig;
```
> `prettier` aqui é `eslint-config-prettier` (desliga regras de formatação conflitantes). Confirmar que `@eslint/eslintrc` está disponível (vem com o scaffold do Next 15).

### `.prettierrc` (referência)
```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "endOfLine": "lf"
}
```

### `.prettierignore` (referência)
```
node_modules
.next
out
build
coverage
*.lock
```

### `src/app/layout.tsx` (referência)
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bolão dos Parças",
  description: "Prognósticos da Copa do Mundo 2026",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
```
- `lang="pt-BR"` obrigatório (produto em português).
- Fontes/tema (ex.: `next/font`, tokens) entram na TASK-02 — não adicionar aqui.

### `src/app/page.tsx` — placeholder mínimo (referência)
```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8">
      <h1 className="text-2xl font-bold">Bolão dos Parças</h1>
      <p className="text-sm text-gray-500">Fundação arquitetural — em construção.</p>
    </main>
  );
}
```
- Sem CSS inline (regra do projeto): usar apenas classes Tailwind.

### `src/app/globals.css` — Tailwind v4 (referência)
```css
@import "tailwindcss";
```
> Se o scaffold gerar Tailwind v3, manter as diretivas `@tailwind base; @tailwind components; @tailwind utilities;` correspondentes. O essencial: Tailwind ativo e aplicável.

### `.env.local.example` (placeholder)
```
# Variáveis de ambiente serão definidas na TASK-05 (Firebase).
# Não commitar .env.local real.
```

### `.gitignore` (garantir cobertura mínima)
```
/node_modules
/.next/
/out/
/build
.env*
!.env.local.example
*.log
.DS_Store
/coverage
next-env.d.ts
```

---

## 7. Critérios de aceite e verificação

Rodar, nesta ordem, e exigir saída limpa:

```bash
npm install
npm run typecheck   # tsc --noEmit → 0 erros
npm run lint        # next lint → 0 erros
npm run format:check
npm run build       # next build → sucesso
npm run dev         # sobe local; GET / renderiza "Bolão dos Parças"
```

Checklist de aceite:
- [ ] `package.json` existe com scripts `dev`, `build`, `start`, `lint`, `typecheck`, `format`, `format:check`.
- [ ] `next` em `15.5.x`, `react`/`react-dom` em `19.x`, versões pinadas (sem `^`).
- [ ] `tsconfig.json` com `strict: true` + `noUncheckedIndexedAccess: true` + alias `@/*`.
- [ ] ESLint flat config ativo com `@typescript-eslint/no-explicit-any: "error"` e integração Prettier (sem conflitos de formatação).
- [ ] `.prettierrc`, `.prettierignore`, `.gitignore` presentes e cobrindo `.env*` e `.next`.
- [ ] `src/app/layout.tsx` com `lang="pt-BR"` e metadata base.
- [ ] `src/app/page.tsx` placeholder sem CSS inline (só Tailwind).
- [ ] `src/app/globals.css` com Tailwind ativo.
- [ ] `.env.local.example` presente (placeholder, sem segredos).
- [ ] `ai/`, `docs/`, `.claude/` **intactos** (scaffold não os sobrescreveu).
- [ ] `npm run build` e `npm run dev` funcionam.

---

## 8. Riscos e mitigações (desta tarefa)

| # | Risco | Mitigação |
|---|---|---|
| R4 (PRD) | Incompatibilidade React 19 + Next 15 (+ Shadcn no futuro) | Pinar versões exatas; smoke test (`build` + `dev`) já nesta task |
| L1 | Diretório não vazio (`ai/`, `docs/`, `.claude/`) quebra `create-next-app` | Scaffold no dir atual com flags; se falhar, gerar em temp e mover preservando pastas existentes |
| L2 | Tailwind v4 (config-light) vs v3 (`tailwind.config.ts`) gerado pelo CLI | Aceitar o que o `create-next-app@latest` produzir; garantir Tailwind compilando; tokens de tema ficam para TASK-02 |
| L3 | ESLint 9 flat config + integração Prettier mal-configurada | Usar `FlatCompat` + `eslint-config-prettier` por último no `extends`; validar com `npm run lint` |
| L4 | Invasão de escopo (criar `features/`, providers, etc.) | Limitar estritamente a `src/app/`; estrutura de domínio é TASK-04 |

---

## 9. Notas para a próxima tarefa
- **TASK-02 (Shadcn)** assume este scaffold pronto: vai rodar `shadcn init`, criar `components.json`, `src/lib/utils.ts` e injetar tokens de tema em `globals.css`. Deixar `globals.css` simples e o alias `@/*` funcionando facilita esse passo.
- **TASK-04 (estrutura)** criará a árvore `features/`, `services/`, `schemas/`, etc. — por isso aqui só existe `src/app/`.
- Sem git nesta tarefa (diretório não é repo). Caso o projeto vá a versionamento depois, `.gitignore` já está pronto.
