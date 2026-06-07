# Plano de Release — Autenticação e Aprovação (PRD-01)

> Projeto: **Bolão dos Parças**
> Milestone: **PRD-01 — Autenticação e Aprovação de Usuários**
> Data do plano: 2026-06-06
> Status: PLANO APENAS — nenhum comando de deploy deve ser executado a partir deste documento sem revisão e aprovação manual.

---

## 1. Resumo do Release

Este release torna o **Bolão dos Parças utilizável por usuários reais** pela primeira vez. Ele entrega o fluxo completo de autenticação sobre a fundação PRD-00 já implantada.

### O que está incluso

| Componente | Tasks | Status |
|---|---|---|
| Schemas Zod de formulários (`loginFormSchema`, `signupFormSchema`) | TASK-01 | Implementado |
| Mapeamento de erros Firebase Auth → pt-BR | TASK-02 | Implementado |
| Primitivos UI: `AuthLogo`, `PasswordInput` | TASK-03 | Implementado |
| `refreshProfile` no `AuthProvider` | TASK-04 | Implementado |
| Cloud Function `promoteFirstAdmin` (trigger `onCreate users/{uid}`) | TASK-05 | Implementado |
| Serviços de auth: `signIn`, `signUp` (com rollback), `signOut` | TASK-06 | Implementado |
| `LoginForm` + rota `(auth)/login` funcional | TASK-07 | Implementado |
| `SignupForm` + rota `(auth)/cadastro` nova | TASK-08 | Implementado |
| Expansão de `PendingApprovalScreen` com botão "Atualizar Status" | TASK-09 | Implementado |

### Verificação de qualidade (pré-deploy confirmado)

| Check | Resultado |
|---|---|
| `vitest run` (raiz) | 170 testes passando |
| `vitest run` (functions) | 49 testes passando (inclui `promoteFirstAdmin.test.ts`) |
| `tsc --noEmit` | 0 erros |
| `next lint` | 0 erros, 0 warnings |
| `next build` | 0 erros, 0 warnings |

### O que NÃO está incluso neste release (deferred — sem blockers)

| Item | PRD destino |
|---|---|
| Recuperação de senha (A4) | Futura PRD |
| Painel admin aprovar/bloquear usuários (A7) | Futura PRD |
| `emailVerified` obrigatório (A2) | Não planejado — aprovação admin substitui |
| Unicidade de apelido (A8) | Futura PRD (se requisito confirmado) |
| Termos de Uso reais com link e persistência | Futura PRD (checkbox é gate client-only) |

---

## 2. Pré-requisitos Obrigatórios

> ATENÇÃO: os itens 2.1 e 2.2 são **hard blockers**. Nenhum deploy deve ocorrer sem eles.

### 2.1 BLOQUEANTE — Commit da base de código (git baseline zero)

**Problema:** atualmente `git ls-files` retorna 0 arquivos — **nada está commitado**. O branch `main` tem apenas um commit inicial vazio (`first commit`). Todo o código de PRD-00 e PRD-01 existe apenas como arquivos não rastreados (`??` no `git status`).

**Consequência:** sem commits, não há histórico de versão, rollback via `git checkout` é impossível, e o CI/CD futuro não tem origem.

**Ação obrigatória antes do primeiro deploy:**

```bash
# Na raiz do projeto
git add .gitignore
git add package.json package-lock.json tsconfig.json
git add next.config.ts postcss.config.mjs eslint.config.mjs
git add firebase.json firestore.rules firestore.indexes.json .firebaserc
git add src/ functions/ components.json design-system/ docs/ test/ ai/
# Revisar o que está prestes a ser commitado
git status
# Commitar a fundação PRD-00
git commit -m "feat: PRD-00 — fundação arquitetural (scaffold, Firebase, Security Rules, Functions)"
# Commitar a autenticação PRD-01
git commit -m "feat: PRD-01 — autenticação e aprovação de usuários"
```

> Cuidado: NÃO adicionar `.env.local` nem nenhum arquivo `.env.*` ao git. Verificar `.gitignore` antes do `git add`.

### 2.2 BLOQUEANTE — PRD-00 já implantado em produção

Este release **assume** que o release PRD-00 (`ai/release/feature.md`) foi executado com sucesso:

- Firestore criado na região `southamerica-east1`
- Firebase Auth Email/Password habilitado
- Security Rules implantadas (`deploy:rules`)
- Cloud Functions PRD-00 (`syncTeams`, `scheduledSync`) implantadas (`deploy:functions`)
- Firebase Hosting com app shell implantado (`deploy:hosting`)
- Plano Blaze ativo
- Secret `API_FOOTBALL_KEY` configurado no Secret Manager

Se algum desses itens não foi concluído, executar o release PRD-00 primeiro.

### 2.3 Variáveis de ambiente de build (NEXT_PUBLIC_*)

As variáveis `NEXT_PUBLIC_*` são **baked** no build estático — devem estar presentes no momento de `npm run build:hosting`. Verificar que `.env.production` (local, nunca commitado) contém:

```
NEXT_PUBLIC_FIREBASE_API_KEY=<valor_real>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=world-cup-betting-pool-8e93c.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=world-cup-betting-pool-8e93c
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=world-cup-betting-pool-8e93c.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<valor_real>
NEXT_PUBLIC_FIREBASE_APP_ID=<valor_real>
NEXT_PUBLIC_FIREBASE_USE_EMULATORS=false
```

> `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=false` é crítico — garante que o build de produção aponta para o Firebase real, não para o emulador local.

### 2.4 Firebase CLI autenticada

```bash
firebase login
firebase projects:list
# Confirmar que world-cup-betting-pool-8e93c aparece
```

---

## 3. Estratégia de Rollout

### Contexto do release

PRD-01 é o **primeiro release com usuários reais**. O primeiro usuário que se cadastrar se tornará automaticamente admin via a Cloud Function `promoteFirstAdmin`. A ordem de deploy é, portanto, crítica: a Function **deve estar ativa antes de qualquer cadastro real**.

### Estratégia: Backend-first com validação por canal de preview

```
[1] deploy:functions  →  [2] (sem rules change)  →  [3] build:hosting  →  [4] canal staging  →  [5] smoke test  →  [6] deploy:hosting live
```

1. **Functions primeiro (obrigatório):** `promoteFirstAdmin` precisa estar ativa antes de qualquer usuário se cadastrar. Deploy de functions antes do hosting.
2. **Security Rules — no-op:** as regras atuais (`firestore.rules`) já cobrem PRD-01 sem nenhuma alteração. `deploy:rules` é **opcional** neste release — omitir é seguro.
3. **Build estático:** `npm run build:hosting` gera `out/` com as novas telas de login, cadastro e pending.
4. **Canal de staging:** publicar o build num canal de preview temporário antes do live.
5. **Smoke test completo** no canal de staging (Seção 7).
6. **Go live:** após smoke test aprovado, deploy final no canal live.

### Primeiro usuário — janela crítica

Há uma **janela de risco** entre o deploy do Hosting (passo 6) e o momento em que alguém acessa o app e tenta se cadastrar. Enquanto a função `promoteFirstAdmin` estiver ativa (passo 1 concluído), qualquer cadastro que ocorrer durante o staging ou o live terá a promoção correta. **Não há corrida desde que o passo 1 seja concluído antes do passo 6.**

---

## 4. Sequência de Deploy (ordem obrigatória)

### Passo 0 — Pré-voo: verificar qualidade e baseline git

```bash
# Verificar testes passando (raiz)
npm run test
# Verificar testes das functions
cd functions && npx vitest run && cd ..
# Verificar tipos
npm run typecheck
# Verificar lint
npm run lint
# Verificar git baseline (deve ter commits)
git log --oneline -5
```

Só prosseguir se todos os checks passarem e existirem commits.

### Passo 1 — Deploy das Cloud Functions (PRIMEIRO — CRÍTICO)

```bash
npm run deploy:functions
# Equivale a: firebase deploy --only functions --project world-cup-betting-pool-8e93c
```

**Por que primeiro:** a função `promoteFirstAdmin` (trigger `onCreate users/{uid}`) DEVE estar ativa antes do primeiro cadastro real. Se o Hosting for implantado antes das Functions, existe risco de um usuário se cadastrar sem que a promoção ocorra, deixando o sistema sem admin.

**Verificação pós-deploy:**

- Acessar [Firebase Console > Functions](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/functions).
- Confirmar que `promoteFirstAdmin` aparece como `ATIVA` na lista de funções.
- Confirmar que `syncTeams` e `scheduledSync` continuam ativos (não foram removidos).

> Se `promoteFirstAdmin` não aparecer na lista, **NÃO prosseguir para o passo 2**. Investigar erros de compilação ou de deploy no log da CLI antes de continuar.

### Passo 2 — Security Rules (opcional — no-op confirmado)

As Security Rules existentes **já cobrem todos os requisitos do PRD-01**:

- `users/{uid}`: auto-cadastro força `status: pending` / `role: user` — impede auto-promoção a admin (linha 39–44 do `firestore.rules`).
- `promoteFirstAdmin` usa Admin SDK, que bypassa rules por design — correto.
- Leitura de `users/{uid}` restrita ao dono ou admin — correto.

**Ação:** nenhuma. `deploy:rules` pode ser omitido. Se quiser reimplantar por segurança:

```bash
npm run deploy:rules
# Equivale a: firebase deploy --only firestore:rules,firestore:indexes --project world-cup-betting-pool-8e93c
```

### Passo 3 — Build do Hosting (exportação estática)

```bash
npm run build:hosting
# Equivale a: rimraf .next out && next build
```

**Pré-condição:** `.env.production` presente localmente com `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=false`.

**O que o build gera:** exportação estática em `out/` via `output: "export"` (configurado em `next.config.ts`). Imagens não otimizadas (`images.unoptimized: true`) — compatível com Firebase Hosting CDN estático.

**Rotas esperadas na saída do build:**

```
Route (app)                    Size
┌ ○ /                          ...
├ ○ /login                     ...   ← nova tela funcional (LoginForm)
├ ○ /cadastro                  ...   ← nova rota (SignupForm)
├ ○ /pending                   ...   ← expandida (refreshProfile + redirect)
├ ○ /home                      ...
├ ○ /matches                   ...
├ ○ /predictions               ...
├ ○ /profile                   ...
└ ○ /rankings                  ...
```

**Se o build falhar:** NÃO prosseguir. Resolver erros de TypeScript/build antes de continuar.

### Passo 4 — Deploy no canal de preview (staging)

```bash
firebase hosting:channel:deploy staging --project world-cup-betting-pool-8e93c
```

Isso gera uma URL temporária do tipo `https://world-cup-betting-pool-8e93c--staging-<hash>.web.app`.

Executar o smoke test completo (Seção 7) nessa URL antes de prosseguir para o live.

### Passo 5 — Go live (após smoke test aprovado)

```bash
npm run deploy:hosting
# Equivale a: firebase deploy --only hosting --project world-cup-betting-pool-8e93c
```

URL de produção: `https://world-cup-betting-pool-8e93c.web.app`

### Sequência visual

```
Passo 0: verificações locais (test + typecheck + lint + git)
    ↓
Passo 1: deploy:functions  ← CRÍTICO (promoteFirstAdmin ANTES de qualquer cadastro)
    ↓
Passo 2: deploy:rules      ← opcional (no-op — rules não mudaram)
    ↓
Passo 3: build:hosting     ← gera out/ com login/cadastro/pending funcionais
    ↓
Passo 4: channel:deploy staging  ← smoke test aqui
    ↓
Passo 5: deploy:hosting    ← go live após smoke test aprovado
```

---

## 5. Smoke Test Pós-Deploy

Executar no canal de **staging** (Passo 4) antes do live. Repetir pontos críticos após o live.

### 5.1 Verificar que promoteFirstAdmin está ativa

- [ ] Acessar [Firebase Console > Functions](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/functions).
- [ ] Confirmar que `promoteFirstAdmin` está listada e com status `ATIVA`.
- [ ] Verificar que não há erros de inicialização nos logs da função ([Functions > Logs](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/functions/logs)).

### 5.2 App carrega e rotas respondem

- [ ] Acessar a URL do staging (ou live após Passo 5).
- [ ] `/login` carrega o formulário completo: campos Email e Senha, botão "Entrar", link "Não tem conta? Cadastre-se", link "Esqueci minha senha" (inativo/placeholder).
- [ ] `/cadastro` carrega o formulário: Nome, Apelido, Email, Senha, Confirmar Senha, checkbox Termos, botão "Criar conta".
- [ ] Nenhum erro de console (F12 > Console) nas rotas acima.
- [ ] Logo dourado em `/login`, logo verde em `/cadastro`.

### 5.3 Validações client-side (sem backend)

- [ ] Em `/login`: submeter formulário vazio → campos marcados como obrigatórios com mensagens de erro inline.
- [ ] Em `/login`: email inválido → mensagem de erro inline.
- [ ] Em `/cadastro`: senha e confirmar senha diferentes → erro "Senhas não conferem" (ou equivalente).
- [ ] Em `/cadastro`: tentar submeter sem aceitar os Termos → botão desabilitado ou erro inline.
- [ ] Em `/cadastro`: senha com menos de 6 caracteres → erro inline.

### 5.4 Fluxo do primeiro usuário (primeiro admin)

> Este é o teste mais crítico do release. Executar com uma conta de email descartável ou de teste.

- [ ] Acessar `/cadastro` e preencher todos os campos corretamente (email, senha >= 6 chars, termos aceitos).
- [ ] Clicar "Criar conta".
- [ ] Verificar que o usuário foi criado em [Firebase Auth > Usuários](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/authentication/users).
- [ ] Aguardar ~5 segundos e verificar no [Firestore > Coleção `users`](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/firestore) que:
  - O documento `users/{uid}` foi criado com `role: "user"` e `status: "pending"` (pela `signUp` do cliente).
  - **Dentro de poucos segundos**, a Cloud Function `promoteFirstAdmin` atualiza o mesmo doc para `role: "admin"` e `status: "approved"`.
- [ ] Verificar no [Firestore > `system_settings/bootstrap`](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/firestore) que o documento existe com `firstAdminAssigned: true`.
- [ ] No app, clicar "Atualizar Status" na tela Pending (se o redirect não ocorreu automaticamente) e verificar que o usuário é redirecionado para `/home`.
- [ ] Verificar nos logs de Functions que aparece a mensagem `promoteFirstAdmin: usuário <uid> promovido a admin/approved (primeiro usuário)`.

### 5.5 Fluxo do segundo usuário (deve permanecer pending)

- [ ] Abrir janela anônima e acessar `/cadastro`.
- [ ] Criar uma segunda conta com email diferente.
- [ ] Verificar no Firestore que o segundo `users/{uid}` permanece com `role: "user"` e `status: "pending"` (a Cloud Function NÃO promove o segundo).
- [ ] Verificar nos logs de Functions que aparece `promoteFirstAdmin: usuário <uid2> mantido como user/pending (admin já existe)`.
- [ ] Verificar que o segundo usuário vê a tela "Aguardando Aprovação" e NÃO tem acesso às áreas internas.

### 5.6 Botão "Atualizar Status" na tela Pending

- [ ] Com o segundo usuário (pending) logado, clicar "Atualizar Status".
- [ ] Verificar que aparece toast "Ainda aguardando aprovação." (ou equivalente).
- [ ] O botão exibe estado de loading durante a requisição.

### 5.7 Erro de login com credenciais inválidas

- [ ] Em `/login`, tentar logar com email existente mas senha errada → toast de erro em pt-BR.
- [ ] Tentar logar com email inexistente → toast de erro genérico (sem confirmar existência do email).

### 5.8 Email já em uso no cadastro

- [ ] Em `/cadastro`, tentar criar conta com email já cadastrado → toast de erro em pt-BR sem confirmar existência da conta (privacidade — R6 do plano).

### 5.9 Verificar logs de Functions

- [ ] Acessar [Firebase Console > Functions > Logs](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/functions/logs).
- [ ] Confirmar ausência de erros `INTERNAL` não esperados nas funções testadas.

---

## 6. Critérios de Go / No-Go

### Go (prosseguir com o deploy live)

- [ ] Pré-requisito 2.1: git baseline commitado.
- [ ] Pré-requisito 2.2: PRD-00 implantado em produção.
- [ ] `npm run test` — 170+ testes passando.
- [ ] `cd functions && npx vitest run` — 49+ testes passando.
- [ ] `npm run typecheck` — 0 erros.
- [ ] `npm run lint` — 0 erros.
- [ ] `npm run build:hosting` — build sem erros, `out/` gerado.
- [ ] `deploy:functions` concluído sem erros, `promoteFirstAdmin` ativa.
- [ ] Smoke test 5.1 a 5.9 aprovado no canal de staging.

### No-Go (bloquear o deploy live)

- [ ] `promoteFirstAdmin` NÃO aparece como `ATIVA` após `deploy:functions`.
- [ ] Build `build:hosting` falha por qualquer motivo.
- [ ] Tela `/cadastro` não renderiza ou formulário não submete.
- [ ] Primeiro usuário cadastrado NÃO é promovido a `admin/approved` pela Cloud Function (smoke test 5.4 falha).
- [ ] Segundo usuário incorretamente promovido a admin (smoke test 5.5 falha).
- [ ] Erros de `INTERNAL` em Functions durante o smoke test.
- [ ] `NEXT_PUBLIC_FIREBASE_USE_EMULATORS` diferente de `false` no build (app apontando para emulador em produção).

---

## 7. Plano de Rollback

### 7.1 Hosting — reverter para versão PRD-00

```bash
firebase hosting:rollback --project world-cup-betting-pool-8e93c
```

Ou re-deploy a partir do canal de staging do PRD-00 (se disponível):

```bash
firebase hosting:channel:list --project world-cup-betting-pool-8e93c
firebase hosting:clone world-cup-betting-pool-8e93c:<canal-prd00> world-cup-betting-pool-8e93c:live
```

Ou via git (requer baseline commitado — pré-requisito 2.1):

```bash
git checkout <commit-prd00> -- src/ public/
npm run build:hosting
npm run deploy:hosting
```

### 7.2 Cloud Functions — reverter promoteFirstAdmin

Se `promoteFirstAdmin` causar problema (ex: loop infinito de retries, erro em produção):

**Opção A — Deletar a função (temporário, enquanto corrige):**

```bash
firebase functions:delete promoteFirstAdmin --project world-cup-betting-pool-8e93c
```

> Atenção: deletar a função não afeta usuários já existentes. Novos cadastros enquanto a função está deletada **não serão promovidos**. Se o sistema ainda não tem admin, isso é crítico — ver Opção C.

**Opção B — Re-deploy de versão anterior (requer baseline commitado):**

```bash
git checkout <commit-prd00> -- functions/
npm run deploy:functions
```

**Opção C — Admin sem Cloud Function (emergência):**

Se o sistema está em produção sem admin e sem a Function:

1. Criar manualmente um usuário via [Firebase Auth Console](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/authentication/users).
2. Criar manualmente o documento `users/{uid}` no Firestore via Console com `role: "admin"`, `status: "approved"`.
3. Criar manualmente `system_settings/bootstrap` com `{ firstAdminAssigned: true }` para evitar que a Function promova outro usuário quando voltar.

### 7.3 Firestore Rules — não aplicável neste release

As Security Rules não foram alteradas neste release. Rollback de rules é no-op.

---

## 8. Riscos e Mitigações

### R1 — CRÍTICO: Cloud Function não implantada antes do primeiro cadastro

**Risco:** se `deploy:hosting` for executado antes de `deploy:functions` e um usuário se cadastrar, o `users/{uid}` doc será criado sem que `promoteFirstAdmin` exista — ninguém vira admin, o sistema fica inoperante (ninguém aprova ninguém).

**Severidade:** crítica — sistema inoperante sem admin.

**Mitigação:**
- A sequência de deploy deste plano é clara: Functions (Passo 1) **antes** de Hosting (Passo 5).
- O smoke test 5.1 verifica a ativação da Function **antes** do go live.
- O smoke test 5.4 verifica a promoção do primeiro usuário no staging **antes** do live.
- Em emergência: usar Opção C do rollback (7.2) para criar admin manualmente.

### R2 — Cadastro órfão: Auth criado sem doc Firestore

**Risco:** `createUserWithEmailAndPassword` tem sucesso mas `setDoc` falha → usuário existe no Firebase Auth mas não no Firestore. O rollback `user.delete()` é executado em TASK-06, mas se o próprio `delete()` falhar, o usuário fica em estado órfão.

**Severidade:** alta — usuário não consegue logar (Security Rules negam leitura sem doc).

**Mitigação:**
- TASK-06 implementa rollback `user.delete()` com log em caso de falha do rollback.
- Monitorar logs de Functions e Firebase Auth Console nas primeiras horas.
- Se detectado: deletar manualmente o usuário órfão do Firebase Auth Console e pedir re-cadastro.

### R3 — Race condition no bootstrap do primeiro admin

**Risco:** dois usuários se cadastrando simultaneamente no exato momento inaugural — dois eventos `onCreate` chegam para `promoteFirstAdmin` concorrentemente.

**Severidade:** média — se não tratado, ambos poderiam virar admin.

**Mitigação:** TASK-05 usa transação Firestore sobre `system_settings/bootstrap` com flag `firstAdminAssigned`. A transação serializa a decisão — apenas o primeiro a commitar promove, o segundo rele a flag como `true` e faz no-op. Testado em `promoteFirstAdmin.test.ts`.

### R4 — `promoteFirstAdmin` com retry após rollback do TASK-06

**Risco:** `signUp` cria o doc `users/{uid}`, a Function é disparada, mas o `setDoc` falha e TASK-06 faz rollback (`user.delete()`). Se a Function retenta após o rollback, pode tentar promover um doc que não existe mais.

**Severidade:** média — potencial erro de NOT_FOUND na Function.

**Mitigação:** TASK-05 usa `tx.set(..., { merge: true })` em vez de `tx.update()`. O `set` com merge tolera doc ausente sem lançar exceção. Comportamento documentado no código.

### R5 — Build com emuladores habilitados em produção

**Risco:** `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true` no momento do build estático → app em produção aponta para `localhost:8080` (Firestore emulador) em vez do Firestore real.

**Severidade:** alta — todos os dados escritos iriam para emulador local (inexistente em produção), resultando em erros de conexão para todos os usuários.

**Mitigação:**
- `.env.local` tem `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=false` (confirmado).
- Verificar explicitamente antes do build: `echo $NEXT_PUBLIC_FIREBASE_USE_EMULATORS` (deve ser `false` ou ausente).
- O smoke test 5.4 detectaria este problema (cadastro no staging não chegaria ao Firestore real).

### R6 — Vazar existência de email no signup

**Risco:** mensagem de erro `auth/email-already-in-use` confirma que o email está cadastrado — violação de privacidade (R6 do plano original).

**Severidade:** baixa — não é blocker, mas é falha de privacidade.

**Mitigação:** TASK-02 (`mapAuthError`) retorna mensagem neutra para `auth/email-already-in-use` sem confirmar a existência da conta. Verificado no smoke test 5.8.

### R7 — Termos de Uso sem documento real

**Risco:** checkbox de Termos aponta para `#` (placeholder). O aceite não é persistido no Firestore. Se exigência legal mudar, não há rastro de aceite.

**Severidade:** baixa — aceita como gap neste PRD.

**Mitigação:** documentado como deferred. Revisar com produto se persistência de aceite for exigida legalmente antes do lançamento público.

---

## 9. Configuração e Segredos

Sem alterações em relação ao PRD-00. As variáveis `NEXT_PUBLIC_*` são baked no build estático (público, intencional). A `API_FOOTBALL_KEY` continua no Secret Manager (server-side somente).

Nenhuma nova variável de ambiente é introduzida pelo PRD-01.

---

## 10. Pós-Release: Monitoramento nas Primeiras Horas

Após o go live, monitorar por pelo menos 30 minutos:

- [ ] [Firebase Console > Functions > Logs](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/functions/logs) — verificar `promoteFirstAdmin` sendo disparada em cada cadastro real.
- [ ] [Firebase Console > Authentication > Usuários](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/authentication/users) — monitorar cadastros.
- [ ] [Firebase Console > Firestore > `users`](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/firestore) — verificar que o primeiro usuário real virou admin.
- [ ] [Firebase Console > Firestore > `system_settings/bootstrap`](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/firestore) — confirmar `firstAdminAssigned: true` após o primeiro cadastro real.

---

## Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-06 | Plano inicial — PRD-01 Autenticação e Aprovação de Usuários |
