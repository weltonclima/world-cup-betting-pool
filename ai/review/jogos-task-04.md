# Review — TASK-04: Página Lista de Jogos (`/matches`)

> Feature: Jogos (PRD-03) · Commit: `aee0cc9` · Tipo: UI
> Spec: `ai/spec/jogos-task-04.md` · Screen: `ai/screen/jogos-task-04.md` · Design: `design-system/MASTER.md`
> Fonte visual: `docs/prd-03/PRD03-01-Lista-Jogos.png`
> Revisor: Staff Engineer (adversarial) · Modelo: Opus 4.8

---

## Veredito

**APROVADO COM AJUSTES** (approved with adjustments)

- **BLOCKERS: 0**
- **WARNINGS: 3**

A implementação cumpre o objetivo do spec: substitui o placeholder por `MatchList` + `MatchListHeader`,
com pipeline de filtro/busca client-side correto sobre `flatList`, re-agrupamento que preserva os labels
pt-BR dos grupos originais, e os quatro estados (loading/error/empty/sucesso). `tsc --noEmit` limpo (exit 0),
49 testes passam, diagnostics IDE zerados nos 4 arquivos alterados. Nenhum `any`, nenhum estilo inline.
Os WARNINGS são cosméticos/manutenção e não bloqueiam o envio.

---

## Verificações executadas

| Verificação | Resultado |
|---|---|
| `mcp__ide__getDiagnostics` — MatchList.tsx | 0 diagnostics |
| `mcp__ide__getDiagnostics` — MatchListHeader.tsx | 0 diagnostics |
| `mcp__ide__getDiagnostics` — page.tsx | 0 diagnostics |
| `mcp__ide__getDiagnostics` — 2 arquivos de teste | 0 diagnostics |
| `npx tsc --noEmit` | exit 0 (limpo) |
| `npx vitest run` (2 suites) | PASS 49 / FAIL 0 |
| Dados só via `useMatchesList` | Confirmado (sem fetch/useEffect manual) |
| `any` / estilo inline | Nenhum |

---

## Investigação da DEVIATION — `toMatchWithId` usa `item.id` como placeholder para `homeTeamId`/`awayTeamId`

**Julgamento: SEGURO. Aceitar como está (no máximo um WARNING de clareza — ver W3).**

Evidência rastreada:

1. **`MatchListItem` (useMatchesList.ts:25-40) deliberadamente NÃO inclui `homeTeamId`/`awayTeamId`.**
   O view-model já entrega as seleções resolvidas (`homeTeam: ResolvedTeam`, `awayTeam: ResolvedTeam`).
   Os IDs brutos foram intencionalmente descartados na composição.

2. **`MatchCard` (MatchCard.tsx) nunca lê `match.homeTeamId`/`match.awayTeamId`.**
   Os únicos campos de `match` consumidos são: `groupId`, `round`, `stage` (GroupLabel);
   `kickoffAt`, `status`, `homeScore`, `awayScore`, `venue` (CenterColumn); `status` (CardFooter).
   As seleções chegam via props `homeTeam`/`awayTeam` (ResolvedTeam), não via `match`.
   → O placeholder é **runtime-safe**: o campo simplesmente não é acessado.

3. **`MatchWithId.homeTeamId` = `nonEmptyString` = `z.string().min(1)` (schemas/matches.ts:25, shared.ts:38).**
   O tipo estático é apenas `string`; `item.id` (string não-vazia) satisfaz o tipo sem cast nem `any`.
   `nonEmptyString` só valida no parse — após a construção do objeto, o tipo é `string` puro.
   → **type-safe** sem `as`.

Conclusão: NÃO é necessário um tipo mais estreito para o MatchCard. A alternativa "limpa" (estreitar a prop
`match` do MatchCard para um `Pick<MatchWithId, ...>`) seria uma mudança em arquivo de TASK-03, fora de
escopo desta task e proibida pelo spec §2 ("NÃO modificar arquivos de TASK-03"). O placeholder é a escolha
correta dado o contrato existente. Único reparo opcional: usar `""` (string vazia, como o próprio spec §6.1
sugeria) ou um sentinela explícito em vez de `item.id`, para não insinuar uma relação semântica inexistente
entre o id da partida e o id do time — ver W3.

---

## Findings

### WARNING 1 — `scrollbar-hide` é uma classe inexistente (no-op silencioso)
`MatchListHeader.tsx:164` aplica `scrollbar-hide` ao wrapper dos chips. Essa utility **não existe** no projeto:
não há definição em `globals.css`, nem o plugin `tailwind-scrollbar`, e Tailwind v4 não a fornece por padrão.
O screen contract (linha 110) chamava `scrollbar-none` (também inexistente). Efeito: a barra de rolagem
horizontal dos chips ficará **visível** no mobile, divergindo da intenção de design. Funcionalmente a row
ainda rola e os chips continuam alcançáveis → cosmético, Prioridade 4 (Style), não bloqueia tarefa.
**Fix:** definir a utility em `globals.css` (`@utility scrollbar-hide { scrollbar-width: none; &::-webkit-scrollbar { display: none } }`) ou adicionar o plugin.

### WARNING 2 — Fidelidade visual à PRD03-01: chips dropdown → row expandida de toggles
A imagem PRD03-01 mostra **3 chips-dropdown** ("Fase de Grupos ▾", "Todos ▾", "Todas as seleções ▾") com
fundo cinza claro. A implementação renderiza uma **row expandida** de toggle-chips (1 por fase + divisor +
1 por status), com selecionado = `default`/primary (escuro) e não-selecionado = `outline`. Essa divergência
foi **explicitamente decidida e documentada** no screen contract (§4.1) — é uma escolha de produto mais rica,
não um defeito de implementação. Registrada como WARNING de fidelidade (Prioridade 6) apenas para rastreio:
o resultado se afasta da fonte de verdade visual e o "Todas as seleções" do mockup não existe (não há toggle
de seleção/time além da busca textual). **Fix:** nenhum exigido nesta task; confirmar com design que a row
expandida substitui os dropdowns do mockup.

### WARNING 3 — Placeholder `item.id` é semanticamente enganoso
`MatchList.tsx:97-98` atribui `homeTeamId: item.id` / `awayTeamId: item.id`. Embora seguro (ver investigação
acima), reutilizar o id da partida como id de time pode confundir um leitor futuro ou mascarar um bug se algum
dia o card passar a consumir esses campos. **Fix:** usar `""` (como o spec §6.1 originalmente indicava) ou um
sentinela nomeado, mantendo o comentário "// não consumido pelo card". Prioridade: manutenção/clareza.

---

## UI/UX Review

### Violações por prioridade
| Prioridade | Categoria | Violações |
|---|---|---|
| 1 — Acessibilidade | CRITICAL | 0 |
| 2 — Touch & Interação | CRITICAL | 0 |
| 3 — Performance | HIGH | 0 |
| 4 — Style Consistency | HIGH | 1 (W1 — utility inexistente) |
| 5 — Layout & Responsive | HIGH | 0 |
| 6 — Typography & Color | MEDIUM | 1 (W2 — fidelidade à imagem) |
| 7 — Animation | MEDIUM | 0 |
| 8 — Forms & Feedback | MEDIUM | 0 |
| 9 — Navigation | HIGH | 0 |
| 10 — Charts & Data | — | n/a |

- **BLOCKER count (UI):** 0
- **WARNING count (UI):** 2 (W1, W2) — W3 é manutenção/código, fora da grade UI

### Critical Violations (Prioridade 1-2) — sempre bloqueantes
Nenhuma. Pontos fortes confirmados:
- Input de busca com `aria-label="Buscar jogos por seleção"` + `type="search"` + ícone `aria-hidden`.
- Botão de filtros icon-only com `aria-label="Abrir filtros avançados"` e área de toque `min-h-[44px] min-w-[44px]`.
- Chips são `<Button>` (foco/teclado nativo) com `aria-pressed` refletindo seleção e `focus-visible:ring-2`.
- Wrapper de chips `role="group" aria-label="Filtros rápidos"`; seções `<section aria-labelledby>` + `<h2 id>`.
- Hierarquia de heading correta: `h1` "Jogos" → `h2` por seção (sem pulo de nível).
- Cor não é o único indicador (badge de palpite tem ícone + texto no MatchCard; chips têm `aria-pressed`).
- `pb-20 md:pb-4` evita sobreposição com BottomNav; chips com `transition-colors duration-150` (dentro de 150-300ms).

### Recomendações (Prioridade 3-10)
1. **(W1, P4)** Definir a utility `scrollbar-hide` em `globals.css` ou instalar plugin — hoje é classe morta.
2. **(W2, P6)** Validar com design a substituição dos 3 dropdowns da PRD03-01 pela row expandida de toggles.
3. **Área de toque dos chips:** `h-8` (32px) é abaixo do mínimo 44×44 da Prioridade 2. O screen contract (§7)
   aceita explicitamente 32px para "ação secundária" e os chips têm gap de 8px — aceitável e contratado, mas
   monitorar em uso real no mobile. (Não promovido a WARNING porque é decisão de contrato.)

### Top-3 fixes priorizados
1. `scrollbar-hide` no-op → definir a utility (W1). [única correção com impacto visual real]
2. Trocar `item.id` por `""`/sentinela nos placeholders de `toMatchWithId` (W3). [clareza/anti-bug futuro]
3. Confirmar divergência de chips vs. mockup com design (W2). [decisão de produto, não código]

---

## Test Quality

- **MatchListHeader.test.tsx (20 testes):** título, aria-labels (input/botão/grupo), valor controlado,
  callbacks (search/filtersOpen/stage/predictionStatus), toggle on/off (clicar selecionado → `undefined`),
  `aria-pressed`, badge condicional por `filtersCount`. Cobertura sólida do contrato de props.
- **MatchList.test.tsx (29 testes):** mock do hook nos 4 estados; loading exclui cards/empty/error;
  error chama `refetch` 1×; empty sem subtitle vs. busca/filtro sem resultado com subtitle; busca por
  mandante/visitante/case-insensitive/limpar; filtro de stage e de predictionStatus com toggle de volta;
  `detailHref` = `/matches/{id}`. Cenários significativos, sem testes triviais.
- **Gap menor (não-bloqueante):** não há teste para combinação de filtros simultâneos (busca + stage +
  status) nem para o re-agrupamento omitir uma seção inteira quando todos os jogos do dia são filtrados
  (T24 cobre indiretamente via empty-state global, mas não o caso "seção A some, seção B permanece").
  Sugestão de complemento, não impeditivo.

---

## Conformidade com restrições do spec (§9)

| Restrição | Status |
|---|---|
| NÃO criar `matches/[id]/` | OK — não criado |
| NÃO modificar barrels `index.ts` | OK |
| NÃO implementar o Sheet (só placeholder + `filtersOpen` wired) | OK — `filtersOpen` setado, sheet comentado (MatchList.tsx:193-196) |
| Imports diretos de TASK-03 e do hook | OK |
| page.tsx Server Component | OK — sem `"use client"` |

---

## Conclusão

Task entregue de acordo com spec, screen contract e CLAUDE.md. Zero BLOCKERS. A deviation do `toMatchWithId`
é segura e a escolha correta dado o contrato de TASK-03 (intocável nesta task). Os 3 WARNINGS são de baixa
severidade — `scrollbar-hide` morto é o único com efeito visual perceptível. Recomendo aprovar e tratar W1
(e opcionalmente W3) num polimento.
