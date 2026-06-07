# Plano de Release — Fundação Arquitetural (PRD-00)

> Projeto: **Bolão dos Parças**  
> Milestone: **PRD-00 — Fundação Arquitetural**  
> Data do plano: 2026-06-05  
> Status: PLANO APENAS — nenhum comando de deploy deve ser executado a partir deste documento sem revisão e aprovação manual.

---

## 1. Resumo do Release

Este release implanta a **fundação de infraestrutura** do Bolão dos Parças no ambiente Firebase de produção (`world-cup-betting-pool-8e93c`). Trata-se de um marco de engenharia, não de uma feature visível ao usuário final.

### O que está incluso

| Componente | Status |
|---|---|
| Scaffold Next.js 15 + React 19 + TypeScript strict + Tailwind v4 + Shadcn | Implementado |
| Libs obrigatórias + provedores globais (React Query, Auth, Toaster) | Implementado |
| Firebase client + admin SDK inicializado (projeto real `world-cup-betting-pool-8e93c`) | Implementado |
| Schemas Zod das 9 coleções Firestore | Implementado |
| Firestore Security Rules (controle por `status`/`role`, 25 testes no emulador) | Implementado |
| Cloud Functions (esqueleto + integração API-Football, mock/fallback, 44 testes) | Implementado |
| Firebase Hosting via exportação estática (`output: export`, diretório `out/`) | Implementado |
| App shell mobile-first (BottomNav/SideNav, AuthGuard, telas placeholder) | Implementado |

**Total de testes passando:** 175 (106 unitários raiz + 25 regras Firestore + 44 functions).

### O que NÃO está incluso neste release

- Telas funcionais de login/cadastro/aprovação (escopo PRD-01).
- O aplicativo **não é utilizável por usuários finais** neste momento — apenas a infraestrutura e o app shell placeholder são implantados.
- Lógica de palpites, rankings, estatísticas, notificações.
- Sync completo de dados reais da Copa 2026.

---

## 2. Pré-requisitos Manuais (DEVEM ocorrer antes do deploy)

Os itens abaixo requerem ação humana no Firebase Console ou na máquina local. Nenhum script automatiza estas etapas.

### 2.1 Firebase Console — Criar Banco Firestore

1. Acessar [Firebase Console](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/firestore).
2. Clicar em **"Criar banco de dados"**.
3. Selecionar modo de produção (as regras serão implantadas via CLI logo em seguida).
4. Região recomendada: **`southamerica-east1`** (São Paulo) — menor latência para usuários brasileiros e alinhado com o uso esperado de < 100 usuários.
5. Confirmar criação.

> Atenção: a região do Firestore é irreversível após a criação. Escolher `southamerica-east1` é a recomendação definitiva.

### 2.2 Firebase Console — Habilitar Auth Email/Senha

1. Acessar [Authentication > Sign-in method](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/authentication/providers).
2. Habilitar o provedor **Email/Password**.
3. Salvar.

> Embora o fluxo de login/cadastro venha no PRD-01, a funcionalidade de Auth precisa estar habilitada para que o AuthGuard e os provedores funcionem corretamente na fundação.

### 2.3 Firebase CLI — Autenticação

Executar na máquina que realizará o deploy:

```bash
firebase login
```

Verificar o projeto ativo:

```bash
firebase projects:list
```

Confirmar que `world-cup-betting-pool-8e93c` aparece na lista.

### 2.4 Variáveis de Ambiente de Produção (NEXT_PUBLIC_*)

As variáveis `NEXT_PUBLIC_*` são **baked** no build estático — devem estar presentes no ambiente no momento do `build:hosting`. Criar ou verificar o arquivo `.env.production` (nunca commitar — deve existir apenas localmente na máquina de deploy):

```
NEXT_PUBLIC_FIREBASE_API_KEY=<valor_real>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=world-cup-betting-pool-8e93c.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=world-cup-betting-pool-8e93c
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=world-cup-betting-pool-8e93c.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<valor_real>
NEXT_PUBLIC_FIREBASE_APP_ID=<valor_real>
```

Verificar em [Firebase Console > Configurações do Projeto > Seus apps](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/settings/general).

### 2.5 Secret Manager — Chave API-Football

A `API_FOOTBALL_KEY` **não pode** ser commitada nem salva em `.env`. Ela deve ser configurada via Google Cloud Secret Manager para uso pelas Cloud Functions:

```bash
firebase functions:secrets:set API_FOOTBALL_KEY --project world-cup-betting-pool-8e93c
# Digitar o valor quando solicitado
```

Verificar se o secret foi criado:

```bash
firebase functions:secrets:access API_FOOTBALL_KEY --project world-cup-betting-pool-8e93c
```

> Se a chave ainda não foi adquirida, as Functions **ainda funcionarão em modo mock/fallback** — o deploy não será bloqueado.

### 2.6 Plano Firebase — Blaze (Pay as you go)

Cloud Functions e chamadas HTTP de saída (API-Football) **exigem** o plano Blaze. Verificar em [Firebase Console > Uso e faturamento](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/usage).

Se o projeto ainda estiver no plano Spark, fazer upgrade para Blaze antes de implantar as Functions. Para < 100 usuários, o custo esperado é praticamente zero (dentro dos limites do free tier do Blaze).

---

## 3. Sequência de Deploy (ordem obrigatória)

### Passo 0 — Autenticação e verificação

```bash
firebase login --project world-cup-betting-pool-8e93c
firebase projects:list
```

### Passo 1 — Deploy das Regras Firestore + Índices

```bash
firebase deploy --only firestore:rules,firestore:indexes --project world-cup-betting-pool-8e93c
```

**Por que primeiro:** as regras definem o contrato de segurança. O banco já deve existir (pré-requisito 2.1). Implantar regras antes de qualquer dado garante que nenhum dado fica desprotegido.

Verificar no Firebase Console que as regras foram aplicadas corretamente em [Firestore > Regras](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/firestore/rules).

### Passo 2 — Deploy das Cloud Functions

```bash
firebase deploy --only functions --project world-cup-betting-pool-8e93c
```

**Pré-condição:** plano Blaze ativo + secret `API_FOOTBALL_KEY` criado (ou Functions funcionarão em modo mock).

Verificar no [Firebase Console > Functions](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/functions) que as funções aparecem como `ATIVA`.

### Passo 3 — Build do Hosting (exportação estática)

```bash
# Na raiz do projeto, com .env.production presente
npm run build:hosting
```

Este script executa `rimraf .next out && next build`, gerando o diretório `out/` com os 9 arquivos HTML estáticos.

**Verificar saída esperada:**
```
Route (app)                    Size
┌ ○ /                          ...
├ ○ /home                      ...
├ ○ /login                     ...
├ ○ /matches                   ...
├ ○ /pending                   ...
├ ○ /predictions                ...
├ ○ /profile                   ...
└ ○ /rankings                  ...
```

Se o build falhar, **não prosseguir para o Passo 4**.

### Passo 4 — Deploy do Hosting (canal de staging primeiro)

**4a — Deploy no canal de preview (staging):**

```bash
firebase hosting:channel:deploy staging --project world-cup-betting-pool-8e93c
```

Isso gera uma URL temporária do tipo `https://world-cup-betting-pool-8e93c--staging-<hash>.web.app`. Executar o checklist de smoke test (Seção 8) nesta URL antes de prosseguir.

**4b — Deploy no canal live (produção):**

```bash
firebase deploy --only hosting --project world-cup-betting-pool-8e93c
```

URL de produção: `https://world-cup-betting-pool-8e93c.web.app` (ou domínio customizado, se configurado).

---

## 4. Estratégia de Rollout

### Contexto

Este release é de **fundação, sem usuários reais ainda**. O risco de impacto ao usuário final é zero. A estratégia de rollout pode ser simples e direta.

### Abordagem recomendada: Backend-first com validação por canal

1. **Backend primeiro (Passos 1 e 2):** regras + functions são implantadas antes do frontend. Se algo falhar no backend, o frontend antigo (inexistente, neste caso) não é afetado.

2. **Validação via canal de preview (Passo 4a):** antes de ir ao canal live, o build é publicado num canal de staging temporário. Isso permite executar o smoke test completo (Seção 8) numa URL real com Firebase real, sem expor ao público.

3. **Go live (Passo 4b):** após validação do staging, o deploy final vai para o canal live.

### Rollout gradual de usuários

Desnecessário neste momento — não há usuários. A feature flag de acesso por `status: approved` nas regras Firestore já garante que, mesmo quando usuários se cadastrarem (PRD-01), apenas aprovados têm acesso ao conteúdo interno.

---

## 5. Configuração e Segredos

### Variáveis por categoria

| Variável | Onde vive | Quem acessa |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | `.env.production` local → baked no build | Browser (público, intencional) |
| `API_FOOTBALL_KEY` | Google Cloud Secret Manager | Cloud Functions (server-side somente) |
| Service Account JSON | Apenas local, nunca commitado | Admin SDK (local dev / CI) |
| `.firebaserc` | Commitado | Firebase CLI (project alias) |

### Regras críticas

- A `API_FOOTBALL_KEY` **nunca** deve ser commitada nem exposta em variável de ambiente pública (`NEXT_PUBLIC_*`).
- O arquivo de service account (`.json`) é estritamente local. Para CI/CD futuro, usar OIDC ou Workload Identity Federation.
- As variáveis `NEXT_PUBLIC_*` são publicamente visíveis no bundle JavaScript gerado — isso é esperado e seguro para configuração Firebase (proteção é via Firestore Rules e Auth, não via obscuridade das chaves de cliente).

---

## 6. Riscos e Mitigações

### R1 — Primeiro run real contra o Firestore de produção

**Risco:** testes foram executados exclusivamente no emulador. O primeiro deploy pode revelar discrepâncias de comportamento (índices compostos ausentes, shapes de documento diferentes, CORS em callable functions).

**Mitigação:**
- Usar o canal de preview (Passo 4a) como staging real antes do live.
- Verificar manualmente o smoke test da Seção 8 no canal de staging.
- Monitorar [Firebase Console > Firestore > Uso](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/firestore/usage) após o deploy.
- Se erros de índice ocorrerem, o Firebase Console sugere o índice necessário diretamente — criar e reimplantar `firestore:indexes`.

### R2 — API-Football: quota e fixtures da Copa 2026 inexistentes

**Risco:** A API-Football pode não ter fixtures da Copa do Mundo 2026 ainda; a chave pode não estar adquirida; a quota gratuita pode ser insuficiente.

**Mitigação:**
- As Cloud Functions implementam **mock/fallback** — se a API retornar erro ou a chave estiver ausente, dados mocados são utilizados. O deploy não é bloqueado.
- O deploy de Functions pode ocorrer mesmo sem `API_FOOTBALL_KEY` configurado (modo mock ativo).
- Quando a Copa 2026 começar e os dados existirem, basta configurar o secret e reimplantar.

### R3 — Exportação estática (sem SSR/API Routes)

**Risco:** A arquitetura usa `output: export` (Next.js static export). Isso significa sem SSR, sem API Routes Next.js, sem middleware dinâmico. Funcionalidades que exijam servidor Node.js não são suportadas neste modelo de hosting.

**Mitigação:**
- Esta limitação é **conhecida e aceita** pela arquitetura. Todo processamento server-side usa Cloud Functions Firebase, não API Routes Next.js.
- A limitação está documentada no PRD-00 como gap R3.
- Nenhuma feature planejada requer SSR puro — o modelo Cloud Functions cobre a necessidade.

### R4 — Primeiro enforcement real das Firestore Security Rules

**Risco:** As regras foram testadas no emulador (25/25 passando), mas comportamentos sutis podem diferir em produção (ex: campos `null` vs ausentes, timestamps de servidor).

**Mitigação:**
- Verificar smoke test com usuário de teste criado via console (Seção 8, item 5).
- Monitorar [Firestore > Monitoramento de regras](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/firestore/rules) nas primeiras horas.
- Se uma regra bloquear operação legítima, reimplantar regras corrigidas (rollback em segundos).

### R5 — Custos inesperados (plano Blaze)

**Risco:** A ativação do plano Blaze expõe o projeto a custos imprevistos caso haja uso inesperado.

**Mitigação:**
- Configurar alertas de orçamento no [Google Cloud Billing](https://console.cloud.google.com/billing) — recomendado R$ 10–50/mês de limite de alerta.
- Para < 100 usuários, o custo real esperado é próximo de zero (dentro dos free tiers do Blaze para Firestore, Functions e Hosting).
- As regras Firestore bloqueiam acesso não autenticado, prevenindo uso abusivo.

---

## 7. Plano de Rollback

### Hosting

**Opção A — Reverter para release anterior via Firebase:**

```bash
firebase hosting:rollback --project world-cup-betting-pool-8e93c
```

**Opção B — Re-deploy de um canal anterior:**

```bash
# Listar canais disponíveis
firebase hosting:channel:list --project world-cup-betting-pool-8e93c

# Re-promover canal de staging para live
firebase hosting:clone world-cup-betting-pool-8e93c:staging world-cup-betting-pool-8e93c:live
```

> Neste release inicial, não há versão anterior para reverter. O rollback de hosting é relevante a partir do segundo deploy em diante.

### Firestore Rules

As regras têm histórico de versões no Firebase Console. Para reverter:

1. Acessar [Firestore > Regras](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/firestore/rules).
2. Clicar em **"Histórico de regras"**.
3. Selecionar a versão anterior e publicar.

Ou via CLI, reimplantando o arquivo `firestore.rules` da versão desejada (via git):

```bash
git checkout <commit-anterior> -- firestore.rules
firebase deploy --only firestore:rules --project world-cup-betting-pool-8e93c
```

### Cloud Functions

**Reverter para versão anterior (se houver):**

```bash
# Re-deploy da versão anterior via git
git checkout <commit-anterior> -- functions/
firebase deploy --only functions --project world-cup-betting-pool-8e93c
```

**Remover funções problemáticas (caso extremo):**

```bash
firebase functions:delete nomeDaFuncao --project world-cup-betting-pool-8e93c
```

> Para este release inicial (primeiro deploy), a alternativa de rollback é simplesmente não completar o deploy ou aguardar correção antes de re-implantar.

---

## 8. Checklist de Smoke Test Pós-Deploy

Executar preferencialmente no **canal de staging** antes do live, e repetir pontos críticos após o live.

### 8.1 App carrega corretamente

- [ ] Acessar a URL do app (staging ou live).
- [ ] A página raiz `/` carrega sem erros de console (F12 > Console).
- [ ] A página `/login` renderiza o placeholder de login (botão/campo visível).
- [ ] Nenhum erro de "Firebase: No Firebase App" ou "Missing or insufficient permissions".

### 8.2 Verificar regras Firestore — acesso negado sem auth

- [ ] Abrir o Firebase Console > Firestore > **Playground de regras**.
- [ ] Simular leitura em `/users` sem autenticação → deve retornar `DENIED`.
- [ ] Simular leitura em `/teams` sem autenticação → deve retornar `DENIED` (ou `ALLOWED` se regra permite leitura pública de times — verificar conforme `firestore.rules`).

### 8.3 Criar usuário de teste via console

- [ ] Acessar [Authentication > Usuários](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/authentication/users).
- [ ] Criar manualmente um usuário de teste com email/senha.
- [ ] No Firestore, criar manualmente o documento `users/<uid>` com campos:
  ```json
  {
    "uid": "<uid-do-usuario>",
    "email": "teste@exemplo.com",
    "displayName": "Usuário Teste",
    "role": "user",
    "status": "pending",
    "createdAt": "<timestamp-atual>"
  }
  ```

### 8.4 Verificar guard de redirecionamento

- [ ] Com o usuário de teste em `status: pending`, acessar o app autenticado.
- [ ] Confirmar que o AuthGuard redireciona para `/pending` (tela de aguardando aprovação).
- [ ] Alterar o documento do usuário para `status: approved`.
- [ ] Recarregar o app — confirmar redirecionamento para `/home`.

### 8.5 Verificar regras negam acesso a usuário bloqueado

- [ ] Alterar o documento do usuário para `status: blocked`.
- [ ] Recarregar o app — confirmar que o AuthGuard redireciona para tela de acesso bloqueado.
- [ ] Verificar no Firebase Console > Firestore > Monitoramento de regras que a leitura de dados internos foi negada.

### 8.6 Disparar callable function syncTeams (autenticado)

- [ ] Com o usuário em `status: approved`, disparar a callable function `syncTeams` via Firebase Console > Functions > **Testar função**, ou via código temporário no console do browser:

```javascript
// No console do browser (F12), com usuário logado:
const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/12.14.0/firebase-functions.js');
const functions = getFunctions(firebase.app(), 'southamerica-east1');
const syncTeams = httpsCallable(functions, 'syncTeams');
const result = await syncTeams();
console.log(result.data);
```

- [ ] Verificar no Firestore que a coleção `teams` foi populada (mesmo que com dados mock/fallback).
- [ ] Confirmar nos logs da Function ([Firebase Console > Functions > Logs](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/functions/logs)) que a execução ocorreu sem erro fatal.

### 8.7 Verificar logs de Functions

- [ ] Acessar [Firebase Console > Functions > Logs](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/functions/logs).
- [ ] Confirmar ausência de erros `INTERNAL` ou `PERMISSION_DENIED` não esperados.

---

## 9. Critérios de Go / No-Go

### Go (prosseguir com o deploy live)

- [x] Todos os 175 testes passando localmente (confirmado no `ai/local-env/report.md`).
- [x] Build estático `npm run build:hosting` gera `out/` sem erros.
- [ ] Pré-requisitos manuais (2.1 a 2.6) todos concluídos.
- [ ] Deploy de regras + functions executado sem erros de CLI.
- [ ] Smoke test no canal de staging (Seção 8, itens 8.1 a 8.4) passou.

### No-Go (bloquear o deploy live)

- [ ] Build `build:hosting` falha.
- [ ] Deploy de `firestore:rules` retorna erro de sintaxe ou conflito.
- [ ] Deploy de `functions` retorna erro de compilação ou runtime na inicialização.
- [ ] Smoke test no staging mostra acesso não autorizado (dados vazando sem auth).
- [ ] Erros de `INTERNAL` em funções callable no staging.
- [ ] Plano Blaze não ativo (deploy de Functions seria rejeitado pelo Firebase).

---

## Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-05 | Plano inicial — PRD-00 Fundação Arquitetural |
