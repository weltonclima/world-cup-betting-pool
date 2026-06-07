# Plano de Release — Recuperação de Senha (PRD-01.1)

> Projeto: **Bolão dos Parças**
> Milestone: **PRD-01.1 — Recuperação de Senha**
> Branch de release: `feat/prd-01-auth`
> Data do plano: 2026-06-06
> Status: PLANO APENAS — nenhum comando de deploy deve ser executado sem revisão e aprovação manual.

---

## 1. Resumo do Release

Este release entrega o **fluxo completo de recuperação de senha** via Firebase Authentication, substituindo o placeholder `toast("Em breve")` do PRD-01 pela implementação real em duas pernas:

- **Perna 1 — Solicitação:** usuário deslogado informa e-mail → recebe link → tela de confirmação (`(auth)/esqueci-senha`).
- **Perna 2 — Redefinição:** usuário clica no link → abre tela com `oobCode` na URL → define nova senha → tela de sucesso (`(auth)/redefinir-senha`).

### O que está incluso

| Componente | Task | Commits |
|---|---|---|
| Schemas Zod (`forgotPasswordSchema`, `resetPasswordSchema`) + erros action-code pt-BR | TASK-01 | `af5e351` |
| Serviço Firebase: `sendPasswordReset`, `verifyResetCode`, `confirmReset` | TASK-02 | `33ba2d9` |
| Tela `(auth)/esqueci-senha` — `ForgotPasswordForm` (2 estados: form → enviado) | TASK-03 | `622e637` |
| Tela `(auth)/redefinir-senha` — `ResetPasswordForm` (4 estados: verificando → válido → sucesso → inválido) | TASK-04 | `d135ea8` |
| Link "Esqueci minha senha" no `LoginForm` → `/esqueci-senha` (remove placeholder) | TASK-05 | `c0c9ad9` |
| Extração de `ResetVerifying` compartilhado (ajuste de revisão WARNING-1) | Refactor | `b51ff61` |
| Fix `AuthGuard`: redireciona não-autenticado para `/login` | Fix | `23d61f0` |

### Verificação de qualidade (pré-deploy confirmado)

| Check | Resultado |
|---|---|
| `npm test` (vitest run) | **206 testes passando** |
| `npm run typecheck` (`tsc --noEmit`) | 0 erros |
| `npm run lint` (`next lint`) | 0 erros |
| `npm run build:hosting` | 0 erros |
| Code review adversarial | **0 BLOCKER · 2 WARNING** (ambos resolvidos/informativos) |

### O que NÃO está incluso neste release

| Item | Decisão |
|---|---|
| Alteração de senha pelo usuário logado | PRD futura (fluxo de perfil) |
| Customização do template HTML do e-mail Firebase | Config operacional no Console — fora de escopo de código |
| Verificação de e-mail (`emailVerified`) | Não planejado — aprovação admin substitui |
| Unicidade de apelido | PRD futura |

---

## 2. Pré-requisitos

### 2.1 PRÉ-REQUISITO OPERACIONAL CRÍTICO (R1) — Action URL do Firebase

> **ESTE ITEM BLOQUEIA O FLUXO REAL DAS TELAS 04 E 05.** Sem ele, o link enviado por e-mail abre a página padrão hospedada do Firebase e nunca chega à tela `/redefinir-senha`.

**Ação obrigatória antes (ou imediatamente após) o deploy:**

1. Acessar [Firebase Console → Authentication → Templates](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/authentication/emails).
2. Selecionar o template **"Redefinição de senha"**.
3. Clicar em **"Editar template"** (ícone de lápis).
4. Localizar o campo **"Action URL"**.
5. Substituir pelo valor:
   ```
   https://world-cup-betting-pool-8e93c.web.app/redefinir-senha
   ```
6. Salvar.
7. **Verificar:** solicitar reset para um e-mail de teste e confirmar que o link recebido aponta para `/redefinir-senha?mode=resetPassword&oobCode=...`.

> **Nota:** esta configuração é no Console do Firebase (não em código) e persiste independentemente de deploys. Pode ser feita antes ou após o deploy do Hosting, mas deve ser feita **antes de qualquer teste real do fluxo completo** (telas 04/05).

### 2.2 PRD-01 já implantado em produção

Este release é uma **adição** ao PRD-01 (branch acumulativo `feat/prd-01-auth`). Assume que o release do PRD-01 (`ai/release/auth.md`) foi executado com sucesso:

- Firebase Auth Email/Password habilitado.
- Cloud Function `promoteFirstAdmin` ativa.
- Hosting com telas de login/cadastro/pending live.
- Plano Blaze ativo, Security Rules implantadas.

Se o PRD-01 ainda não foi ao ar, este release é absorvido no mesmo deploy (ver Seção 4 — opção de deploy conjunto).

### 2.3 Variáveis de ambiente de build

As variáveis `NEXT_PUBLIC_*` são baked no build estático. Verificar que `.env.production` (local, nunca commitado) contém:

```
NEXT_PUBLIC_FIREBASE_API_KEY=<valor_real>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=world-cup-betting-pool-8e93c.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=world-cup-betting-pool-8e93c
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=world-cup-betting-pool-8e93c.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<valor_real>
NEXT_PUBLIC_FIREBASE_APP_ID=<valor_real>
NEXT_PUBLIC_FIREBASE_USE_EMULATORS=false
```

> `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=false` é crítico — garante que o build aponta para o Firebase real.

### 2.4 Firebase CLI autenticada

```bash
firebase login
firebase projects:list
# Confirmar que world-cup-betting-pool-8e93c aparece
```

### 2.5 Git baseline limpo

```bash
rtk git status
# Deve retornar: clean — nothing to commit
rtk git log --oneline -5
# Confirmar que o commit mais recente é:
# 23d61f0 @ fix(auth): AuthGuard redireciona nao-autenticado para /login
```

---

## 3. Estratégia de Rollout

### Contexto

- **Zero mudanças no Firestore** (schema, Security Rules, índices) — Firestore é read-only para este fluxo; a senha vive exclusivamente no Firebase Auth.
- **Zero mudanças em Cloud Functions** — as três chamadas Firebase Auth são feitas pelo SDK client-side.
- O release é **hosting-only**: um novo build estático com as novas rotas é suficiente.
- Risco principal é **operacional** (R1: Action URL), não de código.

### Estratégia: Build → Preview → Smoke Test → Live

```
[1] Pré-voo local  →  [2] build:hosting  →  [3] channel staging  →  [4] smoke test  →  [5] Action URL (R1)  →  [6] deploy:hosting live
```

Não há deploy de Functions nem de Security Rules neste release.

---

## 4. Sequência de Deploy (ordem obrigatória)

### Passo 0 — Pré-voo local (verificações de qualidade)

```bash
# Testes
rtk npm test
# Deve exibir: 206 passed

# Tipos
rtk npm run typecheck
# Deve retornar sem erros

# Lint
rtk npm run lint
# Deve retornar sem erros

# Confirmar emuladores desligados e variável de ambiente correta
echo $NEXT_PUBLIC_FIREBASE_USE_EMULATORS
# Deve ser 'false' ou vazio
```

Só prosseguir se todos os checks passarem.

### Passo 1 — Build do Hosting

```bash
rtk npm run build:hosting
# Equivale a: rimraf .next out && next build
```

**Pré-condição:** `.env.production` presente com `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=false`.

**Rotas esperadas na saída do build (novas):**

```
Route (app)
├ ○ /esqueci-senha     ← nova rota (ForgotPasswordForm — telas 02+03)
└ ○ /redefinir-senha   ← nova rota (ResetPasswordForm — telas 04+05)
```

**Se o build falhar:** NÃO prosseguir. Resolver erros antes de continuar.

### Passo 2 — Deploy no canal de preview (staging)

```bash
firebase hosting:channel:deploy staging --project world-cup-betting-pool-8e93c
```

Gera URL temporária: `https://world-cup-betting-pool-8e93c--staging-<hash>.web.app`.

Executar o smoke test completo (Seção 5) nessa URL antes de prosseguir.

### Passo 3 — Configurar Action URL no Firebase Console (R1)

> Pode ser feito antes do Passo 2. Necessário para smoke test do fluxo completo (telas 04/05).

1. [Firebase Console → Authentication → Templates → Redefinição de senha](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/authentication/emails).
2. Editar Action URL → `https://world-cup-betting-pool-8e93c.web.app/redefinir-senha`.
3. Salvar e confirmar.

### Passo 4 — Go live (após smoke test aprovado)

```bash
rtk npm run deploy:hosting
# Equivale a: firebase deploy --only hosting --project world-cup-betting-pool-8e93c
```

URL de produção: `https://world-cup-betting-pool-8e93c.web.app`

### Sequência visual

```
Passo 0: verificações locais (test + typecheck + lint + emulators=false)
    ↓
Passo 1: build:hosting  ← gera out/ com /esqueci-senha e /redefinir-senha
    ↓
Passo 2: channel:deploy staging  ← smoke test aqui
    ↓
Passo 3: Action URL Firebase Console (R1)  ← habilita fluxo real telas 04/05
    ↓
Passo 4: deploy:hosting  ← go live após smoke test aprovado
```

> **Nota sobre deploy conjunto com PRD-01:** se PRD-01 e PRD-01.1 ainda não foram ao ar, executar o passo de Functions do PRD-01 (`npm run deploy:functions`) antes do Passo 1 deste plano, seguindo a sequência do `ai/release/auth.md`.

---

## 5. Smoke Test Pós-Deploy

Executar no canal de **staging** (Passo 2) antes do live. Repetir pontos críticos (5.3, 5.4, 5.5) após o live.

### 5.1 App carrega e rotas respondem

- [ ] `/login` carrega com link "Esqueci minha senha" visível e clicável (não é mais placeholder/toast).
- [ ] Clicar "Esqueci minha senha" navega para `/esqueci-senha` (sem erro 404).
- [ ] `/esqueci-senha` carrega o formulário com campo e-mail e botão "Enviar link".
- [ ] Acessar `/redefinir-senha` diretamente (sem `oobCode`) → exibe estado `inválido` com mensagem de erro e CTA para voltar a `/esqueci-senha`.
- [ ] Nenhum erro de console (F12 > Console) nas rotas acima.

### 5.2 Validações client-side (sem backend)

- [ ] Em `/esqueci-senha`: submeter formulário vazio → erro inline "E-mail inválido" ou equivalente.
- [ ] Em `/esqueci-senha`: submeter e-mail inválido (ex: `teste`) → erro inline de formato.
- [ ] Em `/redefinir-senha` (com `?oobCode=teste&mode=resetPassword`): campos de senha visíveis; submeter senha com menos de 8 chars → erro inline; submeter senhas diferentes → erro de confirmação.
- [ ] Checklist de senha em `/redefinir-senha` atualiza ao vivo conforme digitação:
  - [ ] ≥ 8 caracteres → item ✓ verde.
  - [ ] Contém letras → item ✓ verde.
  - [ ] Contém números → item ✓ verde.
  - [ ] "Diferente da anterior" → exibe ícone Info (informativo, nunca bloqueia).

### 5.3 Perna 1 — Solicitação de reset (fluxo completo)

> Usar e-mail de teste existente no Firebase Auth do projeto.

- [ ] Em `/esqueci-senha`, digitar e-mail de teste válido e clicar "Enviar link".
- [ ] Botão exibe loading durante a requisição.
- [ ] Após sucesso: tela muda para estado "enviado" (tela 03) — ícone de confirmação, e-mail digitado exibido, instrução de checar spam.
- [ ] Link "Voltar para o login" na tela 03 navega para `/login`.
- [ ] Verificar no inbox do e-mail de teste que o e-mail de reset chegou.

### 5.4 Perna 1 — Anti-enumeração (e-mail inexistente)

- [ ] Em `/esqueci-senha`, digitar e-mail que **não existe** no Firebase Auth.
- [ ] Clicar "Enviar link".
- [ ] App mostra a **mesma tela 03 de confirmação** — sem toast de erro "usuário não encontrado".
- [ ] Confirmar que não há vazamento de existência de conta.

### 5.5 Perna 2 — Redefinição via link (fluxo completo — requer Action URL configurada)

> Este teste só é possível após o Passo 3 (Action URL configurada).

- [ ] Clicar no link de reset recebido no e-mail de teste (Passo 5.3).
- [ ] Link abre `/redefinir-senha?mode=resetPassword&oobCode=<código_real>` (não a página padrão do Firebase).
- [ ] Tela exibe estado `verificando` brevemente e, em seguida, o formulário de nova senha (tela 04).
- [ ] Preencher nova senha válida (≥8 chars, letras e números) e confirmar.
- [ ] Clicar "Redefinir senha".
- [ ] Tela muda para estado `sucesso` (tela 05) com mensagem de confirmação.
- [ ] Link "Ir para o login" navega para `/login`.
- [ ] Fazer login com a nova senha → sucesso.

### 5.6 Perna 2 — oobCode expirado/inválido

- [ ] Acessar `/redefinir-senha?mode=resetPassword&oobCode=codigo-invalido`.
- [ ] Tela exibe estado `verificando` e, em seguida, estado `inválido` com mensagem e CTA para `/esqueci-senha`.
- [ ] Clicar no CTA navega para `/esqueci-senha` (sem erro 404).

### 5.7 Rate limiting (R5)

- [ ] Em `/esqueci-senha`, clicar "Enviar link" múltiplas vezes rapidamente.
- [ ] Após envio bem-sucedido, verificar se o botão fica desabilitado ou se `auth/too-many-requests` é exibido como toast em pt-BR (não como erro bruto).

### 5.8 Erros Firebase em pt-BR

- [ ] Navegar para `/redefinir-senha?mode=resetPassword&oobCode=expirado` → verificar mensagem em pt-BR sobre código inválido/expirado (não mensagem bruta do Firebase).

### 5.9 AuthGuard — redirecionar não-autenticado

- [ ] Abrir janela anônima e tentar acessar `/home` diretamente.
- [ ] Verificar redirecionamento automático para `/login`.

---

## 6. Critérios de Go / No-Go

### Go (prosseguir com o deploy live)

- [ ] `npm test` — 206+ testes passando.
- [ ] `npm run typecheck` — 0 erros.
- [ ] `npm run lint` — 0 erros.
- [ ] `npm run build:hosting` — build sem erros, `out/` gerado com rotas `/esqueci-senha` e `/redefinir-senha`.
- [ ] Smoke test 5.1 (rotas carregam, sem 404) aprovado.
- [ ] Smoke test 5.2 (validações client-side) aprovado.
- [ ] Smoke test 5.3 (perna 1 — e-mail enviado) aprovado.
- [ ] Smoke test 5.4 (anti-enumeração) aprovado.
- [ ] Action URL configurada no Firebase Console (R1) — confirmada.
- [ ] Smoke test 5.5 (perna 2 — redefinição real) aprovado.

### No-Go (bloquear o deploy live)

- [ ] Build `build:hosting` falha.
- [ ] Rotas `/esqueci-senha` ou `/redefinir-senha` retornam 404 após deploy.
- [ ] Perna 2 não funciona após configuração da Action URL (link do e-mail não abre `/redefinir-senha`).
- [ ] Anti-enumeração falha: e-mail inexistente exibe erro "usuário não encontrado" (vazamento de conta).
- [ ] `oobCode` inválido não é tratado — tela 04 quebra em vez de exibir estado `inválido`.
- [ ] `NEXT_PUBLIC_FIREBASE_USE_EMULATORS` diferente de `false` no build.
- [ ] AuthGuard não redireciona não-autenticados (smoke test 5.9 falha).

---

## 7. Plano de Rollback

### 7.1 Hosting — reverter para versão PRD-01

```bash
firebase hosting:rollback --project world-cup-betting-pool-8e93c
```

Ou re-deploy a partir do commit PRD-01 baseline:

```bash
rtk git checkout 0b81147 -- src/ public/
rtk npm run build:hosting
rtk npm run deploy:hosting
```

> Rollback do Hosting remove as rotas `/esqueci-senha` e `/redefinir-senha`, voltando ao `toast("Em breve")` placeholder do PRD-01. Usuários que tentarem redefinir senha via link antigo verão o app sem essas telas — comunicar se necessário.

### 7.2 Action URL — reverter no Firebase Console

Se a Action URL foi configurada e o rollback do Hosting for necessário:

1. [Firebase Console → Authentication → Templates → Redefinição de senha](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/authentication/emails).
2. Reverter Action URL para o valor padrão do Firebase ou limpar o campo.

> Isso não afeta usuários já existentes, apenas novos pedidos de reset.

### 7.3 Firestore / Cloud Functions / Security Rules — não aplicável

Zero alterações nestes componentes. Rollback é no-op.

---

## 8. Riscos e Mitigações

| # | Risco | Sev. | Mitigação |
|---|---|---|---|
| **R1** | **Action URL não configurada** — link do e-mail cai na página padrão Firebase; telas 04/05 nunca alcançadas. | **Alta** | Pré-requisito crítico (Seção 2.1). Smoke test 5.5 valida antes do go live. |
| **R2** | **`oobCode` ausente/expirado/usado** — acesso direto a `/redefinir-senha` sem código válido. | Média | `ResetPasswordForm` implementa `verifyResetCode` no mount; estado `inválido` com CTA para `/esqueci-senha`. Smoke test 5.6 cobre. |
| **R3** | **Vazamento de existência de conta** — `auth/user-not-found` expõe que o e-mail não está cadastrado. | Média | `sendPasswordReset` engole `auth/user-not-found` e resolve como sucesso silencioso. Smoke test 5.4 cobre. |
| **R4** | **Rate limit** — spam de "Enviar link" dispara `auth/too-many-requests`. | Baixa | `mapAuthError` traduz para pt-BR. Smoke test 5.7 verifica. |
| **R5** | **Divergência de regra de senha** — cadastro aceita ≥6 chars; reset exige ≥8 + letras + números. Usuário com senha de 6 chars é forçado a 8 no reset. | Baixa | Aceito neste PRD; `RESET_PASSWORD_MIN_LENGTH = 8` isolado; login/cadastro intactos. Detalhar no onboarding se necessário. |
| **R6** | **"Senha ≠ anterior" não verificável** — `confirmPasswordReset` não recebe a senha antiga; Firebase aceita reusar a mesma. | Baixa | Implementado como checklist **informativo** (ícone Info, `sr-only` "informativo, não validado"). Não bloqueia submit. Comportamento correto e intencional. |
| **R7** | **Build com emuladores habilitados** — `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true` no build de produção. | Alta | Verificar variável antes do build (Passo 0). Smoke test 5.5 detectaria falha de conexão ao Firebase real. |

---

## 9. Configuração e Segredos

**Nenhuma nova variável de ambiente** introduzida por este release. As variáveis `NEXT_PUBLIC_*` são as mesmas do PRD-01.

**Única configuração operacional nova:** Action URL no Firebase Console (Seção 2.1 / Passo 3) — não envolve segredos, apenas uma URL pública.

---

## 10. Pós-Release — Monitoramento

Após o go live, monitorar por pelo menos 30 minutos:

- [ ] [Firebase Console → Authentication → Usuários](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/authentication/users) — verificar que usuários não estão criando contas duplicadas por confusão com reset.
- [ ] [Firebase Console → Authentication → Uso](https://console.firebase.google.com/project/world-cup-betting-pool-8e93c/authentication) — monitorar volume de e-mails de reset enviados (quota de e-mails do Firebase Auth: 100/dia no plano gratuito; Blaze = pay-as-you-go).
- [ ] Testar o link de reset em um e-mail real (não staging) para confirmar que a Action URL está ativa em produção.
- [ ] Confirmar que `/login` exibe o link "Esqueci minha senha" funcional (não placeholder).

---

## 11. Dependências Futuras

| Item | PRD destino | Impacto neste release |
|---|---|---|
| Alteração de senha pelo usuário logado | PRD futuro (perfil) | Zero — fluxo de reset é independente |
| Alinhamento de regra de senha (6→8 chars) no cadastro | PRD futuro | Zero — `RESET_PASSWORD_MIN_LENGTH` isolado |
| Customização do template HTML do e-mail | Config operacional futura | Não bloqueia; e-mail padrão do Firebase funciona |

---

## Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-06 | Plano inicial — PRD-01.1 Recuperação de Senha |
