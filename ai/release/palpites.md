# Plano de Release — Palpites (PRD-04)

> Projeto: **Bolão dos Parças**
> Milestone: **PRD-04 — Palpites**
> Feature: `palpites`
> Branch: `feat/integracao-api-football`
> Data do plano: 2026-06-07
> Status: PLANO APENAS — nenhum comando de deploy deve ser executado sem revisão e aprovação manual.

---

## 1. Resumo do Release

### O que está sendo liberado

Feature completa de palpites de placar exato para a Copa 2026. Usuários aprovados podem criar e editar palpites antes do kickoff; após o início da partida, o palpite fica bloqueado. A pontuação (binária: placar exato = 1, qualquer outro = 0) é calculada a posteriori via endpoint protegido, disparado por agendador externo.

| Componente | Commits | Status |
|---|---|---|
| TASK-01 — Schema `predictions` estendido (`status`/`points` opcionais) + `predictionInputSchema` | implícito nos commits de tasks subsequentes | Aprovado |
| TASK-02 — Funções puras: `isPredictionLocked`, `scorePrediction`, `derivePredictionDisplayStatus`, `predictionLabels` | implícito | Aprovado |
| TASK-03 — Route Handler `POST /api/predictions` (upsert com lock server-side via Admin SDK) | `c44f1d2` | Aprovado |
| TASK-04 — Route Handler `POST /api/predictions/score` (pontuação binária idempotente; paralelo; `x-cron-secret` OU sessão admin) | `c7c7e0c` + `efe2894` | Aprovado |
| TASK-05 — Security Rules: `predictions` write = `false`; read = `isApproved()` | `8315e93` | Aprovado |
| TASK-06 — Client service fetch (`upsertPrediction`) + hooks de mutação (`useUpsertPrediction`) com invalidação cruzada | `80d1a6f` + `8c70631` | Aprovado |
| TASK-07 — Telas: `/matches/[id]/predict` (form + estado bloqueado/registrado) | `16d15f4` + `891e822` + `0a6f294` + `8fc2b09` | Aprovado |
| TASK-08 — Tela: `/predictions` (lista + filtros por chips, `localStorage`) + entrada no nav | `76eee1a` + `fa870fc` | Aprovado |
| TASK-09 — CTA contextual + bloco "Meu Palpite" no detalhe de jogo (`MatchDetailActions`) | `98fcfbb` + `b275c3c` | Aprovado |
| Documentação de env vars (`SCORE_SECRET`, `API_FOOTBALL_KEY`) em `.env.local.example` | `dfda406` | Incluído |

**Totais de qualidade no momento do plano:**
- Testes: **1238 passando, 0 falhas** (vitest run)
- TypeScript: `tsc --noEmit` sem erros
- Lint: ok (sem erros bloqueadores)
- Build: `next build` gera **22 rotas** sem erros
- Firestore Rules: **34** testes passando (emulador)

### O que NÃO está incluso neste release

- **Configuração do agendador externo (cron):** infra/deploy fora do código. O endpoint `POST /api/predictions/score` existe e está protegido, mas sem cron configurado a pontuação automática não ocorre (ver Risco R7).
- **Ranking automático:** PRD próprio (rankings/estatísticas) consumirá os campos `points`/`status` gravados por esta feature.
- **Palpites bônus** (`bonus_predictions`: campeão, artilheiro etc.).
- **Delete de palpite:** fora do escopo (só create + update).
- **Deploy do `apphosting.yaml`:** a migração de Firebase Hosting estático para App Hosting (Cloud Run/SSR) pertence à branch `feat/integracao-api-football` como um todo — este plano cobre apenas a parte de palpites. O deploy completo da branch requer `apphosting.yaml` configurado (ver Seção 3.4).

---

## 2. DECISÃO CRÍTICA: Deploy requer App Hosting, não Hosting estático (BLOQUEADOR #1)

**Esta é a decisão mais importante antes de prosseguir.**

### O problema

A feature PRD-04 usa **Route Handlers Next.js** (`POST /api/predictions`, `POST /api/predictions/score`) com `export const runtime = "nodejs"` e `dynamic = "force-dynamic"`. Esses endpoints **não funcionam com Firebase Hosting + static export** (`output: "export"`) — exigem um servidor Node.js em execução contínua.

O arquivo `next.config.ts` já removeu o `output: "export"` e documenta a migração para **Firebase App Hosting** (Cloud Run). No entanto, o arquivo `apphosting.yaml` ainda não existe no repositório.

### Opções

| Opção | Descrição | Recomendação |
|---|---|---|
| **A — Configurar App Hosting antes do deploy** | Criar `apphosting.yaml`, configurar o backend no Firebase Console e fazer deploy via App Hosting | **Recomendada** — única forma de os Route Handlers funcionarem |
| **B — Segurar** | Não fazer merge/deploy até que `apphosting.yaml` esteja pronto e testado | Aceitável se houver risco de configuração apressada |

**Recomendação:** Opção A. O App Hosting é pré-requisito inegociável para qualquer Route Handler. Sem ele, `POST /api/predictions` retorna 404 ou não é servido pelo CDN estático.

---

## 3. Pré-requisitos Obrigatórios (TODOS antes do deploy)

### 3.1 Firebase App Hosting — configurar backend SSR

O projeto não usa mais `output: "export"`. O deploy deve ser feito via **Firebase App Hosting** (Cloud Run gerenciado).

**3.1a — Criar backend no Firebase Console:**

1. Acessar [Firebase Console → App Hosting](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/apphosting).
2. Clicar em **"Começar"** ou **"Adicionar backend"**.
3. Conectar ao repositório GitHub (`feat/integracao-api-football` ou branch de release).
4. Configurar região: `southamerica-east1` (São Paulo) — consistente com o Firestore.
5. Confirmar. O Firebase gera automaticamente um `apphosting.yaml` mínimo ou aceitar o que for criado.

**3.1b — Criar `apphosting.yaml` no repositório (se ainda não gerado):**

```yaml
# apphosting.yaml — Firebase App Hosting (Cloud Run/SSR)
runConfig:
  runtime: nodejs20
  minInstances: 0   # cost-optimized for < 100 users

env:
  - variable: SCORE_SECRET
    secret: SCORE_SECRET     # referência ao Secret Manager
  - variable: API_FOOTBALL_KEY
    secret: API_FOOTBALL_KEY # referência ao Secret Manager
  - variable: FIREBASE_SERVICE_ACCOUNT_KEY
    secret: FIREBASE_SERVICE_ACCOUNT_KEY
```

> Adaptar ao esquema atual do `apphosting.yaml` do Firebase App Hosting. Consultar a [documentação oficial](https://firebase.google.com/docs/app-hosting/configure) para a versão mais recente.

### 3.2 Secret Manager — variáveis de ambiente SERVER-ONLY (BLOQUEADOR #2)

As variáveis abaixo são **segredos server-only** e nunca devem ser commitadas. Devem estar configuradas no Google Cloud Secret Manager **antes** do deploy de App Hosting — o backend não sobe sem elas se referenciadas no `apphosting.yaml`.

#### 3.2a — SCORE_SECRET (NOVA — obrigatória para PRD-04)

Segredo que protege o endpoint `POST /api/predictions/score`. O cron externo envia este valor no header `x-cron-secret`.

```bash
# Gerar o segredo (openssl recomendado):
openssl rand -base64 32
# Exemplo de saída: "x7Kp9mQ3rL2nWv8yZj4tUh6sEqDfGc1=" (não usar este valor)

# Registrar no Secret Manager:
gcloud secrets create SCORE_SECRET --project world-cup-betting-pool-8e93c
echo -n "<valor-gerado>" | gcloud secrets versions add SCORE_SECRET --data-file=- --project world-cup-betting-pool-8e93c

# Verificar:
gcloud secrets versions access latest --secret="SCORE_SECRET" --project world-cup-betting-pool-8e93c
```

> Guardar o valor em local seguro (gerenciador de senhas). Este mesmo valor será configurado no agendador externo (Seção 6).

#### 3.2b — API_FOOTBALL_KEY (já existente da integração)

```bash
# Se ainda não configurado:
gcloud secrets create API_FOOTBALL_KEY --project world-cup-betting-pool-8e93c
echo -n "<sua-chave-api-football>" | gcloud secrets versions add API_FOOTBALL_KEY --data-file=- --project world-cup-betting-pool-8e93c
```

#### 3.2c — FIREBASE_SERVICE_ACCOUNT_KEY (Admin SDK)

Necessário para o Admin SDK (`getAdminAuth()`, `getAdminFirestore()`) nos Route Handlers.

```bash
# Gerar service account em Firebase Console → Configurações do Projeto → Contas de serviço
# Baixar JSON e registrar como secret (UMA linha sem quebra):
gcloud secrets create FIREBASE_SERVICE_ACCOUNT_KEY --project world-cup-betting-pool-8e93c
cat service-account.json | tr -d '\n' | gcloud secrets versions add FIREBASE_SERVICE_ACCOUNT_KEY --data-file=- --project world-cup-betting-pool-8e93c
# Remover o arquivo local após registrar
rm service-account.json
```

### 3.3 Deploy das Firestore Rules atualizadas (BLOQUEADOR #3)

As rules de `predictions` foram alteradas em TASK-05: **write agora é `false`** (Admin SDK bypassa; cliente nunca escreve). Sem este deploy, qualquer write client-direto em `predictions` ainda seria permitido pelas rules antigas.

```bash
npm run deploy:rules
# Equivale a:
# firebase deploy --only firestore:rules,firestore:indexes --project world-cup-betting-pool-8e93c
```

**Verificar** no Firebase Console → Firestore → Regras que a coleção `predictions` mostra `allow write: if false`.

> Executar **antes** do deploy da aplicação. Não há janela de vulnerabilidade percebida (write client-direto não era usado antes), mas o alinhamento rules-app é obrigatório.

### 3.4 Variáveis de cliente (`NEXT_PUBLIC_*`)

Confirmadas desde PRD-00. Sem novas variáveis NEXT_PUBLIC para PRD-04. Verificar que o `.env` de produção (ou as variáveis no painel do App Hosting) continua com os valores corretos:

```
NEXT_PUBLIC_FIREBASE_API_KEY=<valor_real>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=world-cup-betting-pool-8e93c.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=world-cup-betting-pool-8e93c
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=world-cup-betting-pool-8e93c.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<valor_real>
NEXT_PUBLIC_FIREBASE_APP_ID=<valor_real>
```

---

## 4. Sequência de Deploy (ordem obrigatória)

```
Passo 0 — Autenticação e verificação
Passo 1 — Deploy de Firestore Rules + Índices (CRÍTICO, antes de tudo)
Passo 2 — Configurar secrets no Secret Manager (SCORE_SECRET + demais)
Passo 3 — Configurar e criar backend App Hosting
Passo 4 — Deploy via App Hosting (canal de preview)
Passo 5 — Smoke test no preview (Seção 7)
Passo 6 — Promover para live
Passo 7 — Configurar agendador externo (cron) pós-deploy
```

### Passo 0 — Autenticação

```bash
firebase login
firebase projects:list
# confirmar world-cup-betting-pool-8e93c
gcloud auth login
gcloud config set project world-cup-betting-pool-8e93c
```

### Passo 1 — Regras e índices Firestore

```bash
npm run deploy:rules
# firebase deploy --only firestore:rules,firestore:indexes --project world-cup-betting-pool-8e93c
```

Verificar no Firebase Console → Firestore → Regras: `predictions` tem `allow write: if false`.

**Não prosseguir** se o deploy de rules retornar erro de sintaxe.

### Passo 2 — Secrets (ver Seção 3.2)

Executar os comandos `gcloud secrets` para `SCORE_SECRET`, `API_FOOTBALL_KEY` e `FIREBASE_SERVICE_ACCOUNT_KEY` conforme a Seção 3.2. Verificar que cada secret tem pelo menos uma versão `ACTIVE`.

### Passo 3 — Backend App Hosting

Criar o backend via Firebase Console (Seção 3.1) e garantir que `apphosting.yaml` está commitado na branch de release com as referências corretas aos secrets.

### Passo 4 — Deploy (canal de preview)

O App Hosting detecta o push na branch conectada e aciona o deploy automaticamente, OU:

```bash
firebase apphosting:backends:create --project world-cup-betting-pool-8e93c
# Ou via CLI do App Hosting se disponível:
firebase deploy --only apphosting --project world-cup-betting-pool-8e93c
```

Aguardar o build finalizar no Firebase Console → App Hosting → Build log. Verificar ausência de erros de compilação.

### Passo 5 — Smoke test no preview

Usar a URL de preview gerada pelo App Hosting. Executar o checklist da Seção 7.

### Passo 6 — Promover para live

Após smoke test positivo, promover o deploy de preview para live via Firebase Console → App Hosting → Releases → Promover, ou aguardar deploy automático da branch principal.

### Passo 7 — Configurar cron externo (pós-deploy, ver Seção 6)

**A pontuação automática depende deste passo.** Sem ele, `POST /api/predictions/score` existe mas não é chamado automaticamente.

---

## 5. Estratégia de Rollout

### Contexto

Bolão dos Parças tem menos de 100 usuários (público fechado, sem rollout gradual necessário). O controle de acesso por `status: approved` já protege todas as rotas internas via `AuthGuard` + middleware.

### Estratégia: backend-first com validação por canal de preview

1. **Rules + secrets primeiro (Passos 1–2):** sem nenhum impacto visual ao usuário. Alinha a segurança antes da aplicação estar disponível.
2. **Canal de preview antes do live (Passos 4–5):** URL real com Firebase real, sem exposição ao público. Smoke test completo antes de promover.
3. **Go live (Passo 6):** todos os usuários passam a ter a feature ativa.
4. **Cron pós-live (Passo 7):** configurar logo após o deploy live para não deixar janela de jogos finalizados sem pontuação.

### Janela de risco

Durante o deploy (entre Passo 1 e Passo 6), as rules já negam write client-direto, mas o Route Handler ainda não está disponível. Janela: typically < 5 minutos. Palpites feitos nesta janela falhariam graciosamente (toast de erro no cliente). Dado o público pequeno e horário de deploy controlado, o risco é mínimo.

---

## 6. Agendador Externo (Cron) — Configuração Pós-Deploy

**Sem o agendador, a pontuação automática não roda.** O critério R7 do PRD é satisfeito apenas com o cron em execução.

### Opção A — Cloud Scheduler (Google Cloud, recomendada)

```bash
# Criar job de pontuação (executa diariamente às 02:30, horário de Brasília)
gcloud scheduler jobs create http score-predictions \
  --project world-cup-betting-pool-8e93c \
  --location southamerica-east1 \
  --schedule "30 2 * * *" \
  --time-zone "America/Sao_Paulo" \
  --uri "https://<URL_DO_APP_HOSTING>/api/predictions/score" \
  --http-method POST \
  --headers "x-cron-secret=<VALOR_DO_SCORE_SECRET>,Content-Type=application/json" \
  --message-body "{}"

# Verificar:
gcloud scheduler jobs list --project world-cup-betting-pool-8e93c --location southamerica-east1

# Testar manualmente:
gcloud scheduler jobs run score-predictions \
  --project world-cup-betting-pool-8e93c \
  --location southamerica-east1
```

> Substituir `<URL_DO_APP_HOSTING>` pela URL real gerada (ex.: `https://world-cup-betting-pool-8e93c--default.southamerica-east1.hosted.app`).
> Substituir `<VALOR_DO_SCORE_SECRET>` pelo segredo gerado na Seção 3.2a.

**Horário recomendado:** 02:30 (horário de Brasília). Os resultados da API-Football chegam 15–30 minutos após o fim dos jogos; a ingestão de resultados (PRD-07) roda às 02:00. O score de palpites às 02:30 garante que os dados de resultado já estejam no cache.

### Opção B — GitHub Actions (alternativa simples)

```yaml
# .github/workflows/score-predictions.yml
name: Score Predictions
on:
  schedule:
    - cron: '30 5 * * *'  # 02:30 BRT = 05:30 UTC
  workflow_dispatch:        # disparar manualmente também

jobs:
  score:
    runs-on: ubuntu-latest
    steps:
      - name: Call score endpoint
        run: |
          curl -X POST \
            -H "x-cron-secret: ${{ secrets.SCORE_SECRET }}" \
            -H "Content-Type: application/json" \
            -d '{}' \
            "https://<URL_DO_APP_HOSTING>/api/predictions/score"
```

> Adicionar `SCORE_SECRET` como secret do repositório GitHub (Settings → Secrets → Actions).

### Fallback manual (admin)

Enquanto o cron não estiver configurado, o admin pode disparar a pontuação manualmente autenticado no app (sessão admin) via:

```bash
curl -X POST \
  -H "Cookie: __session=<SESSION_COOKIE_ADMIN>" \
  "https://<URL>/api/predictions/score"
```

Ou diretamente no browser com a sessão admin ativa (DevTools → Network → enviar requisição POST para `/api/predictions/score`).

---

## 7. Checklist de Smoke Test Pós-Deploy

Executar no **canal de preview** antes de promover para live. Repetir itens críticos após live.

### 7.1 App e autenticação

- [ ] URL do preview carrega sem erros de console (F12 → Console).
- [ ] `/login` renderiza corretamente.
- [ ] Login com usuário `approved` redireciona para `/home`.
- [ ] Login com usuário `pending` redireciona para `/pending`.
- [ ] Botão "Sair" funciona.

### 7.2 Lista de Palpites (`/predictions`)

- [ ] Aba "Palpites" no BottomNav navega para `/predictions`.
- [ ] Sem palpites: estado empty "Nenhum palpite ainda" (sem crash).
- [ ] Com palpites (criar um antes — ver 7.3): card aparece com jogo, data, placar e badge de status.
- [ ] Chips de filtro (`Todos`, `Pendentes`, `Acertos`, `Erros`, `Bloqueados`) aparecem e filtram corretamente.
- [ ] Chip ativo persiste após recarregar (localStorage).

### 7.3 Criar palpite (fluxo principal)

- [ ] Navegar para `/matches` → selecionar um jogo **não iniciado** → clicar em "Enviar Palpite".
- [ ] Rota `/matches/[id]/predict` carrega com steppers de gols (Mandante e Visitante).
- [ ] Ajustar os steppers e clicar em "Salvar Palpite".
- [ ] Estado de sucesso ("Seu palpite foi salvo com sucesso.") aparece com o placar confirmado.
- [ ] Botão "Voltar para Jogos" funciona.
- [ ] O badge de palpite no card do jogo (em `/matches`) atualiza (não mostra estado anterior).
- [ ] O bloco "Meu Palpite" no detalhe do jogo exibe o placar salvo.

### 7.4 Editar palpite

- [ ] Acessar `/matches/[id]/predict` de um jogo com palpite existente.
- [ ] Campos pré-preenchidos com o placar atual.
- [ ] Alterar placar e clicar em "Atualizar Palpite".
- [ ] Sucesso e atualização correta do badge e bloco.

### 7.5 Palpite bloqueado (após kickoff)

- [ ] Tentar criar/editar palpite de jogo com `kickoffAt` no passado (ou `status != scheduled`).
- [ ] Tela exibe estado "O prazo para este jogo foi encerrado." sem campos editáveis.
- [ ] CTA no detalhe do jogo mostra "Palpite bloqueado" sem botão de ação.

### 7.6 Segurança — write client-direto negado

- [ ] No console do browser (F12 → Console), com usuário aprovado logado:
  ```javascript
  const { getFirestore, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js');
  const db = getFirestore();
  await setDoc(doc(db, 'predictions', 'test'), { homeScore: 1 });
  // Deve retornar PERMISSION_DENIED
  ```
- [ ] Confirmar que a operação retorna `FirebaseError: Missing or insufficient permissions`.

### 7.7 Endpoint de pontuação — protegido

- [ ] `POST /api/predictions/score` sem header → 401 (não autorizado).
- [ ] `POST /api/predictions/score` com `x-cron-secret` errado → 401.
- [ ] `POST /api/predictions/score` com `x-cron-secret` correto → 200 `{ scoredMatches, updatedPredictions }`.

### 7.8 Pontuação manual (score)

- [ ] Com pelo menos uma partida `finished` e palpites existentes, chamar `POST /api/predictions/score` com o `SCORE_SECRET`.
- [ ] Resposta inclui `scoredMatches > 0` e `updatedPredictions >= 0`.
- [ ] Na `/predictions`, palpites do jogo terminado mostram badge "Acertou" ou "Errou" (dependendo do resultado).

### 7.9 Sem chamada direta à API-Football

- [ ] Aba Network do DevTools: nenhuma request para `v3.football.api-sports.io` ou `api-football.com` originada do browser.

### 7.10 Responsividade

- [ ] Mobile (390px): steppers do formulário com alvos de toque ≥ 44px, layout correto.
- [ ] Desktop (1024px): lista de palpites e formulário sem overflow.

---

## 8. Riscos e Mitigações

### BLOQUEADOR-1 — App Hosting não configurado

**Risco:** Sem `apphosting.yaml` e backend App Hosting, os Route Handlers Next (`/api/predictions`, `/api/predictions/score`) não são servidos. O deploy de Firebase Hosting estático retornaria 404 para esses endpoints.
**Mitigação:** Configurar o backend App Hosting antes de qualquer deploy (Seções 3.1 e 4, Passo 3).
**Probabilidade:** Alta (apphosting.yaml ainda não existe no repo).
**Impacto:** Crítico (feature inteira não funciona).

### BLOQUEADOR-2 — `SCORE_SECRET` ausente no servidor

**Risco:** Se `SCORE_SECRET` não estiver configurado no App Hosting/Secret Manager, o endpoint retorna 401 para qualquer chamada sem sessão admin. O cron não consegue pontuar.
**Mitigação:** Configurar o secret antes do deploy (Seção 3.2a). O endpoint tem fallback de sessão admin, então o admin ainda consegue pontuar manualmente.
**Probabilidade:** Alta (secret novo, criado apenas para PRD-04).
**Impacto:** Alto (pontuação automática não roda; fallback manual disponível).

### BLOQUEADOR-3 — Firestore Rules desatualizadas

**Risco:** Rules antigas podem ainda permitir write client-direto em `predictions`. Sem deploy das rules atualizadas, a regra `allow write: if false` não está ativa em produção.
**Mitigação:** Deploy de rules obrigatório como Passo 1 da sequência (Seção 4).
**Probabilidade:** Certa (rules foram alteradas em TASK-05 e ainda não deployadas).
**Impacto:** Alto (segurança: usuário poderia gravar `status`/`points` diretamente).

### R4 — Lock temporal: relógio do cliente vs. servidor

**Risco:** Usuário com relógio local errado vê estado de lock incorreto na UI (derivado de `kickoffAt` vs `Date.now()`). A interface pode parecer "desbloqueada" quando o jogo já começou.
**Mitigação:** O lock autoritativo está no servidor (Route Handler verifica `isPredictionLocked` com `new Date()` do servidor). Mesmo que a UI não bloqueie, o Route Handler rejeita com 423. O cliente exibe toast de erro "Prazo encerrado".
**Probabilidade:** Baixa (maioria dos usuários tem relógio correto; NTP).
**Impacto:** Baixo (tentativa bloqueada no servidor; sem dados inconsistentes).

### R5 — Pontuação automática não dispara (R7 do PRD)

**Risco:** Sem cron configurado (Seção 6), `POST /api/predictions/score` nunca é chamado automaticamente. Os campos `status`/`points` ficam indefinidos; a lista de palpites mostra sempre "Pendente" para jogos finalizados. Rankings/estatísticas (PRDs futuros) não conseguem consumir dados de pontuação.
**Mitigação:** Configurar cron imediatamente após o deploy live (Passo 7). Fallback: admin pode disparar manualmente via sessão autenticada. Comunicar ao admin a necessidade do cron.
**Probabilidade:** Certa se o Passo 7 for esquecido.
**Impacto:** Alto (critério de aceite de pontuação automática não satisfeito); fallback disponível.

### R6 — Ranking automático fora do escopo

**Risco:** PRD-04 grava `points`/`status` nos docs de `predictions`, mas **não atualiza** as coleções `rankings` nem `statistics`. O ranking continuará mostrando dados desatualizados até que o PRD de rankings seja implementado.
**Mitigação:** Documentado como out-of-scope. PRD de rankings (PRD-05) consumirá os campos `points` gravados por esta feature. Nenhuma ação necessária no release de PRD-04.
**Probabilidade:** Não é um risco — é uma limitação conhecida e documentada.
**Impacto:** Médio para a experiência final do usuário; nenhum impacto técnico em PRD-04.

### R7 — Idempotência do endpoint de pontuação em partidas sem resultado

**Risco:** Se a ingestão de resultados (PRD-07) ainda não atualizou os campos `homeScore`/`awayScore` de uma partida `finished`, `scorePrediction` retorna `wrong`/0 para todos (placar 0x0 vs. resultado real). Re-rodar após ingestão corrigida restaura o valor correto (função pura + set merge), mas há janela de dados inconsistentes.
**Mitigação:** Garantir que o cron de pontuação rode **após** o cron de ingestão de resultados (horário 02:30 BRT vs. 02:00 BRT). Idempotência garante correção após re-execução.
**Probabilidade:** Baixa se os horários dos crons forem respeitados.
**Impacto:** Médio temporário (dados transitoriamente incorretos durante janela entre crons).

### R8 (Não-bloqueador) — Custo de Cloud Scheduler

**Risco:** Cloud Scheduler tem custos mínimos (3 jobs grátis/projeto no plano Spark; sem limite adicional no Blaze).
**Mitigação:** 1 job (score-predictions) está dentro do free tier. Sem impacto de custo.
**Impacto:** Nenhum.

---

## 9. Plano de Rollback

### Hosting / App Hosting

**Reverter para versão anterior via Firebase Console:**

1. Acessar Firebase Console → App Hosting → Histórico de releases.
2. Selecionar a release anterior ao PRD-04.
3. Clicar em "Reverter" ou "Promover para live".

**Tempo estimado:** < 5 minutos (App Hosting propaga via Cloud Run).

### Firestore Rules

Se as regras novas causarem problema inesperado (ex.: bloquear read legítimo):

```bash
# Reverter para versão anterior via git:
git checkout <commit-anterior-ao-task-05> -- firestore.rules
firebase deploy --only firestore:rules --project world-cup-betting-pool-8e93c
```

Ou via Firebase Console → Firestore → Regras → Histórico → selecionar versão anterior → Publicar.

**Tempo estimado:** < 2 minutos.

### Cron (Cloud Scheduler)

```bash
# Pausar o job (sem deletar):
gcloud scheduler jobs pause score-predictions \
  --project world-cup-betting-pool-8e93c \
  --location southamerica-east1

# Ou deletar:
gcloud scheduler jobs delete score-predictions \
  --project world-cup-betting-pool-8e93c \
  --location southamerica-east1
```

### Critério para acionar rollback

- `/predictions` exibe tela branca (crash) para usuário approved em produção.
- `POST /api/predictions` retorna 500 para todos os palpites (não apenas para jogos bloqueados).
- Firestore Rules bloqueando leitura legítima de `predictions` para usuários approved.
- Dados de `predictions` sendo corrompidos (ex.: `status`/`points` sobrescritos com valores inválidos).

---

## 10. Critérios de Go / No-Go

### Go (prosseguir com deploy live)

- [x] 1238 testes passando localmente (vitest run).
- [x] `tsc --noEmit` sem erros.
- [x] `next build` gera 22 rotas sem erros.
- [x] Lint ok (sem erros bloqueadores).
- [x] Firestore Rules: 34 testes passando (emulador).
- [ ] `apphosting.yaml` criado e commitado na branch de release.
- [ ] Secrets (`SCORE_SECRET`, `API_FOOTBALL_KEY`, `FIREBASE_SERVICE_ACCOUNT_KEY`) configurados no Secret Manager.
- [ ] Deploy de `firestore:rules` executado sem erros.
- [ ] Smoke test no canal de preview aprovado (Seção 7, todos os itens).
- [ ] Decisão §2 tomada (App Hosting configurado).

### No-Go (bloquear deploy live)

- [ ] `apphosting.yaml` ausente (Route Handlers não funcionam no Hosting estático).
- [ ] `SCORE_SECRET` ausente no servidor (cron não conseguirá pontuar).
- [ ] Deploy de `firestore:rules` retorna erro de sintaxe ou conflito.
- [ ] Smoke test 7.6 falha (write client-direto permitido = falha de segurança).
- [ ] Smoke test 7.3 falha (não é possível criar palpite via Route Handler).
- [ ] Console mostra chamadas diretas à API-Football originadas do browser.
- [ ] Smoke test 7.7 falha (endpoint de pontuação público = falha de segurança).

---

## 11. Tarefas Pós-Release

| Tarefa | Prioridade | PRD/Contexto |
|---|---|---|
| Configurar cron externo para `POST /api/predictions/score` (Cloud Scheduler ou GitHub Actions) | **Alta** | Seção 6 — sem isso pontuação automática não roda |
| Implementar PRD de Rankings (consome `points`/`status` dos palpites) | Alta | PRD-05 |
| Implementar PRD de Estatísticas (consome dados de palpites) | Alta | PRD-06 |
| Remover pasta `functions/` legada (Cloud Functions em desuso desde arquitetura PRD-07 v2.0) | Média | Tech debt — não bloqueia |
| Adicionar botão admin "Calcular Pontuação" na UI do painel admin (disparo manual via sessão) | Média | UX para admin enquanto cron não é configurado |
| Revisar horário do cron de score vs. cron de ingestão de resultados (PRD-07) para garantir ordem | Média | R7 desta seção |
| Monitorar logs do App Hosting nos primeiros jogos da Copa para verificar pontuação | Alta | Operacional |

---

## Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-07 | Plano inicial — PRD-04 Palpites |
