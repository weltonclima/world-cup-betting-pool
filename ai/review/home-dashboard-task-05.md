# Review Report — TASK-05: Hooks TanStack Query + compositor `useHomeDashboard` (PRD-02)

**Data:** 2026-06-07
**Revisado por:** Staff Engineer (adversarial review)
**Commits:** `7fac98a` (implementação inicial) + `25182b8` (fixes dos blockers B-01/B-02/W-01/W-02/W-03)
**Veredicto:** `aprovado com ajustes`

---

## Escopo revisado

- `src/features/home/lib/homeDashboardHelpers.ts`
- `src/features/home/hooks/{homeKeys,useGeneralRanking,useStatistics,useNextMatch,useRecentResults,useTeams,usePredictions,useSystemSettings,useHomeDashboard,index}.ts`
- `src/features/home/hooks/__tests__/{homeDashboardHelpers,useHomeDashboard}.test.ts`
- `src/services/matches.ts` (ajuste MatchWithId), `src/services/teams.ts` (ajuste TeamWithId)
- `src/types/matches.ts`, `src/types/teams.ts`

---

## Resultado dos checks mandatórios

| Check | Resultado |
|---|---|
| `npx tsc --noEmit` | Sem erros nos arquivos de fonte (apenas aviso pré-existente de `baseUrl` em `tsconfig.json`) |
| `npx vitest run src/features/home src/services` | 279 testes, 0 falhas |
| `mcp__ide__getDiagnostics` | Sem diagnósticos TS nos arquivos em escopo |

---

## Findings

### WARNING — W-04: `homeKeys` diverge do padrão `usersKeys` da spec (fatoração como funções em vez de array literals)

**Arquivo:** `src/features/home/hooks/homeKeys.ts`

**Observado:** todas as 7 chaves são funções que retornam arrays — inclusive as que não têm parâmetro (ex.: `generalRanking: () => ["home", "general-ranking"] as const`). Isso difere do padrão `usersKeys.ts` que usa arrays literais para chaves sem parâmetro (`all: ["users"] as const`) e funções apenas onde há argumento (`byStatus: (status) => [...] as const`).

**Spec §4:** "Nota: `teams` e os recursos sem parâmetro usam array literal (não função) por consistência com o padrão `usersKeys.all`." A spec é explícita neste ponto.

**Impacto real:** o impacto funcional é nulo — TanStack Query serializa a chave em tempo de execução; a função retorna um array novo a cada chamada mas isso não afeta invalidação (o TanStack Query compara por valor, não por referência). Porém:

1. A divergência **quebra a consistência** com `usersKeys.ts` — o padrão mixed (array para constantes, função para paramétricos) é a convenção documentada e é o que os consumidores externos do barrel esperam.
2. Qualquer futura lógica de invalidação em nível de feature (`queryClient.invalidateQueries({ queryKey: homeKeys.generalRanking })`) precisaria passar `homeKeys.generalRanking()` — a adição de `()` é fácil de esquecer, o que seria um bug silencioso.
3. O commit `25182b8` registra isso como W-03 e escolheu **deliberadamente** converter para funções, com o argumento de que o padrão-função é "recomendado pelo TanStack Query". Essa é uma posição técnica legítima. O ponto de conflito é que a spec (§4) proibiu essa escolha explicitamente.

**Classificação:** WARNING (não quebra funcionalidade; é desvio de convenção documentada na spec; equipe deve deliberar e documentar a decisão).

---

### WARNING — W-05: `as any` no helper de teste `fakeQuery` (violação da regra "sem `any`")

**Arquivo:** `src/features/home/hooks/__tests__/useHomeDashboard.test.ts` linha 102

**Observado:**
```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;
```

**Regra do projeto (CLAUDE.md §Regras de Desenvolvimento):** "Nunca usar `any` — TypeScript strict em todo o projeto."

**Contexto:** o `as any` é necessário porque `UseQueryResult<T>` (TanStack Query v5) é uma union discriminada com dezenas de campos, e o helper `fakeQuery` constrói apenas os campos efetivamente lidos pelo compositor — os restantes estão presentes mas podem não satisfazer a discriminação da union sem o cast.

**Alternativa viável sem `any`:**
```ts
// Opção A: cast específico
} as unknown as UseQueryResult<T>;
```
`as unknown as T` é o padrão idiomático para forçar uma conversão de tipo em testes sem usar `any`. Não viola a regra do projeto (não introduz `any` no grafo de tipos do runtime).

**Classificação:** WARNING (viola a regra literalmente; o risco real em código de teste é baixo; mas o eslint-disable deixa um linter silenciado que pode mascarar outros `any` futuros no arquivo).

---

## Análise por categoria

### Bugs

Nenhum bug funcional encontrado.

### TanStack Query idioms

- Cache inheritance: todos os 7 hooks não definem `staleTime` nem `gcTime` — verificado no código e nos comentários. Herança global confirmada. Correto.
- `enabled: uid !== null`: implementado em `useStatistics` e `usePredictions`. Correto.
- Queries desabilitadas reportam `isLoading: false` no TQ v5 — o compositor usa `queries.some(q => q.isLoading)` de forma segura para ambos os estados. A simplificação de W-01 (feita em `25182b8`) foi correta.
- `refetch` estável: `useCallback` com deps explícitas nos `.refetch` individuais de cada hook. Correto — o TQ v5 garante estabilidade de identidade de `.refetch` entre renders.

### `isCorrect` — cálculo binário e null guard

- `computeIsCorrect` implementa o guard explícito `if (match.homeScore === null || match.awayScore === null) return false` — proteção defensiva além do que o schema garante. Correto.
- O compositor usa `flatMap` com guard duplo (omite jogo sem placar em `recentResults`): jogos `finished` com placar nulo são silenciosamente omitidos da lista ao invés de propagar um `NaN` ou falso `isCorrect`. Essa decisão não está documentada na spec; ver §Edge Cases abaixo.

### `predictionStatus`

- A prioridade `bloqueado > enviado > pendente` está correta.
- A detecção de `"enviado"` usa `predictions.some(p => p.matchId === nextMatch.id)` — correto (cruzamento por doc id).
- Cobertura de testes cobre todos os 4 ramos do spec §11.2 mais edge case de palpite para outro matchId.

### Agregação `isLoading / isError / refetch`

- Após `25182b8`, `isLoading = queries.some(q => q.isLoading)` — sem bifurcação condicional por `uid`. Correto: TQ v5 garante que queries desabilitadas retornam `isLoading: false`, então `queries.some` funciona uniformemente.
- `isError` usa o mesmo padrão. Correto.
- `refetch` lista explicitamente todos os 7 `.refetch` no dep array. Correto — evita o bug do closure estático que existia antes de `25182b8`.

### Join via teams Map

- `buildTeamMap` retorna `Map<string, TeamWithId>` — O(1) lookup. Sem N+1.
- `resolveTeam` tem fallback `{ name: teamId, flagUrl: undefined }` para teamId ausente. Correto.
- `useTeams` é chamado uma única vez no compositor e reutilizado por todos os joins. Sem N+1.

### `homeKeys` — factory

- A divergência já documentada como W-04.
- As chaves não contêm strings literais fora da factory — nenhum hook usa string mágica diretamente.

### TypeScript — sem `any` (produção)

- Nenhum `any` nos arquivos de produção (helpers, hooks, compositor). Os casts presentes são `as const` (arrays de query key, legítimos) e nenhum cast de tipo de dado em produção.
- O único `as any` está no arquivo de teste — W-05.

### Edge cases

| Cenário | Comportamento | Status |
|---|---|---|
| `uid === null` | Retorna estado neutro; queries uid-dependentes ficam `enabled: false` | Correto |
| `ranking === null` | `rankingSummary = null` | Correto |
| `statistics === null/undefined` | `performance` com zeros | Correto |
| `nextMatch === null` | `nextMatchSummary = null` | Correto |
| `teams === []` | `resolveTeam` retorna fallback com teamId raw | Correto |
| `predictions === []` | `predictionStatus = "pendente"` (ou `"bloqueado"`) | Correto |
| `settings === null` | `predictionsLocked` assume `false`; stage `null` | Correto |
| Jogo `finished` com `homeScore === null` | Omitido de `recentResults` via `flatMap` | Comportamento correto mas não documentado — ver abaixo |
| Múltiplas queries com erro | `isError = true`; `refetch` chama todas | Correto |

**Sobre jogo `finished` com placar `null` (via `flatMap`):** o spec §10 diz "não deveria acontecer (violaria o refinement do schema)" mas não prescreve explicitamente o comportamento de omissão silenciosa. A implementação omite o jogo (flatMap retorna `[]` para esse caso), o que é conservador — mas poderia mascarar corrupção de dados que deveria aparecer como erro. A decisão é defensiva e razoável, mas merece um comentário inline adicional explicando que a omissão é intencional e não um engano.

### Cobertura de testes

- `homeDashboardHelpers.test.ts`: 49 testes cobrindo todas as 8 funções puras. Supera os cenários mínimos do spec §11.1. Cobre edge cases relevantes (placar 0-0, kickoff exatamente em 3h, palpite para outro matchId, 30min antes do kickoff).
- `useHomeDashboard.test.ts`: 27 testes cobrindo o compositor com mocks dos 7 hooks. Cobre todos os 11 cenários do spec §11.2 mais variações adicionais.
- `vi.mock("@/firebase")` presente para isolar o Firebase SDK. Correto.
- Mock de `useAuth` fornece todos os campos exigidos pela interface. Correto.

### Arquitetura e responsabilidade

- Funções puras isoladas em `lib/homeDashboardHelpers.ts` — sem imports React ou Firebase. Testáveis em isolamento.
- Tipos de saída definidos em `homeDashboardHelpers.ts` e reexportados via `useHomeDashboard.ts` e `index.ts`. A intenção da spec era definir os tipos em `useHomeDashboard.ts` (§6), mas a localização em `homeDashboardHelpers.ts` é tecnicamente superior (co-localização com as funções que os usam).
- Barrel `index.ts` reexporta todos os hooks, chaves e tipos. Correto.
- Sem alterações em arquivos além do escopo declarado — exceto os ajustes necessários e documentados em `src/services/matches.ts`, `src/services/teams.ts`, `src/types/matches.ts`, `src/types/teams.ts` (todos previstos no §7 da spec).

### Segurança

- `enabled: uid !== null` previne chamadas ao Firestore sem UID. Correto.
- Sem chamadas diretas à API-Football. Correto.
- Sem dados sensíveis logados ou expostos.

---

## Desvios da spec resolvidos (histórico)

Os seguintes blockers/warnings do review anterior (anterior a `25182b8`) foram resolvidos:

| ID | Descrição | Status |
|---|---|---|
| B-01 | Ausência de `useHomeDashboard.test.ts` | Resolvido: 27 testes |
| B-02 | `refetch` com closure estático (deps vazias) | Resolvido: deps explícitas |
| W-01 | `isLoading` com bifurcação desnecessária por uid | Resolvido: `queries.some()` unificado |
| W-02 | Cast `as number` sem null guard em `computeIsCorrect` | Resolvido: guard explícito + flatMap |
| W-03 | `homeKeys` com array literal para chaves sem parâmetro | Convertido para funções (ver W-04) |

---

## Findings ativos

| ID | Severidade | Arquivo | Descrição |
|---|---|---|---|
| W-04 | WARNING | `homeKeys.ts` | Divergência do padrão `usersKeys` — chaves sem parâmetro como funções em vez de array literal (spec §4 é explícita; impacto funcional nulo mas quebra consistência da convenção) |
| W-05 | WARNING | `useHomeDashboard.test.ts:102` | `as any` em código de teste — viola regra "sem `any`"; substituir por `as unknown as UseQueryResult<T>` |

---

## Ações recomendadas (para `/implement` ou próxima iteração)

1. **W-04** — Decidir e documentar: manter funções para todas as chaves (padrão TQ recomendado) OU reverter chaves sem parâmetro para array literal (padrão do projeto). Atualizar o comentário no arquivo para refletir a decisão deliberada. Qualquer escolha é aceitável desde que consistente.

2. **W-05** — Substituir `} as any` por `} as unknown as ReturnType<typeof useQuery<T>>` (ou importar e usar `UseQueryResult<T>`) no `fakeQuery`. Remover o `eslint-disable-next-line`.

3. **Opcional** — Adicionar comentário inline no `flatMap` do compositor explicando que a omissão de jogos `finished` com placar nulo é intencional (proteção contra dados corrompidos, não engano).

---

## Veredicto: `aprovado com ajustes`

Nenhum BLOCKER. Dois WARNINGs ativos (W-04 e W-05). A implementação está correta, tipada, testada (279 testes passando, 0 falhas), sem `any` em produção, sem violações de cache, sem N+1, e com cobertura que supera os critérios mínimos da spec. Os dois ajustes pendentes são de baixo risco e podem ser endereçados na próxima iteração sem bloquear o avanço para TASK-06+.
