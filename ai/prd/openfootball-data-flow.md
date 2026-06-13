# PRD — Auditoria e Reconciliação do Fluxo openfootball

## 1. Feature summary

Auditoria completa do fluxo de dados de partidas (openfootball → Firestore → rankings) e
entrega de mecanismo de detecção de divergência entre resultados manuais e os oficiais
publicados pelo openfootball. O objetivo imediato é esclarecer o estado atual e, a seguir,
garantir que o admin saiba quando um override manual ficou desatualizado em relação à fonte
oficial.

---

## 2. Consolidated scope

### 2.1 Como o fluxo funciona hoje (estado confirmado no código)

```
openfootball JSON (GitHub raw)
  └─ HttpCopaDataClient.getData()          → fetch HTTP, cache Next.js 1h (REVALIDATE_MATCHES=3600)
       └─ fetchAllMatches()                 → mapeia → MatchWithId[]  (base ao vivo)
            └─ getEffectiveMatches()
                 ├─ base = fetchAllMatches()
                 └─ persisted = readPersistedMatches()   (Firestore `matches/*`)
                       Override? isManualOverride===true → persisted[id] vence base
                       Demais? persisted ignorado — base ao vivo é usado
```

**Dois caminhos para dados chegarem em `matches/{id}`:**

| Caminho | Rota | Resultado no Firestore |
|---|---|---|
| Sync global | `POST /api/admin/worldcup/sync` | Todos os matches → `isManualOverride: false` |
| Edição manual | `PUT /api/admin/matches/[id]` | Jogo específico → `isManualOverride: true` |

**Critério de leitura em `getEffectiveMatches()`:**
- Apenas docs com `isManualOverride === true` substituem a base do openfootball.
- Docs sincronizados (`isManualOverride: false`) existem no Firestore mas são **ignorados** no read path.

**Determinação de status (mapper.ts `mapStatus`):**
- `score.ft` ausente → `"scheduled"` (jogo não encerrado)
- `score.ft` presente → `"finished"` (jogo encerrado com placar)
- **Não existe estado `"live"`** — o openfootball não informa jogos em andamento.

### 2.2 O que o usuário fez

Ao perceber que o openfootball não havia publicado `score.ft` para determinadas partidas,
o admin usou `PUT /api/admin/matches/[id]` (via `EditMatchDialog`) para salvar os resultados
manualmente. Esses docs agora têm `isManualOverride: true` no Firestore e são servidos pelo
`getEffectiveMatches()` para ranking, predictions e home.

### 2.3 Estado atual dos dados

| Cenário | Onde está o dado efetivo |
|---|---|
| Jogo não editado e openfootball tem resultado | openfootball ao vivo (cache 1h) |
| Jogo editado manualmente | Firestore `matches/{id}` (`isManualOverride: true`) |
| Jogo não editado e openfootball sem resultado ainda | openfootball ao vivo (scheduled) |
| Após sync (`/sync`) | Firestore tem cópia, mas `getEffectiveMatches` **ainda usa a base ao vivo** para jogos sem override |

### 2.4 Mecanismo de recálculo de ranking

O `recalc.ts` implementa dois gatilhos:

1. **Manual-edit trigger**: `PUT /api/admin/matches/[id]` chama `recalcRankingsBestEffort()` inline.
2. **Dirty-by-finish (on-read)**: `ensureRankingsFresh()` computa `computeFinishedSignature()`
   sobre `getEffectiveMatches()` e recomputa se a assinatura divergir do doc `rankings/_freshness`.
   Detecta quando o openfootball publica `score.ft` em jogos sem override manual.

### 2.5 Escopo desta feature

1. **Diagnóstico** (já feito neste PRD) — entender exatamente o que está no banco e o que vem do openfootball.
2. **Detecção de divergência** — identificar quando o openfootball publica um resultado que difere de um override manual.
3. **Painel admin** — surfaçar overrides manuais desatualizados para o super_admin tomar ação.
4. *(Opcional v2)* Reconciliação automática com confirmação do admin.

---

## 3. System understanding relevant to this feature

### Módulos diretamente afetados

| Módulo | Papel |
|---|---|
| `src/server/copaData/` | Fonte primária: HTTP client + mapper + `matchSource.ts` (overlay) |
| `src/server/rankings/recalc.ts` | Usa `getEffectiveMatches()` — ranking depende de qual fonte vence |
| `src/app/api/admin/worldcup/sync/route.ts` | Sync openfootball → Firestore (não sobrescreve overrides) |
| `src/app/api/admin/matches/[id]/route.ts` | PUT: override manual; DELETE: remove override (volta ao openfootball) |
| `src/features/superAdmin/components/WorldCupMatches.tsx` | UI admin de partidas |
| `src/features/superAdmin/hooks/useAdminMatches.ts` | Dados do painel de partidas |

### Coleções Firestore relevantes

| Coleção | Conteúdo |
|---|---|
| `matches/{id}` | Override manual (`isManualOverride: true`) **OU** cópia do sync (`false`) |
| `rankings/_freshness` | Assinatura dos finalizados do último recalc (dirty-by-finish guard) |
| `sync_logs` | Histórico de syncs (matchesUpdated, matchesSkipped, status) |
| `worldcup_cache/{groups,bracket}` | Cache derivado; invalidado em cada sync/edit |

### Cache Next.js (CRÍTICO)

`REVALIDATE_MATCHES = 3600` (1h). Após o openfootball publicar um resultado, o sistema leva
até **60 minutos** para enxergar a mudança no `fetchAllMatches()`. O dirty-by-finish só
dispara depois que o cache expira.

---

## 4. Technical impact analysis

### 4.1 Fluxo de dados afetado

```
openfootball publica score.ft
  → até 1h: fetchAllMatches() ainda retorna scheduled (cache Next.js)
  → depois de 1h: fetchAllMatches() retorna finished com placar oficial
       ↓
  getEffectiveMatches():
    ├─ Se NÃO há override manual → oficial entra, dirty-by-finish detecta, recalc dispara ✓
    └─ Se HÁ override manual    → oficial É IGNORADO, override permanece ativo indefinidamente ⚠
```

### 4.2 Divergência silenciosa (risco crítico)

Quando openfootball publica um placar diferente do override manual:
- `computeFinishedSignature()` não muda (porque `getEffectiveMatches()` ainda retorna o override)
- O dirty-by-finish **não dispara**
- O ranking permanece calculado com o resultado manual — possivelmente divergente do oficial
- O admin não recebe nenhum alerta
- Só é corrigido se o admin acessar o painel e deletar o override manualmente

### 4.3 Impacto no ranking

- Rankings foram calculados com os resultados manuais inseridos pelo admin.
- Se o openfootball publicou resultados IGUAIS aos manuais → nenhum impacto.
- Se publicou resultados DIFERENTES → ranking está incorreto e não recalcula sozinho.

### 4.4 Módulos consumidores de `getEffectiveMatches()`

| Consumidor | Consequência de override desatualizado |
|---|---|
| `recalc.ts` | Pontua palpites com placar manual errado |
| `/api/matches` e `/api/matches/[id]` | Exibe placar errado para usuários |
| `/api/worldcup/groups` e `/api/worldcup/bracket` | Standings calculados com placar errado |
| Home dashboard (recentResults, nextMatch) | Exibe placar errado no feed recente |

---

## 5. Risks

| # | Risco | Severidade | Status |
|---|---|---|---|
| R1 | Override manual diverge de resultado oficial sem alerta ao admin | Alta | **Ativo** |
| R2 | Cache 1h atrasa visibilidade de resultados openfootball — dirty-by-finish lento | Média | Latente |
| R3 | Admin não sabe quais partidas estão com override ativo sem checar o código | Média | **Ativo** |
| R4 | Se sync for executado, ele **não sobrescreve** overrides manuais — mesmo que o openfootball já tenha resultado diferente | Alta | **Ativo** |
| R5 | DELETE de override por engano antes de confirmar o placar oficial | Baixa | Mitigável |
| R6 | Rankings calculados antes de override ser deletado ficam defasados sem recalc manual | Média | Latente |

---

## 6. Ambiguities and gaps

### G1 — Quais partidas estão com override ativo agora?
Não há forma rápida na UI de listar apenas partidas com `isManualOverride === true`. O admin
precisa navegar jogo a jogo no painel. É necessário filtro/badge no `WorldCupMatches.tsx`.

### G2 — O openfootball já publicou resultados iguais ou diferentes dos manuais?
Não temos um mecanismo que compare os dois. Antes de decidir o que construir, o admin deve
verificar no painel quais jogos têm override e comparar com o JSON do openfootball.

### G3 — Quais jogos foram editados manualmente?
A coleção `matches` tem `editedBy` e `editedAt` para rastreabilidade, mas a UI não surfaça
isso de forma proeminente.

### G4 — Quando remover overrides manuais?
Não há política definida: após o openfootball confirmar? Automaticamente? Com aprovação?
Precisa de decisão antes de implementar reconciliação automática.

### G5 — Ranking está correto hoje?
Se os resultados manuais coincidem com o que o openfootball publicou, o ranking está certo.
Se divergem, há erro. Não temos visibilidade disso sem comparação explícita.

---

## 7. Recommended implementation concerns

### 7.1 Diagnóstico imediato (sem código)
Antes de qualquer implementação, o admin deve:
1. Acessar painel super_admin → partidas
2. Identificar quais têm badge "Manual" (se já existe) ou checar diretamente no Firestore
3. Comparar com `https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json`
4. Se placar idêntico → nenhuma ação necessária; se diverge → deletar override para aceitar oficial

### 7.2 Task 1 — Painel com filtro + badge de override
Adicionar ao `WorldCupMatches.tsx`:
- Badge visual "Manual" em jogos com `isManualOverride: true`
- Filtro "Mostrar apenas overrides" para listar rapidamente
- Data/autor da edição (`editedAt`, `editedBy`) visíveis na linha
- Comparação inline: placar manual vs. placar openfootball atual (requer coluna extra)

### 7.3 Task 2 — Detecção de divergência no sync
Modificar `POST /api/admin/worldcup/sync`:
- Para cada match com `isManualOverride: true`: comparar placar manual vs. base openfootball
- Se diverge e openfootball tem `score.ft` → registrar em `sync_logs` como "divergência detectada"
- Retornar `matchesDiverged` no payload de resposta
- UI do sync exibe alerta quando há divergências

### 7.4 Task 3 — Alerta de divergência no painel
Após o sync detectar divergências (Task 2):
- Exibir banner no painel de partidas: "X partidas com resultado manual divergem do openfootball oficial"
- CTA: "Revisar divergências" filtra a lista para os casos divergentes
- Admin decide: manter override ou aceitar oficial (DELETE do override)

### 7.5 Task 4 (opcional) — Auto-reconciliação configurável
Flag em `system_settings`: `autoReconcileOverrides: boolean`.
Se `true`: sync remove overrides quando openfootball publica placar idêntico ou quando
a diferença for de apenas normalização (sem impacto em pontuação). Requer análise cuidadosa
de edge cases antes de implementar.

### 7.6 Cache
Considerar reduzir `REVALIDATE_MATCHES` de 3600s para ~300s durante a fase ativa do torneio
para diminuir a janela de blindspot entre fim de jogo e detecção de divergência.
Trade-off: mais requests ao GitHub raw (gratuito, sem rate limit significativo para esse volume).
