# PRD — Chaveamento Visual das Eliminatórias (PRD-16)

> Feature slug: `chaveamento-eliminatorias-visual`
> Depende de: PRD-03.2 (grupos-eliminatorias) — já implementado.

---

## 1. Feature summary

Redesenho da tela `/matches/eliminatorias` para exibir o chaveamento eliminatório com:

1. **Data e hora** de cada confronto (campo `kickoffAt` ausente hoje no schema/API do bracket).
2. **Layout visual por fase** com indicação de progressão — quem avançou de cada confronto (vencedor + fase destino) — em vez de lista plana sem conexão visual.
3. **UX/UI moderno**: Tailwind v4 + shadcn, mobile-first, degradação graciosa para confrontos ainda "aguardando definição".

Não é um bracket horizontal estilo tênis. É um layout vertical por fase com marcação clara de vencedor e seta/conexão de avanço.

---

## 2. Consolidated scope

### 2.1 Backend — schema e derivação

- Adicionar `kickoffAt: string` (ISO 8601) e `venue?: { name: string; city: string }` ao `knockoutMatchSchema` em `src/schemas/worldcup.ts`.
- Atualizar `deriveBracket` (`src/server/worldcup/bracket.ts`) para propagar `match.kickoffAt` e `match.venue` ao montar cada `KnockoutMatch`.
- Tipos derivados (`src/types/worldcup.ts`) atualizam automaticamente via `z.infer`.
- `BracketPayload` em `src/server/worldcup/bracket.ts` passa a incluir os novos campos.
- Cache Firestore `worldcup_cache/bracket` precisa ser **invalidado** (bust) após deploy — snapshots anteriores não terão `kickoffAt`. Bust via endpoint admin existente (`revalidatePath`) ou deletando o doc manualmente.

### 2.2 Frontend — redesenho da tela

#### KnockoutMatchCard (atualizado)
- Mostrar `kickoffAt` formatado em pt-BR (ex.: "Dom, 29 Jun · 16h00").
- Mostrar `venue.city` quando disponível (secundário, muted).
- Badge de vencedor: quando `status === "encerrado"`, destacar visualmente o lado com maior placar (borda ring colorida, ícone de troféu pequeno, ou fundo leve).
- Manter 3 variantes: aguardando / definido / encerrado.

#### PhaseSection (atualizado)
- Header da fase mais expressivo: ícone/número da fase + label + contagem de jogos.
- Separador visual entre fases (timeline ou divisor com label centralizado).

#### BracketView (atualizado)
- Substituir a empilhagem plana por seções com indicação de **progressão de fase**.
- Após cada fase (exceto a final), exibir indicador "→ avança para [próxima fase]" ou linha visual conectando as seções.
- Quando uma fase ainda não tem jogos (bucket vazio), omitir a seção (comportamento atual mantido).
- Scroll único vertical (sem tabs por fase — a tela já tem abas Partidas/Grupos/Eliminatórias).

### 2.3 Fora do escopo
- Nenhuma alteração em `/api/worldcup/bracket` além do payload shape (sem novo endpoint).
- Nenhuma alteração em Grupos, Partidas, Rankings, Predictions.
- Sem bracket horizontal SVG/canvas.
- Sem palpites nesta tela.

---

## 3. System understanding relevant to this feature

### Bracket pipeline (atual)
```
getEffectiveMatches() [MatchWithId[] com kickoffAt + venue]
  → deriveBracket(matches, teams)      [src/server/worldcup/bracket.ts]
     → knockoutMatchSchema.parse()     [src/schemas/worldcup.ts]  ← GAP: kickoffAt/venue não incluídos
  → Firestore worldcup_cache/bracket   [snapshot de BracketPayload]
  → GET /api/worldcup/bracket          [Route Handler, nodejs]
  → getBracket() [src/services/worldcup.ts]
  → useBracket() [React Query, staleTime 24h]
  → BracketView → PhaseSection → KnockoutMatchCard
```

### Campos disponíveis mas não propagados
`MatchWithId` (fonte) já tem:
- `kickoffAt: string` (isoDateTime, obrigatório)
- `venue?: { name: string; city: string }` (opcional)

`deriveBracket` descarta esses campos ao montar `KnockoutMatch`. Gap intencional no PRD-03.2 (data/hora não era requisito da fase inicial).

### Componentes impactados
| Arquivo | Mudança |
|---|---|
| `src/schemas/worldcup.ts` | + `kickoffAt`, `venue?` em `knockoutMatchSchema` |
| `src/server/worldcup/bracket.ts` | propaga campos ao `KnockoutMatch` |
| `src/features/worldcup/components/KnockoutMatchCard.tsx` | exibe data + venue + badge vencedor |
| `src/features/worldcup/components/PhaseSection.tsx` | header expressivo + indicador de progressão |
| `src/features/worldcup/components/BracketView.tsx` | progressão entre fases |
| Testes existentes `__tests__/KnockoutMatchCard.test.tsx` | atualizar com novos campos |
| Testes existentes `__tests__/PhaseSection.test.tsx` | atualizar se interface mudar |
| `src/server/worldcup/__tests__/bracket.test.ts` | atualizar para verificar propagação de kickoffAt |

### Cache Firestore
Snapshots existentes em `worldcup_cache/bracket` são stale (sem `kickoffAt`). Na primeira leitura após o deploy, o schema parse vai **falhar na validação** do snapshot stale (campo obrigatório ausente) → o Route Handler recomputará e gravará snapshot novo. Este é o comportamento já esperado pelo sistema (read-through defensivo em `cache.ts`).

**Verificar:** `cache.ts` trata parse error como cache miss? Se não, o endpoint 500 até que o doc seja deletado manualmente.

---

## 4. Technical impact analysis

### 4.1 Schema contract
- `knockoutMatchSchema` é strict — adicionar campos quebraria `parse` de snapshots stale.
- **Mitigação:** `kickoffAt` pode ser `z.string().optional()` no schema público (frontend degrada graciosamente quando ausente) e obrigatório apenas internamente em `deriveBracket`. Alternativa: campo obrigatório + garantia de cache miss no read-through.

### 4.2 Cache invalidation
- `worldcup_cache/bracket` doc em Firestore será stale após mudar o schema.
- O cache read-through em `src/server/worldcup/cache.ts` provavelmente faz `bracketResponseSchema.parse()` no snapshot — parse vai falhar no campo novo e acionar recompute.
- Risco: se `cache.ts` absorver silenciosamente o erro de parse e retornar undefined/null, o handler pode lançar 500. Verificar e garantir que `parse error = cache miss`.

### 4.3 Formatação de data no cliente
- `kickoffAt` é ISO 8601 UTC. Formatar com `Intl.DateTimeFormat` no fuso local do dispositivo (padrão do projeto — ver memória `matches-day-local-tz`).
- Não usar bibliotecas externas (projeto não usa date-fns/dayjs segundo arquitetura atual).
- Reusar helpers de `matchesHelpers.ts` se existirem; senão criar em `worldcup/lib/`.

### 4.4 Badge vencedor e regra de pênaltis no bolão
- Lógica: `homeScore > awayScore` → home venceu; vice-versa → away venceu; `homeScore === awayScore` → `"draw"`.
- **Regra bolão (pênaltis):** quando o placar ao final do tempo regulamentar + prorrogação for empate (jogo vai a pênaltis), o resultado para fins do bolão é **empate**. Quem acertou o empate ganha; quem acertou o placar exato do empate (ex.: 1-1) também ganha. O resultado dos pênaltis **não influencia o bolão**. O schema não precisa de campo de pênaltis para este caso de uso.
- Copa 2026: mata-mata pode ir a pênaltis. O schema de `MatchWithId` não tem campo de pênalti — e não precisa ter para o bolão. Badge/vencedor visual exibe placar regular; empate em mata-mata é um estado válido sem "(pen.)" nesta versão.

### 4.5 Indicador de progressão visual
- Simples: após cada `PhaseSection`, exibir um divisor com label "→ Os vencedores avançam para [Próxima Fase]".
- Complexo (fora do escopo): linhas SVG conectando cards de confronto específicos ao próximo jogo correspondente.
- **Decisão adotada: simples** — divisor por fase com label de progressão.

---

## 5. Risks

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| `cache.ts` não trata parse error como cache miss | Média | Alto (500 após deploy) | Inspecionar e corrigir antes de mudar schema |
| `kickoffAt` obrigatório + snapshot stale quebra API | Alta | Alto | Tornar `kickoffAt` opcional no schema OU garantir cache miss |
| Pênaltis em mata-mata não modelados | Alta (Copa 2026) | Médio | Exibir placar regular; nota "(+ pen.)" pode ser TASK futura |
| Regressão em testes de KnockoutMatchCard/PhaseSection | Média | Baixo | Testes co-localizados existem; atualizar junto com implementação |
| `Intl.DateTimeFormat` inconsistente em SSR vs browser | Baixa | Baixo | Formatação de data apenas no cliente ("use client") |

---

## 6. Ambiguities and gaps

1. **`cache.ts` comportamento em parse error:** precisa verificar antes de mudar schema se o read-through trata `ZodError` como cache miss ou propaga.
2. **`kickoffAt` obrigatório vs opcional no schema público:** se obrigatório, snapshots stale causam 500 até recomputar. Se opcional, frontend precisa exibir fallback ("Data a confirmar").
3. **Venue:** mostrar? O usuário pediu "info da dts do jogo" (dados do jogo). Venue/cidade é natural mas não explicitamente solicitado. Assumir "sim" (enriquece sem custo).
4. **Penáltis:** Copa 2026 mata-mata resolve por pênaltis quando empate. Schema não tem esse campo. Exibir empate puro sem "(pen.)"? Aceito para esta fase.
5. **Indicador de progressão:** divisor simples com label ou algo mais rico? PRD adota divisor simples.
6. **Largura/layout desktop:** a tela atual é mobile-first. Desktop pode exibir fases em 2 colunas? Assumir mobile-first responsivo, sem layout de 2 colunas por ora.

---

## 7. Recommended implementation concerns

1. **Começar pelo cache.ts** — verificar se `ZodError` vira cache miss; se não, corrigir primeiro para evitar 500 pós-deploy de schema.
2. **Schema `kickoffAt` como opcional** é a opção mais segura: frontend degrada ("—") quando ausente; snapshots stale ainda parseiam; campo fica present em todos os derivados novos.
3. **`deriveBracket` mudança mínima**: adicionar `kickoffAt: match.kickoffAt` e `...(match.venue ? { venue: match.venue } : {})` ao KnockoutMatch construído — 2 linhas de mudança.
4. **`KnockoutMatchCard` regra de vencedor**: encapsular em helper `getWinningSide(match): "home" | "away" | "draw" | null` — testável puro.
5. **Formatação de data**: helper `formatKickoffBr(iso: string): string` em `src/features/worldcup/lib/` — reusar `toLocalDateKey` pattern de `matchesHelpers.ts`.
6. **Progressão visual**: implementar como constante `PHASE_PROGRESSION` mapeando `key → nextLabel` no `BracketView` — sem lógica de runtime, apenas dados estáticos.
7. **Testes**: priorizar testes unitários de `getWinningSide` e `formatKickoffBr`; atualizar snapshots de KnockoutMatchCard.
