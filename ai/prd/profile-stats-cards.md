# PRD — Troca dos cards de estatísticas no perfil do ranking

## 1. Feature summary

Na tela de perfil de participante (`/ranking/[uid]`), o componente `ProfileStatsGrid` exibe atualmente três cards: **Acertos**, **Erros** e **Aproveitamento**. O pedido é substituir os dois últimos por **Vitórias** e **Empates**, mantendo "Acertos" no primeiro card.

- **Vitórias**: total de palpites em que o usuário apostou numa vitória (placar home ≠ placar away).
- **Empates**: total de palpites em que o usuário apostou num empate (placar home === placar away).

A métrica é sobre **o que o usuário palpitou** (tendência de aposta), não sobre o resultado correto ou incorreto — alinhado semanticamente ao `BettorDnaCard` já existente.

---

## 2. Consolidated scope

### Incluído
- Remover os cards **Erros** e **Aproveitamento** de `ProfileStatsGrid`.
- Adicionar os cards **Vitórias** e **Empates**, derivados de `ProfilePredictionItem[]` (campo `prediction.homeScore`/`awayScore`).
- Atualizar os testes de `ParticipantProfile.test.tsx` que verificam os rótulos dos cards.
- A contagem inclui **todos os palpites** do usuário (não só os encerrados), pois mede tendência de apostas.
- Fallback "—" ou "0" quando não há palpites carregados ainda.

### Excluído
- Nenhuma mudança no backend, Firestore, schemas ou recalc.
- Nenhuma mudança nos cards de outros contextos (Home, ranking geral, etc.).
- Nenhuma mudança no `BettorDnaCard` ou em qualquer outro componente de perfil.

---

## 3. System understanding relevant to this feature

### Componente afetado
`src/features/rankings/components/ParticipantProfile.tsx` — especificamente `ProfileStatsGrid` (linhas 232–282).

### Dados atuais em `ProfileStatsGrid`
| Card | Fonte | Valor |
|---|---|---|
| Acertos | `entry.points` | Pontos ponderados (5/10) |
| Erros | `entry.wrong ?? stats?.totalWrong` | Palpites errados |
| Aproveitamento | `entry.accuracy` | % de aproveitamento |

**Nota:** o label "Acertos" está exibindo `entry.points` (pontos ponderados), não a contagem de acertos exatos (`stats.totalCorrect`). Esse comportamento **permanece** — o PR não altera a semântica de "Acertos".

### Dados necessários para os novos cards
Os palpites já chegam ao componente pai via `predictionsQuery.items` (tipo `ProfilePredictionItem[]`).

```ts
// Derivação simples, sem chamada adicional
const wins  = items.filter(i => i.prediction.homeScore !== i.prediction.awayScore).length;
const draws = items.filter(i => i.prediction.homeScore === i.prediction.awayScore).length;
```

`ProfileStatsGrid` atualmente recebe apenas `entry` e `stats`. Precisará receber `wins` e `draws` (derivados no pai e passados como props).

### Fluxo de dados
```
useProfilePredictions(uid) → items: ProfilePredictionItem[]
  → derivar wins/draws no ParticipantProfile
    → passar para ProfileStatsGrid({ entry, stats, wins, draws })
      → renderizar 3 cards: Acertos | Vitórias | Empates
```

### Testes afetados
`src/features/rankings/components/__tests__/ParticipantProfile.test.tsx`  
- Linha 126–131: assert dos rótulos "Erros" e "Aproveitamento" devem ser trocados por "Vitórias" e "Empates".  
- Linha 119: `screen.getByText("11")` permanece (é `entry.points`, não muda).  
- Os novos cards precisam de dados mockados para renderizar valores numéricos.

---

## 4. Technical impact analysis

| Área | Impacto |
|---|---|
| `ParticipantProfile.tsx` | Derivar `wins`/`draws` de `items`; passar para `ProfileStatsGrid` |
| `ProfileStatsGrid` (sub-componente) | Trocar props + reconstruir `metrics` array |
| `ParticipantProfile.test.tsx` | Atualizar asserts de rótulos; adicionar cenários de vitórias/empates |
| Schemas / types | Nenhum |
| API / Route Handlers | Nenhum |
| Firestore / recalc | Nenhum |
| `Statistics` / `RankingEntry` | Nenhum — dados novos vêm de `ProfilePredictionItem[]` já carregado |

**Scope total:** ≤ 3 arquivos, mudança puramente de apresentação.

---

## 5. Risks

- **Regressão nos testes existentes:** o teste `"grade de métricas NÃO tem Pontos duplicado (3 células: Acertos/Erros/Aproveitamento)"` vai falhar após a troca — é um falso alarme esperado, mas precisa ser atualizado imediatamente.
- **Contagem zero:** se `items` está vazio (loading ou sem palpites feitos), os cards de Vitórias e Empates mostram `0`. É comportamento correto, mas deve ser testado.
- **Semântica de "Acertos":** o card continua exibindo `entry.points` (pontos, não contagem de acertos). Nenhuma mudança aqui, mas o label continua sendo tecnicamente impreciso. Fora do escopo deste PR.

---

## 6. Ambiguities and gaps

| Questão | Resolução adotada |
|---|---|
| Vitórias = apostas em vitória OU vitórias corretas? | **Apostas em vitória** (todos os palpites onde homeScore ≠ awayScore), independente de acerto. Mede tendência do palpiteiro. |
| Inclui só palpites encerrados? | **Todos os palpites** — a contagem é de intenção/tendência, não de resultado. |
| Fallback quando sem palpites? | Mostrar `0` (não `—`), pois `0` é um valor válido e preciso. |
| Alterar semântica do card "Acertos"? | Não — permanece `entry.points` (fora de escopo). |

---

## 7. Recommended implementation concerns

1. **Derivar no pai, não no filho:** `ProfileStatsGrid` não deve acessar `items` diretamente; recebe `wins: number` e `draws: number` como props (componente puro).
2. **Usar `useMemo`:** a derivação deve ser memoizada junto às outras derivações já existentes (`buckets`, `dna`, `predictionsCount`).
3. **Atualizar testes imediatamente:** não deixar os testes em vermelho — atualizar `ParticipantProfile.test.tsx` na mesma PR.
4. **Sem mudanças de schema:** nenhuma migração, nenhum campo novo em Firestore.
