# SPEC — TASK-04: Criar estrutura de pastas + barrels

> Entrada: `ai/plan/feature.md` (TASK-04) + `ai/prd/feature.md` + `.claude/CLAUDE.md` (seção "Estrutura de Pastas").
> Tipo: `infra` · Criticidade: `medium` · Risco técnico: `low` · Story points: 1.
> TDD: não · Screen: não · Dependências: **TASK-01** (scaffold) — Wave 2.

---

## 1. Objetivo

Materializar fisicamente a **árvore de pastas** de `src/` e `src/features/` definida no PRD-00 / `.claude/CLAUDE.md`, com **placeholders tipados** (barrels `index.ts`) e **READMEs de domínio**. É uma tarefa de **convenção pura**: estabelece os pontos de import canônicos que as features de PRD-01+ vão consumir, sem nenhuma lógica de negócio.

O critério central: cada pasta da estrutura oficial deve **existir de verdade** no repositório. Como o Git não versiona pastas vazias e pastas vazias não têm utilidade, **toda pasta recebe pelo menos um arquivo** — um barrel `index.ts` válido sob TS strict e/ou um `README.md` em pt-BR descrevendo o domínio.

### Truths que devem ser verdadeiras ao fim
- Todas as pastas do PRD-00 existem sob `src/`: `app`, `components`, `services`, `hooks`, `schemas`, `types`, `lib`, `firebase`, `providers` e `features/`.
- Todas as 8 features existem sob `src/features/`: `auth`, `home`, `matches`, `predictions`, `rankings`, `statistics`, `profile`, `admin`.
- Cada pasta contém ao menos um arquivo (barrel e/ou README) → estrutura real e rastreável.
- Todo barrel `index.ts` é um **módulo TS válido** (não dispara "is not a module" se importado) e passa em TS strict.
- `npm run typecheck` (`tsc --noEmit`), `npm run lint` e `npm run build` permanecem **verdes**.
- **Zero** lógica de negócio, **zero** `any`, **zero** estilo inline, **zero** quebra de build.

---

## 2. Escopo

### Dentro do escopo
- Criar os diretórios faltantes sob `src/` e `src/features/`.
- Adicionar um barrel `index.ts` em cada pasta onde faz sentido reexportar símbolos futuros (`components`, `services`, `hooks`, `schemas`, `types`, `lib`, `firebase`, `providers` e cada feature).
- Adicionar um `README.md` curto (1–3 linhas, pt-BR) por pasta de **feature**, descrevendo seu domínio.
- Garantir que cada barrel é um módulo TS válido sob strict.

### Fora do escopo (tarefas posteriores)
- Conteúdo real dos barrels (componentes, serviços, hooks reais) → features de PRD-01+.
- `src/firebase/client.ts` / `admin.ts` reais → **TASK-05**.
- Providers reais (`QueryProvider`, `AuthProvider`, `Toaster`) → **TASK-06**.
- Schemas Zod e tipos das 9 coleções → **TASK-07**.
- Qualquer rota nova em `src/app/` → não tocar; o App Router já está scaffolded (TASK-01).
- Subpastas internas de feature (`components/`, `hooks/` por feature) → criadas sob demanda quando a feature for implementada. Aqui só o nível raiz de cada feature.

> Não alterar `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `tsconfig.json`, `package.json` nem qualquer config. Esta task **só adiciona** arquivos/pastas de placeholder.

---

## 3. Decisões técnicas

### 3.1 Barrel vs README por tipo de pasta
- **Pastas de código** (`components`, `services`, `hooks`, `schemas`, `types`, `lib`, `firebase`, `providers`): recebem **`index.ts`** (barrel). São os pontos de import (`@/services`, `@/hooks`, etc.). Sem README — seu papel já é óbvio pela convenção do PRD-00.
- **Pastas de feature** (`auth`, `home`, `matches`, `predictions`, `rankings`, `statistics`, `profile`, `admin`): recebem **`index.ts` (barrel)** + **`README.md`** (pt-BR, 1–3 linhas) descrevendo o domínio. O README documenta a fronteira de domínio para quem implementar a feature depois.
- **`src/app`**: já existe e está populada (TASK-01) — **não** adicionar barrel (App Router tem convenções próprias de arquivo; um `index.ts` ali não agrega e pode confundir). Deixar como está.

### 3.2 Forma do barrel — módulo TS válido sob strict
Cada `index.ts` precisa ser um **módulo ES válido** para nunca disparar `TS2306: ... is not a module` se importado. Um arquivo `.ts` totalmente vazio **não** é garantido como módulo. Duas formas aceitáveis:

- `export {};` → torna o arquivo um módulo explícito, sem exportar nada.
- Um comentário de propósito **+** `export {};`.

**Decisão:** usar comentário de propósito (pt-BR, 1 linha) **seguido de `export {};`**. Isso:
- garante módulo válido (sem "is not a module"),
- passa em TS strict (sem `any`, sem símbolo não usado — `export {}` não declara binding),
- passa no ESLint (não há variável/import não usado),
- documenta o ponto de import sem introduzir lógica.

Exemplo padrão:
```ts
// Barrel de <pasta>. Reexporta os módulos públicos deste diretório (preenchido em PRDs futuros).
export {};
```

> Por que não exports reais agora? Não há símbolos a reexportar nesta task (proibido criar lógica). `export {}` é a forma canônica de "módulo vazio porém válido". Quando a feature/módulo ganhar conteúdo, troca-se `export {}` por `export * from "./<arquivo>"`.

### 3.3 Sem `any`, sem estilo inline
Nenhum arquivo desta task contém tipos, JSX ou estilos — apenas comentário + `export {}` (TS) e prosa Markdown (README). As restrições de `any`/inline-style são respeitadas por construção (não há código onde elas se apliquem).

### 3.4 Lint de arquivos "quase vazios"
`export {};` é válido para `@typescript-eslint`/`eslint-config-next` (não é "empty file", não tem unused vars). Caso o ESLint do projeto sinalize algo inesperado num barrel, a mitigação é manter o comentário + `export {}` (já é a forma mais conservadora) — não adicionar `eslint-disable` sem necessidade comprovada.

---

## 4. Estrutura-alvo

```
src/
├── app/                      (existe — NÃO tocar; sem barrel)
├── components/
│   └── index.ts              barrel
├── services/
│   └── index.ts              barrel
├── hooks/
│   └── index.ts              barrel
├── schemas/
│   └── index.ts              barrel
├── types/
│   └── index.ts              barrel
├── lib/                      (existe, vazia)
│   └── index.ts              barrel
├── firebase/
│   └── index.ts              barrel
├── providers/
│   └── index.ts              barrel
└── features/
    ├── index.ts              barrel agregador das features
    ├── auth/        { index.ts, README.md }
    ├── home/        { index.ts, README.md }
    ├── matches/     { index.ts, README.md }
    ├── predictions/ { index.ts, README.md }
    ├── rankings/    { index.ts, README.md }
    ├── statistics/  { index.ts, README.md }
    ├── profile/     { index.ts, README.md }
    └── admin/       { index.ts, README.md }
```

### Domínios das features (texto de referência dos READMEs, pt-BR)
| Feature | Domínio (resumo do README) |
|---|---|
| `auth` | Autenticação e cadastro: login, criação de conta e fluxo de aprovação de usuários. |
| `home` | Dashboard inicial: visão geral pós-login com atalhos e próximos jogos. |
| `matches` | Partidas: listagem e detalhe dos jogos da Copa 2026. |
| `predictions` | Palpites: registro e consulta dos prognósticos de placar do usuário. |
| `rankings` | Rankings: classificação geral e por fase do torneio. |
| `statistics` | Estatísticas individuais: acertos, aproveitamento e histórico de posições. |
| `profile` | Perfil do usuário: dados pessoais e preferências. |
| `admin` | Painel administrativo: aprovação/bloqueio de usuários e gestão do sistema. |

---

## 5. Passo a passo de implementação

1. **Pré-checagem:** working dir `C:\www\world-cup-betting-pool`; `src/app/` e `src/lib/` (vazia) já existem.
2. **Criar diretórios** faltantes sob `src/` e os 8 sob `src/features/`.
3. **Criar barrels** `index.ts` (comentário pt-BR + `export {};`) nas pastas de código e em cada feature, mais o agregador `src/features/index.ts`.
4. **Criar READMEs** (pt-BR, 1–3 linhas) em cada feature.
5. **Verificar** com a sequência da seção 7 e reportar saída real.

---

## 6. Arquivos criados (resumo)

- Barrels de código: `src/components/index.ts`, `src/services/index.ts`, `src/hooks/index.ts`, `src/schemas/index.ts`, `src/types/index.ts`, `src/lib/index.ts`, `src/firebase/index.ts`, `src/providers/index.ts`.
- Agregador: `src/features/index.ts`.
- Por feature (`auth`, `home`, `matches`, `predictions`, `rankings`, `statistics`, `profile`, `admin`): `index.ts` + `README.md`.

Total: 9 barrels de nível `src/` + 8 barrels de feature + 8 READMEs = **25 arquivos**.

---

## 7. Critérios de aceite e verificação

Rodar, nesta ordem, e exigir saída limpa:

```bash
npx tsc --noEmit     # 0 erros — todos os barrels são módulos válidos sob strict
npm run lint         # next lint → 0 erros/warnings
npm run build        # next build → sucesso
```

Checklist:
- [ ] Todas as pastas de `src/` do PRD-00 existem e contêm ao menos um arquivo.
- [ ] Todas as 8 features existem com `index.ts` + `README.md`.
- [ ] Todo `index.ts` é módulo TS válido (`export {};`) — sem "is not a module".
- [ ] Sem `any`, sem estilo inline, sem lógica de negócio.
- [ ] `src/app/` inalterada; nenhum config tocado.
- [ ] `tsc --noEmit`, `lint` e `build` verdes.

---

## 8. Riscos e mitigações (desta tarefa)

| # | Risco | Mitigação |
|---|---|---|
| T1 | `index.ts` vazio dispara "is not a module" se importado | Usar `export {};` em todos os barrels (módulo explícito) |
| T2 | Barrel em `src/app/` confundir App Router | Não criar barrel em `src/app/` |
| T3 | Lint reclamar de arquivo "vazio"/unused | `export {}` não declara binding; forma conservadora, sem `eslint-disable` |
| T4 | Pasta vazia "sumir" no Git | Toda pasta recebe pelo menos um arquivo (barrel/README) |
| T5 | Invasão de escopo (criar firebase/providers/schemas reais) | Apenas placeholders; conteúdo real é TASK-05/06/07 |

---

## 9. Notas para as próximas tarefas
- **TASK-05** preenche `src/firebase/` (`client.ts`, `admin.ts`) e reexporta via `src/firebase/index.ts`.
- **TASK-06** preenche `src/providers/` e `src/hooks/useAuth.ts`, reexportando pelos barrels.
- **TASK-07** preenche `src/schemas/` e `src/types/` (9 coleções), reexportando pelos barrels.
- Convenção de import a partir daqui: `@/services`, `@/hooks`, `@/schemas`, `@/types`, `@/lib`, `@/firebase`, `@/providers`, `@/features/<dominio>` — alias `@/*` já configurado no `tsconfig.json`.
- Ao popular um diretório, substituir `export {};` por `export * from "./<arquivo>";` no barrel correspondente.
