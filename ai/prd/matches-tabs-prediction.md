# PRD — Matches: Tabs Temporais + Palpite no Card + Borda de Bandeira

## 1. Feature summary

Três melhorias na tela `/matches`:

1. **Tabs temporais** — substituem ou complementam a view agrupada por dia com três abas: _Anteriores_ (jogos passados), _Hoje_ (jogos do dia corrente), _Próximos_ (jogos futuros). A aba ativa filtra o conjunto de matches exibidos, mantendo o agrupamento interno por dia existente.

2. **Palpite no card** — cada `MatchCard` deve exibir o placar que o usuário apostou (`homeScore x awayScore`) quando há um palpite enviado para aquela partida. Atualmente o `CardFooter` só mostra o palpite em jogos encerrados; o dado deve aparecer para qualquer status quando houver palpite.

3. **Borda na bandeira** — o elemento `<img>` da bandeira dentro de `TeamFlag` deve receber uma borda sutil (ex.: `ring-1 ring-border`) para distinguir bandeiras de fundo branco do background do card.

---

## 2. Consolidated scope

### 2.1 Tabs temporais

- Três abas fixas: **Anteriores | Hoje | Próximos**.
- Classificação de um match em uma aba baseia-se na data UTC do `kickoffAt` comparada com a data UTC atual:
  - Anteriores: `dateKey < todayDateKey`
  - Hoje: `dateKey === todayDateKey`
  - Próximos: `dateKey > todayDateKey`
- O componente `shadcn/ui Tabs` (`src/components/ui/tabs.tsx`) já existe no projeto — usar diretamente.
- Aba padrão ao carregar: **Hoje** (se não houver jogos hoje → **Próximos**; se não houver nenhum → **Anteriores**). Lógica de default deve ser derivada dos dados, não hardcoded.
- As tabs ficam abaixo do `MatchListHeader` (busca + chips de filtro), acima do conteúdo agrupado.
- Chips de filtro avançado (stage, predictionStatus, teamId) **continuam funcionando** e filtram dentro da aba ativa.
- A busca por nome **também** filtra dentro da aba ativa.

### 2.2 Palpite no card

- `MatchListItem` (tipo exportado por `useMatchesList`) deve incluir `userPrediction: { homeScore: number; awayScore: number } | null`.
- Em `useMatchesList`, ao montar o `flatList`, fazer lookup do palpite do usuário pela `matchId` e popular o campo.
- `MatchList.tsx` deve passar `userPrediction={item.userPrediction}` ao renderizar `<MatchCard>`.
- No `CardFooter` de `MatchCard`, exibir o palpite mesmo para jogos **não-encerrados** quando `predictionStatus === "enviado"`. Exemplo de layout: linha discreta abaixo do badge — "Seu palpite: 2 x 1".
- Para `predictionStatus === "pendente"` ou `"bloqueado"` sem palpite → nada adicional.
- Para `status === "finished"` — comportamento existente se mantém (seção de resultado + palpite).

### 2.3 Borda de bandeira

- `TeamFlag` (`MatchCard.tsx`): adicionar classe de borda ao `<img>` (ex.: `ring-1 ring-border/50 rounded-sm`).
- Fallback de iniciais não precisa de borda (já tem `bg-muted`).

---

## 3. System understanding relevant to this feature

### Componentes impactados
| Arquivo | Papel |
|---|---|
| `src/features/matches/components/MatchList.tsx` | Compositor principal da página; mantém estado de filtros; renderiza tabs + conteúdo |
| `src/features/matches/components/MatchCard.tsx` | Card de jogo; `TeamFlag`, `CardFooter` |
| `src/features/matches/hooks/useMatchesList.ts` | View-model; produz `MatchListItem[]`; orquestra `useMatches + useTeams + usePredictions` |
| `src/features/matches/lib/matchesHelpers.ts` | Funções puras: `groupMatchesByDay`, `deriveMatchPredictionStatus` |
| `src/components/ui/tabs.tsx` | shadcn Tabs — já disponível |

### Dados disponíveis
- `Prediction.matchId`, `.homeScore`, `.awayScore` — todos presentes no schema `predictionSchema`.
- `usePredictions(uid)` retorna `Prediction[]` — disponível no compositor.
- `groupMatchesByDay` produz seções com `date: "yyyy-MM-dd"` e `label`; a classificação Anteriores/Hoje/Próximos deriva naturalmente desse `dateKey` comparado com o `todayDateKey` calculado com `now`.

### Prop `userPrediction` em `MatchCard`
- O tipo `MatchCardProps` já declara `userPrediction?: { homeScore: number; awayScore: number } | null` — o campo existe na interface mas **não está sendo passado** por `MatchList.tsx`.
- `CardFooter` já consome `userPrediction` **mas só no bloco `isFinished`**.

---

## 4. Technical impact analysis

### 4.1 `useMatchesList.ts`
- Adicionar `userPrediction: { homeScore: number; awayScore: number } | null` ao tipo `MatchListItem`.
- No step 9 do compositor (build de `flatList`), adicionar lookup:
  ```ts
  const predMap = new Map(predictions.map(p => [p.matchId, p]));
  // por match:
  const pred = predMap.get(match.id);
  userPrediction: pred ? { homeScore: pred.homeScore, awayScore: pred.awayScore } : null
  ```
- Custo: O(n) extra na construção do Map, não relevante (centenas de matches no máximo).

### 4.2 `MatchList.tsx`
- Novo estado: `activeTab: "anteriores" | "hoje" | "proximos"` com derivação de default.
- Nova função pura de classificação temporal das seções: `classifySection(dateKey, todayDateKey)`.
- As tabs filtram `filteredGroups` já produzidos pelo pipeline de filtro existente — a classificação temporal é **a última etapa** do pipeline, depois de busca + filtros avançados.
- Passagem do `userPrediction` para `MatchCard`.

### 4.3 `MatchCard.tsx`
- `TeamFlag`: adicionar `ring-1 ring-border/50` ao `<img>`.
- `CardFooter`: exibir palpite para jogos **não-encerrados** quando `userPrediction != null`. Nova seção condicional acima do divider ou abaixo do badge.

### 4.4 `matchesHelpers.ts`
- Possível: extrair helper `toUtcDateKey` como exported (está atualmente como função interna).
- Alternativa: duplicar a lógica inline em `MatchList.tsx` (simples, 1 linha).
- Nenhuma mudança de assinatura pública necessária.

### 4.5 Testes
- `useMatchesList.test.ts`: verificar que `userPrediction` é populado corretamente.
- `MatchList.test.tsx` (se existir `MatchListHeader.test.tsx`): testar renderização das tabs e mudança de aba.
- `MatchCard.test.tsx`: verificar borda na bandeira e exibição do palpite em variante não-encerrado.

---

## 5. Risks

| Risco | Severidade | Mitigação |
|---|---|---|
| Aba padrão errada (ex.: "Hoje" sem jogos hoje pula para "Próximos" mas Copa acabou) | Baixa | Lógica: Hoje → Próximos → Anteriores; fallback claro |
| Regressão nos filtros avançados: tab + stage + predictionStatus combinados podem produzir empty state confuso | Média | Empty state existente mostra mensagem de "tente limpar os filtros"; cobrir em teste |
| `userPrediction` null em jogos enviados (lookup falha): Map por matchId é correto apenas se `p.matchId === match.id` — verificar que os ids usados são byte-idênticos (ESPN matchId = prediction matchId) | Média | IDs já validados como idênticos (arquitetura PRD-13, TASK-02); adicionar assertion em teste |
| Borda de bandeira altera layout em modo dark: `ring-border/50` usa token semântico, correto para ambos os temas | Baixa | Verificar visualmente em dark mode |
| Palpite exibido para jogo ao vivo (status `live`, predictionStatus `bloqueado` mas havia palpite): `MatchCard` passa `userPrediction` mas `CardFooter` decidia por `isFinished`; nova lógica deve tratar `live` separadamente | Média | Definir: palpite visível para `status === "live"` quando `userPrediction != null`? Sim — usuário quer ver o que apostou mesmo ao vivo |

---

## 6. Ambiguities and gaps

| Gap | Impacto | Decisão necessária |
|---|---|---|
| **Posição exata das tabs na UI**: "abaixo de todas as fases" — abaixo do header de chips ou abaixo do conteúdo de fases? | Médio | Interpretar como: abaixo do `MatchListHeader` (chips + busca), acima da lista de jogos. Confirmar |
| **Tabs substituem agrupamento por dia ou convivem?** | Alto | Interpretação: tabs são filtro temporal; dentro de cada aba os grupos por dia continuam iguais (ex.: aba Anteriores mostra "22 de junho", "23 de junho"...) |
| **Palpite no card: só para jogos "enviado" ou também mostrar "sem palpite" como info?** | Baixo | Só mostrar quando há palpite (`userPrediction != null`); caso contrário nada além do badge existente |
| **Filtros avançados interagem com tabs?** | Médio | Sim — filtros funcionam dentro da aba ativa. Alternativa: limpar filtros ao trocar de aba (mais simples, menos surpreendente). Recomenda-se limpar |
| **Contagem de badges de filtro inclui a tab ativa?** | Baixo | Não — tab é dimensão separada de filtro, não conta no `filtersCount` |

---

## 7. Recommended implementation concerns

1. **Classificação temporal deve ser função pura** — extrair `classifyDateKey(dateKey, todayKey): "anteriores" | "hoje" | "proximos"` em `matchesHelpers.ts` para ser testável isoladamente.

2. **Default da aba ativa** — derivar do `flatList` após carregamento; não assumir "Hoje" estaticamente. Usar `useMemo` no compositor.

3. **Limpar filtros ao trocar de aba** — evitar estado inconsistente (ex.: filtro por seleção que não tem jogos na aba destino → confunde o empty state).

4. **`userPrediction` no `MatchListItem`** — adicionar ao tipo e ao compositor em um único commit; não deixar o campo no tipo sem popular (causaria bugs silenciosos com `undefined !== null`).

5. **Borda de bandeira** — usar `ring-1 ring-border/50 rounded-sm` para manter consistência com o `rounded-sm` já aplicado. Verificar dark mode.

6. **Palpite no card (não-encerrado)** — exibir de forma discreta: linha pequena "Seu palpite: 2 x 1" com `text-xs text-muted-foreground` abaixo do badge, para não competir visualmente com o horário/placar.
