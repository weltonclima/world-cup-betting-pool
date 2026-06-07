# Plano de Release — Home Dashboard (PRD-02)

> Projeto: **Bolão dos Parças**
> Milestone: **PRD-02 — Home Dashboard**
> Feature: `home-dashboard`
> Branch: `feat/prd-01-auth`
> Data do plano: 2026-06-07
> Status: PLANO APENAS — nenhum comando de deploy deve ser executado sem revisão e aprovação manual.

---

## 1. Resumo do Release

### O que está sendo liberado

Painel `/home` read-only pós-login para usuários `approved`. A rota e o shell (`AppShell` + `AuthGuard` + `BottomNav` + `Header`) existiam como placeholder desde PRD-01; este release preenche o conteúdo com 8 cards de dados, estados de loading/error/empty, e a camada de serviços Firestore que alimenta todos os PRDs futuros.

| Componente | Commits | Status |
|---|---|---|
| TASK-01 — Schemas alinhados à API-Football (`venue`, `round`, `"terceiro"`) | e2111ff + e5bf184 + dc08d06 | Aprovado (TASK-01 review) |
| TASK-02 — Mapeadores API-Football → domínio (`mapMatchStatus`, `parseRound`) | 69d00c6 | Aprovado (TASK-02 review) |
| TASK-03 — Camada de serviços Firestore (6 serviços; índices compostos) | e843758 | Aprovado (TASK-03 review) |
| TASK-04 — Seed de desenvolvimento | Supersedido — ver §4 DECISÃO CRÍTICA | Congelado |
| TASK-05 — Hooks TanStack Query + compositor `useHomeDashboard` | 7fac98a + 25182b8 | Aprovado com ajustes (W-04, W-05 não-bloqueadores) |
| TASK-06 — HomeHeader (saudação, avatar por iniciais, sino estático) | 175ccf0 + 2789c69 | Aprovado |
| TASK-07 — Cards de métrica (Ranking, Acertos, Aproveitamento, Desempenho) | 3b380f0 | Aprovado |
| TASK-08 — Cards de jogo/fase (Próximo Jogo, Últimos Resultados, Fase Atual) | f89ea02 | Aprovado |
| TASK-09 — Card Avisos (derivado de `system_settings`) | 407b751 | Aprovado |
| TASK-10 — Página `/home`: composição + estados loading/error/empty | 46273c0 + 6ef6318 | Aprovado com ajustes (WR-01 loading agregado, IN-01 texto empty não-bloqueadores) |
| Fixes de review (TASK-05/06/07/08/09) | 0f427af | Aplicados |

**Totais de qualidade no momento do plano:**
- Testes: **590 passando, 0 falhas** (vitest run)
- TypeScript: `tsc --noEmit` sem erros
- Build estático: `build:hosting` gera **13 rotas estáticas** no diretório `out/`
- Lint: 2 warnings não-bloqueadores (NextMatchCard `<img>` raw; `useHomeDashboard` exhaustive-deps — ver §6 Dívida Técnica)

### O que NÃO está incluso

- Ingestão de dados reais (TASK-04 congelada → PRD-07 futuro).
- Palpites, Rankings, Estatísticas, Perfil (telas existem como placeholders; BottomNav navega para elas).
- Notificações realtime (sino é visual/estático no MVP).
- Cloud Functions (arquitetura: static export, sem servidor; ingestão real = script Node + `firebase-admin` fora do app).

---

## 2. DECISÃO CRÍTICA: Liberar agora vs. aguardar dados (BLOQUEADOR #1)

**Esta é a decisão mais importante deste release. Não prosseguir sem deliberar.**

### O problema

TASK-04 (seed de dev) foi **congelada/supersedida** pela decisão de que dados reais virão de um script Node + `firebase-admin` (PRD-07, não implementado). Até que esse script seja executado e popule `rankings`, `statistics`, `matches`, `teams`, `predictions` e `system_settings` em produção:

- **O Home Dashboard renderizará estados vazios ou de erro em produção.**
- Nenhum card terá dados: Ranking Geral → vazio, Próximo Jogo → vazio, Últimos Resultados → lista vazia, etc.
- A tela de `/home` funciona corretamente como shell — não quebra, não trava — mas não tem utilidade para o usuário final.

### Opções

| Opção | Descrição | Recomendação |
|---|---|---|
| **A — Segurar** | Não fazer merge/deploy de PRD-02 até que a ingestão de dados exista (PRD-07) | **Recomendada** — não expor uma tela funcional mas vazia |
| **B — Liberar como shell** | Fazer merge e deploy agora; a tela existe mas mostra estados empty enquanto não há dados | Aceitável se houver expectativa clara e prazos justificarem |
| **C — Feature flag** | Merge mas esconder `/home` atrás de uma flag no `system_settings.homeEnabled` (booleano) | Aceitável como meio-termo — permite merge seguro sem exposição |

**Recomendação da equipe de engenharia:** Opção A ou C. Liberar a tela vazia (Opção B) degradará a experiência do primeiro usuário e pode criar a impressão de produto quebrado. A Copa 2026 começa em breve — priorizar PRD-07 (ingestão) antes do merge de PRD-02 é o caminho mais limpo.

---

## 3. Pré-requisitos obrigatórios

### 3.1 Antes do deploy de regras/índices

- [ ] Firebase CLI autenticado: `firebase login`
- [ ] Projeto ativo confirmado: `firebase projects:list` → `world-cup-betting-pool-8e93c`
- [ ] Arquivo `.env.production` presente localmente com todas as `NEXT_PUBLIC_FIREBASE_*` (nunca commitar)
- [ ] Decisão §2 tomada (liberar agora vs. aguardar dados)

### 3.2 Variáveis de ambiente (baked no build estático)

As variáveis `NEXT_PUBLIC_*` são compiladas no bundle estático — devem estar presentes no ambiente **no momento do `build:hosting`**:

```
NEXT_PUBLIC_FIREBASE_API_KEY=<valor_real>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=world-cup-betting-pool-8e93c.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=world-cup-betting-pool-8e93c
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=world-cup-betting-pool-8e93c.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<valor_real>
NEXT_PUBLIC_FIREBASE_APP_ID=<valor_real>
```

Sem novas variáveis de ambiente além das estabelecidas em PRD-00. Nenhuma chave de API-Football no frontend (critério de aceite duro — app nunca chama a API diretamente).

### 3.3 Dados em Firestore (BLOQUEADOR #2)

As queries de matches usam índices compostos. O Firestore **recusará as queries** com erro `missing-index` se os índices não estiverem provisionados antes do primeiro acesso.

**AÇÃO OBRIGATÓRIA — deploy de índices ANTES do hosting:**

```bash
npm run deploy:rules
# equivale a: firebase deploy --only firestore:rules,firestore:indexes --project world-cup-betting-pool-8e93c
```

Os índices necessários em `firestore.indexes.json`:

| Coleção | Campo 1 | Campo 2 | Query que serve |
|---|---|---|---|
| `matches` | `status ASC` | `kickoffAt ASC` | `getNextScheduledMatch` |
| `matches` | `status ASC` | `kickoffAt DESC` | `getRecentFinishedMatches` |

Sem esses índices implantados, qualquer usuário que acesse `/home` receberá o estado de erro do dashboard e verá o botão "Tentar Novamente" — mas a causa raiz será ausência de índice, não ausência de dados.

---

## 4. Sequência de Deploy (ordem obrigatória)

```
Passo 0 — Autenticação e verificação
Passo 1 — Deploy de regras + índices Firestore  ← CRÍTICO, antes de tudo
Passo 2 — Build estático (build:hosting)
Passo 3 — Deploy de staging (canal preview)
Passo 4 — Smoke test no staging
Passo 5 — Deploy live (apenas após smoke test passar)
```

### Passo 0 — Autenticação

```bash
firebase login
firebase projects:list
# confirmar world-cup-betting-pool-8e93c na lista
```

### Passo 1 — Regras e índices Firestore

```bash
npm run deploy:rules
# firebase deploy --only firestore:rules,firestore:indexes --project world-cup-betting-pool-8e93c
```

Verificar no Firebase Console → Firestore → Índices que os 3 índices aparecem como `Ativado` (pode levar 1–5 minutos para provisionar).

**Não avançar para o Passo 2 enquanto índices estiverem em estado `Criando`.**

### Passo 2 — Build estático

```bash
npm run build:hosting
# rimraf .next out && next build
```

Saída esperada: 13 rotas estáticas sem erros. Se o build falhar, não prosseguir.

Verificar rotas esperadas (inclui novas):
```
○ /home          ← preenchido agora (era placeholder)
○ /login
○ /signup
○ /pending
○ /forgot-password
○ /reset-password
○ /admin
○ /matches
○ /predictions
○ /rankings
○ /statistics
○ /profile
○ /              ← raiz
```

### Passo 3 — Deploy de staging (canal preview)

```bash
firebase hosting:channel:deploy prd-02-home --project world-cup-betting-pool-8e93c
```

Gera URL temporária `https://world-cup-betting-pool-8e93c--prd-02-home-<hash>.web.app`.

### Passo 4 — Smoke test no staging

Ver §7 (Checklist de Smoke Test). Executar todos os itens antes de avançar.

### Passo 5 — Deploy live

```bash
npm run deploy:hosting
# firebase deploy --only hosting --project world-cup-betting-pool-8e93c
```

URL de produção: `https://world-cup-betting-pool-8e93c.web.app`

---

## 5. Estratégia de Rollout

### Contexto de usuários

Bolão dos Parças tem menos de 100 usuários (público fechado). Não há rollout gradual necessário — o controle de acesso já é granular: apenas usuários com `status: approved` chegam à rota `/home`; `pending` e `blocked` são redirecionados pelo `AuthGuard`.

### Estratégia recomendada

**Backend-first com validação por canal preview:**

1. Índices e regras primeiro (Passo 1) — nenhum usuário é afetado se o Firestore não tiver dados ainda.
2. Canal preview antes do live (Passos 3–4) — permite smoke test real com Firebase real sem exposição.
3. Go live após smoke test positivo.

### Sobre dados ausentes

Se a decisão for liberar sem dados (Opção B do §2):
- A Home exibirá estados `empty` em todos os cards de jogo (Próximo Jogo, Últimos Resultados, Fase Atual).
- Cards de métrica (Ranking, Acertos, Aproveitamento, Desempenho) exibirão `--` ou `0` (valores neutros definidos no compositor `useHomeDashboard` para dados null).
- Nenhum estado de erro explícito ocorrerá (a ausência de dados é tratada como empty, não como erro).
- Comunicar aos usuários que dados serão populados quando a ingestão estiver pronta.

---

## 6. Riscos e Mitigações

### BLOQUEADOR-1: Nenhum dado em produção (TASK-04 congelada)

**Risco:** Home Dashboard liberado sem dados = tela funcional mas sem utilidade. Usuários veem cards vazios.
**Mitigação:** Segurar o release até PRD-07 (ingestão) existir, OU liberar com comunicação explícita, OU usar feature flag (§2).
**Probabilidade:** Certa (confirmada pela freezing de TASK-04).
**Impacto:** Alto (experiência vazia para todos os usuários).

### BLOQUEADOR-2: Índices Firestore ausentes geram erro nas queries de matches

**Risco:** Sem `deploy:rules` antes do hosting, queries `getNextScheduledMatch` e `getRecentFinishedMatches` falham com `missing-index`. Usuários veem o estado de erro do dashboard.
**Mitigação:** Sequência de deploy obrigatória (§4): regras/índices ANTES do hosting.
**Probabilidade:** Certa se a ordem não for seguida.
**Impacto:** Alto (erros em dois cards da Home para todos os usuários).

### RISCO-3: Higiene de branch — PRD-02 e PRD-01 no mesmo branch

**Risco:** `feat/prd-01-auth` contém commits de PRD-01 (auth, admin, recuperação de senha) E PRD-02 (home dashboard). Um PR direto desta branch para `main` trará todo o histórico misturado. Rastreabilidade fica comprometida.
**Mitigação:** Criar um branch limpo `feat/prd-02-home-dashboard` a partir de `main` (cherry-pick seletivo dos commits de PRD-02) ou fazer squash por feature no merge. Alternativamente, aceitar o histórico misto dado que ambos os PRDs estão revisados e aprovados.
**Probabilidade:** Não é risco de runtime — é risco de processo/rastreabilidade.
**Impacto:** Baixo para produção; médio para manutenção futura.

### RISCO-4 (Roadmap): Contradição arquitetural Cloud Functions vs. static export

**Risco:** PRD-00 menciona Cloud Functions como componente da arquitetura, mas o app usa `output: "export"` (sem servidor) e a decisão de PRD-02 é explícita: **sem Cloud Functions; ingestão real = script Node + `firebase-admin`**. Esta contradição afetará PRD-07 (ingestão) e precisa ser resolvida antes de começar aquele PRD.
**Mitigação:** Documentar a decisão arquitetural no PRD-07 antes de implementar. A arquitetura atual (script Node externo) é válida e implementável, mas precisa de formalização.
**Probabilidade:** Certa (contradição documentada).
**Impacto:** Médio (afeta PRDs futuros, não PRD-02 em si).

### RISCO-5 (Roadmap): Sistema de pontuação divergente entre PRDs

**Risco:** CLAUDE.md e PRD-00/02 definem pontuação binária (0 ou 1 ponto por placar exato). PRD-05 (Ranking) aparentemente usa 3/1/0. Essa divergência bloqueará a implementação correta de rankings e estatísticas.
**Mitigação:** Resolver antes de iniciar PRD-05. Não afeta PRD-02 (Home apenas lê `rankings` e `statistics` já calculados, não os calcula).
**Probabilidade:** A ser confirmada no PRD-05.
**Impacto:** Médio para PRD-05; zero para PRD-02.

### RISCO-6 (Não-bloqueador): Dívida técnica de lint conhecida

**Risco:** 2 warnings de lint ativos:
1. `NextMatchCard` usa `<img>` raw ao invés de `next/image` (Next.js recomenda o componente otimizado).
2. `useHomeDashboard` tem dependência ausente em `useCallback` (exhaustive-deps).

**Mitigação:** Resolver em uma PR de cleanup pós-release. Não causam erros em runtime com `output: "export"`.
**Impacto:** Baixo (warnings, não erros; sem impacto para o usuário final).

### RISCO-7 (Não-bloqueador): Loading agregado vs. por card

**Risco:** `useHomeDashboard` expõe um único `isLoading` agregado; todos os 8 cards entram em skeleton simultaneamente mesmo que alguns já tenham dados em cache (WR-01 da review de TASK-10). Tela "pisca" toda de uma vez ao invés de revelar progressivamente.
**Mitigação:** Aceitar para MVP (< 100 usuários, dados carregam rápido). Resolver em iteração futura expondo `isRankingLoading`, `isStatsLoading`, etc. no compositor.
**Impacto:** Baixo (UX sub-ótima, não erro).

---

## 7. Checklist de Smoke Test Pós-Deploy

Executar no **canal de staging** antes de promover para live. Repetir itens críticos após live.

### 7.1 App e autenticação

- [ ] URL do staging carrega sem erros de console (F12 → Console).
- [ ] `/login` renderiza corretamente.
- [ ] Login com usuário `approved` redireciona para `/home`.
- [ ] Login com usuário `pending` redireciona para `/pending`.
- [ ] Login com usuário `blocked` exibe tela de acesso bloqueado.
- [ ] Botão "Sair" funciona e retorna para `/login`.

### 7.2 Home Dashboard — estados

- [ ] `/home` com usuário `approved` carrega sem erro de console.
- [ ] Estado de **loading**: skeletons aparecem durante fetch inicial (< 500ms em rede rápida — testar com throttle no DevTools se necessário).
- [ ] Após loading: cards aparecem (com dados ou estados empty — dependendo de haver dados em Firestore).
- [ ] **Se não há dados em Firestore:** cards de jogo mostram estado empty (sem crash, sem tela branca, sem "undefined").
- [ ] **Se há dados em Firestore:** cards exibem valores — verificar pelo menos Ranking Geral e HomeHeader (nome do usuário).
- [ ] Estado de **erro** (simular desconectando da rede): mensagem de erro + botão "Tentar Novamente" aparecem. `role="alert"` presente para a11y.
- [ ] Botão "Tentar Novamente" dispara refetch e sai do estado de erro.

### 7.3 Índices Firestore

- [ ] Nenhum erro `missing-index` no console do browser.
- [ ] No Firebase Console → Firestore → Índices: os 2 índices de `matches` estão com status `Ativado`.

### 7.4 Navegação e shell

- [ ] BottomNav presente e clicável (Home, Jogos, Palpites, Rankings, Perfil).
- [ ] Navegação via BottomNav não quebra (destinos podem ser placeholders).
- [ ] Header do Admin visível para usuário `role: admin` e ausente para `role: user`.

### 7.5 Responsividade

- [ ] Mobile (390px): layout correto, cards empilhados, alvos de toque acessíveis.
- [ ] Tablet (768px): grid de métrica exibe 3 colunas.
- [ ] Desktop (1024px): layout expandido sem overflow.

### 7.6 Sem chamada direta à API-Football

- [ ] Na aba Network do DevTools: nenhuma request para `v3.football.api-sports.io` ou `api-football.com` originada do browser.

---

## 8. Plano de Rollback

### Hosting

**Reverter para versão anterior (PRD-01):**

```bash
firebase hosting:rollback --project world-cup-betting-pool-8e93c
```

Ou listar versões e escolher:

```bash
firebase hosting:releases:list --project world-cup-betting-pool-8e93c
firebase hosting:clone world-cup-betting-pool-8e93c:<versao-anterior> world-cup-betting-pool-8e93c:live
```

**Tempo estimado de rollback:** < 2 minutos (CDN Firebase propaga rapidamente).

### Firestore Índices

Os novos índices de `matches` não afetam funcionalidades existentes (PRD-01 não consulta `matches`). Não há necessidade de rollback de índices. Se necessário, deletar via Firebase Console → Firestore → Índices.

### Firestore Regras

PRD-02 não altera `firestore.rules` — apenas `firestore.indexes.json`. Sem necessidade de rollback de regras.

### Critério para acionar rollback

- `/home` exibe tela branca (crash não tratado) em produção.
- Erro de `PERMISSION_DENIED` inesperado bloqueando usuários aprovados.
- Qualquer vazamento de dados entre usuários (verificar via regras Firestore).

---

## 9. Critérios de Go / No-Go

### Go (prosseguir com deploy live)

- [x] 590 testes passando localmente (vitest run)
- [x] `tsc --noEmit` sem erros
- [x] `build:hosting` gera 13 rotas estáticas sem erros
- [x] Todas as 9 tasks revisadas e aprovadas (TASK-04 excluída por decisão de produto)
- [ ] Decisão §2 tomada (liberar agora vs. aguardar dados)
- [ ] Deploy de `firestore:indexes` executado e índices com status `Ativado`
- [ ] Smoke test no canal de staging aprovado (§7, todos os itens)

### No-Go (bloquear deploy live)

- [ ] `build:hosting` falha.
- [ ] Índices Firestore em estado `Erro` após deploy.
- [ ] Smoke test mostra acesso não autorizado (dados de outros usuários acessíveis).
- [ ] Console mostra chamadas diretas à API-Football originadas do browser.
- [ ] `/home` exibe tela branca (crash) para usuário approved com dados em Firestore.
- [ ] Decisão §2 ainda pendente e a opção escolhida for A (aguardar dados).

---

## 10. Tarefas pós-release

| Tarefa | Prioridade | PRD |
|---|---|---|
| Implementar script de ingestão real (Node + `firebase-admin` + API-Football) | Alta | PRD-07 |
| Resolver contradição arquitetural Cloud Functions vs. static export | Alta | PRD-07 |
| Resolver divergência de pontuação (binário vs. 3/1/0) | Alta | PRD-05 |
| Fix lint: `NextMatchCard` → `next/image`; `useHomeDashboard` exhaustive-deps | Baixa | Cleanup |
| Loading granular por card (WR-01): expor `isRankingLoading` etc. no compositor | Baixa | PRD-02.1 |
| `homeKeys` sem parâmetro como array literal vs. função (W-04) — decidir e documentar | Baixa | Cleanup |
| `as any` em `useHomeDashboard.test.ts` → `as unknown as UseQueryResult<T>` (W-05) | Baixa | Cleanup |

---

## Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-07 | Plano inicial — PRD-02 Home Dashboard |
