# SPEC — TASK-03: Instalar e configurar libs obrigatórias

> Entrada: `ai/plan/feature.md` (TASK-03) + `ai/prd/feature.md` + `.claude/CLAUDE.md`.
> Tipo: `infra` · Criticidade: `high` · Risco técnico: `low` · Story points: 1.
> TDD: não · Screen: não · Dependências: **TASK-01** (scaffold) — Wave 2.

---

## 1. Objetivo

Instalar **todas as bibliotecas obrigatórias** definidas no PRD-00 / `.claude/CLAUDE.md` e garantir que cada uma é **importável e tipável** num projeto Next.js 15 + React 19 + TS strict, sem quebrar `typecheck`, `lint` ou `build`.

Esta tarefa é **somente instalação + validação de smoke import**. Ela **NÃO** monta nenhum provider, contexto ou wiring de runtime (QueryClient, AuthProvider, Toaster) — isso é responsabilidade explícita da **TASK-06**. Aqui o critério de sucesso é: as deps estão pinadas no `package.json`, resolvidas no `package-lock.json`, e um arquivo de smoke prova que cada lib importa limpo sob TS strict.

### Truths que devem ser verdadeiras ao fim
- Todas as 9 libs obrigatórias presentes em `dependencies` do `package.json`, com **versões exatas (pinadas, sem `^`)**.
- `npm install` resolve sem erros nem conflitos de peer dependency (React 19 compatível).
- Um smoke import de cada lib **compila** sob `tsc --noEmit` (TS strict, sem `any`).
- `npm run lint`, `npm run typecheck` e `npm run build` permanecem verdes.
- **Nenhum** provider/contexto/Toaster montado (zero alteração em `src/app/layout.tsx`).

---

## 2. Escopo

### Dentro do escopo
- Instalar e **pinar** as 9 libs obrigatórias (ver seção 3).
- Validar import + tipos via **um único arquivo de smoke** (`src/lib/_smoke-imports.ts`), temporário OU permanente-mas-inerte (decisão na seção 4).
- Confirmar `typecheck` / `lint` / `build` verdes com as deps presentes.

### Fora do escopo (tarefas posteriores)
- **Wiring de providers** — `QueryProvider`, `AuthProvider`, `<Toaster />` da Sonner, configuração de `QueryClient` (staleTime 30min / gcTime 24h) → **TASK-06**.
- Estrutura completa de pastas `features/`, `services/`, `schemas/`, `hooks/`, `providers/` → **TASK-04** (aqui só se cria `src/lib/` se ainda não existir, para abrigar o smoke).
- Qualquer schema Zod real das coleções → **TASK-07**.
- Qualquer formulário com React Hook Form, tabela com TanStack Table, query real, toast real, ícone em tela ou animação → features de PRD-01+.
- Shadcn já trouxe a Sonner como componente `ui/sonner` na TASK-02; **não** reinstalar/reconfigurar o componente Shadcn aqui — apenas garantir o pacote `sonner` pinado como dep direta.

> Importante: o `<Toaster />` da Sonner **não** é montado nesta task. O componente `src/components/ui/sonner.tsx` (gerado pela TASK-02) pode existir, mas seu wiring no layout/providers é da TASK-06. Não tocar em `layout.tsx`.

---

## 3. Bibliotecas, versões e decisões técnicas

> Versões verificadas via `npm view <pkg> version` em **junho/2026**. **Pinar exato** (sem `^`/`~`) para reprodutibilidade e para mitigar R4 (compat React 19 + Next 15). Compatibilidade React 19 confirmada via peerDependencies de cada pacote.

| Categoria | Pacote npm | Versão alvo (jun/2026) | Notas de compat |
|---|---|---|---|
| Validação | `zod` | `4.4.3` | Zod v4 estável. `@hookform/resolvers` v5 suporta Zod v4. |
| Formulários | `react-hook-form` | `7.77.0` | Peer de `@hookform/resolvers` exige `^7.55.0` → OK. |
| Resolver RHF↔Zod | `@hookform/resolvers` | `5.4.0` | v5 integra RHF v7 + Zod v4. Import: `@hookform/resolvers/zod`. |
| Data fetching / cache | `@tanstack/react-query` | `5.101.0` | peer `react: ^18 || ^19` → OK. Config do client é TASK-06. |
| Tabelas | `@tanstack/react-table` | `8.21.3` | peer `react >=16.8` → OK. |
| Datas | `date-fns` | `4.4.0` | v4 (tree-shakeable, ESM). |
| Ícones | `lucide-react` | `1.17.0` | **Atenção:** lucide-react saiu da faixa `0.x` e está em `1.x` (`latest` = `1.17.0`). peer `react: ... || ^19.0.0` → OK. |
| Notificações (toast) | `sonner` | `2.0.7` | peer `react: ^18 || ^19` → OK. Já usada pelo wrapper Shadcn da TASK-02. |
| Animações | **`motion`** | `12.40.0` | **Framer Motion migrou para o pacote `motion`.** Import passa a ser `motion/react` (não `framer-motion`). peer `react: ^18 || ^19` → OK. |

### Decisão: `motion` vs `framer-motion`
O `.claude/CLAUDE.md` lista "Framer Motion". A partir do Framer Motion v12 o projeto foi renomeado e publicado como o pacote **`motion`** (mesma base de código; `framer-motion` permanece como alias da mesma versão, mas o nome canônico/recomendado é `motion`). **Decisão: instalar `motion`** (`12.40.0`) e importar de `motion/react`. Não instalar `framer-motion` em paralelo (evita dependência duplicada). Registrar esta equivalência para a TASK-06 e features de animação.

### Decisão: pinagem
Instalar com `--save-exact` para já gravar versões exatas. Confirmar no `package.json` que nenhuma das 9 entradas tem prefixo `^`/`~`. Isso segue o padrão já adotado na TASK-01 (todas as deps pinadas).

### Decisão: `dependencies` vs `devDependencies`
As 9 libs são de **runtime** → vão em `dependencies` (não `devDependencies`). Inclusive `@tanstack/react-query`, `@tanstack/react-table`, `sonner`, `motion`, `lucide-react`, `date-fns`, `zod`, `react-hook-form`, `@hookform/resolvers`.

---

## 4. Passo a passo de implementação

### Passo 0 — Pré-checagem
- Working dir: `C:\www\world-cup-betting-pool`. Scaffold da TASK-01 presente (`package.json`, `tsconfig.json` strict, `src/app/`).
- Confirmar que `src/lib/` existe; se não, criar (a árvore completa de pastas é TASK-04, mas `lib/` é necessário para o smoke e já é citado nos "Main modules/files" da TASK-03).
- **Não** depender da TASK-04 estar pronta.

### Passo 1 — Instalar e pinar (comando exato)
Executar no diretório do projeto (npm, Windows):

```bash
npm install --save-exact zod@4.4.3 react-hook-form@7.77.0 @hookform/resolvers@5.4.0 @tanstack/react-query@5.101.0 @tanstack/react-table@8.21.3 date-fns@4.4.0 lucide-react@1.17.0 sonner@2.0.7 motion@12.40.0
```

- `--save-exact` grava versões pinadas (sem `^`).
- Se alguma versão alvo tiver avançado até a execução, usar a **última estável** da mesma linha major e **manter o pin**. Não trocar majors (ex.: não cair para Zod 3, não usar lucide `0.x`).
- Se `npm install` acusar conflito de peer dependency (não esperado — todas suportam React 19), **investigar a causa**, não mascarar com `--legacy-peer-deps`/`--force` sem justificativa registrada.

### Passo 2 — Smoke import único
Criar `src/lib/_smoke-imports.ts` que **importa e referencia** cada lib de forma type-safe (ver seção 6). Objetivo: provar que cada pacote resolve módulo + tipos sob TS strict, sem `any` e sem variáveis não usadas (respeitando ESLint).

Duas opções aceitáveis (escolher uma):

- **(A) Smoke temporário (recomendado):** criar o arquivo, rodar a verificação da seção 7, e **remover** o arquivo ao final. A prova fica registrada por ter passado no `typecheck`/`build`. Vantagem: não deixa código morto no repo.
- **(B) Smoke permanente inerte:** manter o arquivo como `// @smoke` documentado, exportando um objeto `SMOKE_IMPORTS` que toca cada símbolo. Aceitável se preferir deixar evidência versionada. Deve passar lint (sem unused, sem `any`).

> Recomendação: **opção (A)**. O valor é a validação, não o artefato. Se optar por (B), garantir que o arquivo não é importado em runtime de produção (não referenciar em `app/`).

### Passo 3 — Verificação
Rodar a sequência da seção 7 e exigir tudo verde.

### Passo 4 — (Se opção A) limpar
Remover `src/lib/_smoke-imports.ts`. Confirmar que `src/lib/` permanece (pode ficar vazio ou com `.gitkeep`; a TASK-04 popula).

---

## 5. Arquivos afetados

| Caminho | Ação | Conteúdo |
|---|---|---|
| `package.json` | ajustar | +9 deps pinadas em `dependencies` |
| `package-lock.json` | ajustar (automático) | árvore resolvida |
| `src/lib/_smoke-imports.ts` | criar (temporário, opção A) | smoke import de cada lib |

- **Nenhuma** alteração em `src/app/layout.tsx`, `src/app/page.tsx`, providers ou config.

---

## 6. Conteúdo de referência

### `package.json` — bloco `dependencies` resultante (referência)
```jsonc
{
  "dependencies": {
    "next": "15.5.19",
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "@hookform/resolvers": "5.4.0",
    "@tanstack/react-query": "5.101.0",
    "@tanstack/react-table": "8.21.3",
    "date-fns": "4.4.0",
    "lucide-react": "1.17.0",
    "motion": "12.40.0",
    "react-hook-form": "7.77.0",
    "sonner": "2.0.7",
    "zod": "4.4.3"
  }
}
```
> `next`/`react`/`react-dom` já vêm da TASK-01; mostrados só para contexto. Versões `x.y.z` são alvo de jun/2026 — confirmar última estável da mesma linha major no momento da instalação e **pinar**.

### `src/lib/_smoke-imports.ts` — smoke import type-safe (referência)
```ts
// Smoke import de validação da TASK-03.
// Prova que cada lib obrigatória resolve módulo + tipos sob TS strict.
// SEM wiring de provider (isso é TASK-06). Arquivo temporário — remover após verificação.

import { z } from "zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { QueryClient, useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { Trophy } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";

// Toca cada símbolo de forma type-safe (sem executar runtime).
const smokeSchema = z.object({ score: z.number().int().min(0) });
type SmokeRow = z.infer<typeof smokeSchema>;

export const SMOKE_IMPORTS = {
  zod: smokeSchema,
  resolver: zodResolver(smokeSchema),
  reactHookForm: useForm as unknown as () => UseFormReturn<SmokeRow>,
  queryClient: QueryClient,
  useQuery,
  reactTable: { useReactTable, getCoreRowModel } satisfies Record<string, unknown>,
  columns: [] as ColumnDef<SmokeRow>[],
  dateFns: format,
  lucide: Trophy,
  sonner: toast,
  motion: motion.div,
} as const;
```
- Sem `any` (regra do projeto). Usa `z.infer`, `satisfies`, `type`-only imports onde aplicável.
- `motion.div` confirma o import canônico `motion/react`.
- `zodResolver(smokeSchema)` confirma a integração RHF↔Zod via `@hookform/resolvers/zod`.
- Este arquivo **não** é importado por nenhuma rota — existe só para o `tsc`/`build` validá-lo. Removê-lo ao final (opção A).

---

## 7. Critérios de aceite e verificação

Rodar, nesta ordem, e exigir saída limpa:

```bash
npm install
npm run typecheck   # tsc --noEmit → 0 erros (valida o smoke import)
npm run lint        # next lint → 0 erros (sem unused/any no smoke)
npm run build       # next build → sucesso
```

Checklist de aceite:
- [ ] As 9 libs (`zod`, `react-hook-form`, `@hookform/resolvers`, `@tanstack/react-query`, `@tanstack/react-table`, `date-fns`, `lucide-react`, `sonner`, `motion`) estão em `dependencies`.
- [ ] Todas **pinadas** (sem `^`/`~`); majors corretos (Zod 4, RHF 7, resolvers 5, react-query 5, react-table 8, date-fns 4, lucide 1.x, sonner 2, motion 12).
- [ ] `motion` instalado (não `framer-motion`); import valida de `motion/react`.
- [ ] `npm install` sem conflito de peer dependency (sem `--force`/`--legacy-peer-deps`).
- [ ] Smoke import (`src/lib/_smoke-imports.ts`) compila sob TS strict, sem `any` e sem unused.
- [ ] `typecheck`, `lint` e `build` verdes.
- [ ] `src/app/layout.tsx` **inalterado** — nenhum provider/Toaster montado.
- [ ] (Opção A) `_smoke-imports.ts` removido ao final; `src/lib/` preservado.

---

## 8. Riscos e mitigações (desta tarefa)

| # | Risco | Mitigação |
|---|---|---|
| R4 (PRD) | Incompat React 19 / Next 15 com alguma lib | Versões verificadas com peer `^19` em jun/2026; smoke import + `build` provam compat já nesta task |
| L1 | "Framer Motion" do CLAUDE.md vs pacote real `motion` | Instalar `motion` e importar `motion/react`; documentar equivalência; não duplicar com `framer-motion` |
| L2 | `lucide-react` em `1.x` (saiu de `0.x`) surpreender quem esperava `0.x` | Pin explícito `1.17.0`; peer React 19 confirmado |
| L3 | Conflito peer RHF↔resolvers↔Zod (versões major) | Combinação validada: RHF 7.77 + resolvers 5.4 + Zod 4.4 (resolver v5 suporta Zod 4) |
| L4 | Invasão de escopo (montar providers / Toaster / QueryClient) | Proibido aqui; é TASK-06. Não tocar `layout.tsx`. Smoke só importa, não monta runtime |
| L5 | Deixar código morto (smoke) no repo | Opção A: remover após verificação; valor é a validação, não o artefato |

---

## 9. Notas para a próxima tarefa
- **TASK-04 (estrutura)** materializa `features/`, `services/`, `schemas/`, `hooks/`, `providers/`, etc. Aqui só garantimos `src/lib/`.
- **TASK-06 (providers)** é quem **monta o runtime** destas libs: `QueryProvider` com `QueryClient` (`staleTime: 30*60*1000`, `gcTime: 24*60*60*1000`), `AuthProvider` (Firebase, depende da TASK-05) e `<Toaster />` da Sonner no `layout.tsx`. Esta task apenas deixa os pacotes instalados e provados.
- **TASK-07 (schemas)** usará `zod` para as 9 coleções; **TASK-06+** usarão RHF + `@hookform/resolvers/zod` nos formulários (regra obrigatória do CLAUDE.md: todo formulário = RHF + Zod).
- Lembrete de import para animações em todo o projeto: **`motion/react`** (pacote `motion`), não `framer-motion`.
