# PRD — Recuperação de Senha (PRD-01.1)

> Origem: `docs/prd-01-1/PRD-01-1-Recuperacao-Senha.md` + imagens fonte-de-verdade `docs/prd-01-1/01..05-*.png`. Complementa o PRD-01 (autenticação), que deixou "Esqueci minha senha" como placeholder (ambiguidade A4: "recuperação de senha em PRD futura"). **Esta é essa PRD.**
>
> **Constraint visual explícito do solicitante:** os mockups exibem um *bottom tab bar* (Home/Jogos/Palpites/Ranking/Perfil) — **ele deve ser IGNORADO**. As telas de recuperação vivem no grupo `(auth)`, que não monta o `AppShell`/`BottomNav`. Nenhuma tela desta feature tem navegação inferior.

---

## 1. Resumo da feature

Fluxo completo de **redefinição de senha por e-mail** via Firebase Authentication, em duas pernas:

1. **Solicitação** (usuário deslogado, esqueceu a senha): informa o e-mail → recebe link de redefinição → tela de confirmação.
2. **Redefinição** (usuário clica no link do e-mail): abre tela dedicada com `oobCode` na URL → define nova senha → tela de sucesso → volta ao login.

Substitui o placeholder atual (`handleForgotPassword` → `toast("Em breve")` em `LoginForm.tsx:55`) por navegação real.

Firebase: `sendPasswordResetEmail` (perna 1) + `verifyPasswordResetCode` / `confirmPasswordReset` (perna 2).

---

## 2. Escopo consolidado

### Dentro do escopo

| # | Item | Tela fonte |
|---|---|---|
| E1 | Link "Esqueci minha senha" no login navega para rota real (remover placeholder `toast`) | 01 |
| E2 | Tela **Recuperar senha**: campo e-mail, ação "Enviar link", ação "Voltar para o login" | 02 |
| E3 | Tela **E-mail enviado**: confirmação com e-mail mascarado/exibido, instrução de checar spam, "Voltar para o login" | 03 |
| E4 | Tela **Definir nova senha**: campos Nova senha + Confirmar nova senha (com toggle de visibilidade), checklist de regras ao vivo, ação "Redefinir senha" | 04 |
| E5 | Tela **Senha alterada**: sucesso + "Ir para o login" | 05 |
| E6 | Regras de senha: **mínimo 8 caracteres, letras E números, diferente da anterior** | 04 |
| E7 | Camada de serviço: `sendPasswordReset`, `verifyResetCode`, `confirmReset` em `services/auth.ts` | — |
| E8 | Mapeamento pt-BR dos novos códigos de erro Firebase (`auth/invalid-action-code`, `auth/expired-action-code`, etc.) em `errors.ts` | — |

### Fora do escopo

- Verificação de e-mail (`emailVerified`).
- Recuperação por SMS / autenticação multifator.
- Alteração de senha pelo usuário **logado** (fluxo de perfil — PRD futura).
- Customização do template HTML do e-mail Firebase (config operacional no Console, ver §5).

### Decisões consolidadas (a partir do PRD-01 A4)

- **Rota separada, não modal.** Coerente com as 4 telas distintas dos mockups. Rotas no grupo `(auth)`.
- **Pré-preenchimento do e-mail:** o campo da tela 02 inicia vazio (o usuário chega via link "Esqueci minha senha" sem passar o e-mail digitado no login). Pré-preencher é melhoria opcional, não requisito.

---

## 3. Entendimento do sistema (partes relevantes)

### Reutilizável (já existe — NÃO reconstruir)

| Artefato | Local | Uso nesta feature |
|---|---|---|
| `services/auth.ts` | `src/services/auth.ts` | Adicionar funções de reset; mesma convenção (propaga `error.code` cru, UI traduz). |
| `mapAuthError` | `src/features/auth/errors.ts` | Estender tabela com códigos de action-code. |
| `PasswordInput` | `src/components/auth/PasswordInput.tsx` | Reuso direto nas telas 04 (toggle Eye/EyeOff já pronto). |
| `AuthLogo` | `src/components/auth/AuthLogo.tsx` | Cabeçalho das telas (variante a definir no `/screen`). |
| Schemas de form | `src/features/auth/schemas.ts` | Adicionar `forgotPasswordSchema` e `resetPasswordSchema`. `emailField` reaproveitável. |
| `firebaseAuth` | `src/firebase` | Client SDK para as chamadas de reset. |
| Grupo `(auth)` + `AuthLayout` | `src/app/(auth)/layout.tsx` | Sem `AppShell` → **sem bottom nav** (atende o constraint). Renderiza children para usuário deslogado. |
| Padrão de página dois-blocos | `src/app/(auth)/login/page.tsx` | Hero `.auth-theme` + card `.auth-card`. |

### Novo

| Artefato novo | Descrição |
|---|---|
| Rota `(auth)/esqueci-senha` | Telas 02 → 03 (solicitação + confirmação; um estado pós-submit ou sub-componentes). |
| Rota `(auth)/redefinir-senha` | Telas 04 → 05. Lê `oobCode`/`mode` da query string (entregue pelo link do e-mail). |
| `ForgotPasswordForm` | RHF+Zod, campo e-mail, dispara `sendPasswordReset`. |
| `ResetPasswordForm` | RHF+Zod, nova senha + confirmação + checklist ao vivo, dispara `confirmReset(oobCode, novaSenha)`. |
| Componente de checklist de senha | Indicadores ao vivo (✓/○) das 3 regras da tela 04. Compor (não há Shadcn nativo). |

---

## 4. Análise de impacto técnico

| Área | Impacto |
|---|---|
| **Firebase Auth** | `sendPasswordResetEmail(auth, email, actionCodeSettings?)`, `verifyPasswordResetCode(auth, oobCode)`, `confirmPasswordReset(auth, oobCode, newPassword)`. Email/Password já habilitado. |
| **Firestore** | **Nenhuma escrita.** A senha vive só no Firebase Auth; nenhum doc `users/*` muda. |
| **Security Rules** | **Sem alteração.** |
| **Roteamento** | 2 novas rotas no grupo `(auth)`. A rota `redefinir-senha` deve renderizar mesmo para usuário deslogado (caso normal) — `AuthLayout` já entrega children para não-aprovados. |
| **`LoginForm.tsx`** | Trocar `handleForgotPassword` (toast placeholder) por `<Link href="/esqueci-senha">` ou `router.push`. Linhas 55-58 e 104-115. |
| **`schemas.ts`** | `PASSWORD_MIN_LENGTH` atual = 6 (login/cadastro). A tela 04 exige **8 + letras + números**. Criar `resetPasswordSchema` com regra própria; **não** alterar a regra de login/cadastro (divergência intencional — ver A1 em §6). |
| **`errors.ts`** | Novos códigos: `auth/invalid-action-code`, `auth/expired-action-code`, `auth/user-disabled`, `auth/weak-password` (já existe, ajustar texto p/ 8). |
| **React Query** | N/A — operações são comandos imperativos one-shot (mutations), não cache de leitura. Usar estado local de form/submit, não `useQuery`. |
| **Privacidade (R6)** | `sendPasswordResetEmail` retorna sucesso mesmo para e-mail inexistente? **Não** — Firebase lança `auth/user-not-found`. Para não revelar existência de conta, a tela 02 deve mostrar a confirmação (tela 03) **independente** do resultado (tratar `user-not-found` como sucesso silencioso). |
| **Config Firebase (operacional)** | Para o link do e-mail abrir a tela 04 **deste app** (e não a página padrão do Firebase), configurar a *Action URL* customizada no Console (Authentication → Templates → Password reset → edit action URL) apontando para `/redefinir-senha`, OU passar `actionCodeSettings.url`. Sem isso, telas 04/05 não são alcançadas pelo fluxo real. |

---

## 5. Riscos

| # | Risco | Sev. | Detalhe |
|---|---|---|---|
| R1 | **Action URL não customizada** | Alta | Sem configurar a URL de ação no Console/`actionCodeSettings`, o link do e-mail cai na página hospedada do Firebase e as telas 04/05 nunca aparecem. Decisão e execução operacional necessária antes do deploy. |
| R2 | **"Senha diferente da anterior" não é verificável no client** | Média | `confirmPasswordReset` não recebe a senha antiga e o app não a conhece. Firebase aceita reusar a mesma senha. A regra da tela 04 é, na prática, **não-aplicável de forma confiável** no fluxo de reset (só validável se soubéssemos a senha atual). Ver A2. |
| R3 | **Vazamento de existência de conta** | Média | Se a tela 02 exibir erro "e-mail não cadastrado", revela contas. Mitigar tratando `auth/user-not-found` como sucesso (mesma tela 03). |
| R4 | **`oobCode` ausente/expirado/usado** | Média | Acesso direto a `/redefinir-senha` sem código, ou link velho. Validar com `verifyPasswordResetCode` no load; se inválido, exibir estado de erro com CTA para reenviar (voltar a 02). |
| R5 | **Rate limit** | Baixa | Spam de "Enviar link" → `auth/too-many-requests` (já mapeado). Considerar desabilitar botão pós-envio. |
| R6 | **Divergência de regra de senha** | Baixa | Cadastro permite 6 chars; reset exige 8+letras+números. Usuário pode ter senha de 6 e ser forçado a 8 no reset — aceitável, mas inconsistente. Ver A1. |

---

## 6. Ambiguidades e lacunas

| # | Ambiguidade | Impacto | Proposta default |
|---|---|---|---|
| A1 | Regra de senha do **cadastro** (6) ≠ **reset** (8+letras+números). Unificar para 8 em todo o auth? | Consistência de produto | Manter divergência nesta PRD (escopo = só reset); sinalizar para alinhar cadastro depois. |
| A2 | "Não pode ser igual à anterior" — **como validar** sem conhecer a senha atual? | Critério de aceite da tela 04 | Implementar como regra **best-effort não-bloqueante** (checklist visual informativo) OU remover do schema bloqueante. **Decidir no `/screen`/`/plan`.** |
| A3 | Telas 02→03 e 04→05: **rotas separadas** ou **estados internos** de uma rota? | Estrutura de arquivos | Default: 1 rota por perna com estado interno (`form` → `enviado`; `form` → `sucesso`). Confirmar no `/screen`. |
| A4 | E-mail exibido na tela 03 ("seu@email.com") — mostrar o e-mail real digitado ou mascarar? | UX/privacidade | Mostrar o e-mail digitado (já é input do próprio usuário, sem vazamento). |
| A5 | Texto exato dos botões/labels — seguir mockups literalmente? | Conteúdo | Sim: "Enviar link", "Voltar para o login", "Redefinir senha", "Ir para o login". |
| A6 | Tema das telas 02-05: mockups misturam header claro + área branca. Seguir padrão `.auth-theme`/`.auth-card` do login? | Visual | Resolver no `/screen` contra `design-system/MASTER.md`. |

---

## 7. Impacto UI/Layout

- **UI Impact:** sim
- **Plataformas:** web (mobile-first, responsivo)
- **Telas:**
  - `(auth)/login` — alterar link "Esqueci minha senha" (placeholder → navegação real)
  - `(auth)/esqueci-senha` — **nova** (telas 02 + 03)
  - `(auth)/redefinir-senha` — **nova** (telas 04 + 05)
- **Bottom nav:** **NÃO** (constraint explícito; grupo `(auth)` não monta `AppShell`)
- **Product type:** sports betting pool — fluxo de auth com estética de app nativo mobile
- **Recommended style direction:** consistente com login existente (hero `.auth-theme` verde + card `.auth-card`), logo `AuthLogo`, verde esportivo como CTA, ícones Lucide (Mail, CheckCircle2, Eye/EyeOff). Detalhar no `/screen` contra `design-system/MASTER.md`.
- **Design complexity:** média (4 telas, 2 forms com validação, checklist ao vivo, estados de erro de `oobCode`, leitura de query string).

---

## 8. Preocupações de implementação (alto nível)

- **Estados de erro do `oobCode`:** a tela 04 precisa de 3 estados — verificando, válido (form), inválido/expirado (erro + CTA reenviar). `verifyPasswordResetCode` no mount.
- **Sucesso silencioso na perna 1:** capturar `auth/user-not-found` e tratar como envio bem-sucedido (anti-enumeração).
- **Schema de reset isolado:** `resetPasswordSchema` em `features/auth/schemas.ts` com `refine` para confirmação; regra dos 8/letras/números via regex; **não** tocar `PASSWORD_MIN_LENGTH` de login/cadastro.
- **Reuso do `PasswordInput`:** já entrega toggle de visibilidade e `forwardRef` compatível com RHF — usar nas duas senhas da tela 04.
- **Navegação pós-sucesso:** tela 05 → `/login` via `<Link>`/`router.push`; não auto-logar (o usuário redefine deslogado).
- **Config operacional (R1):** documentar no `/release` a configuração da Action URL no Firebase Console.
- **i18n de erros:** estender `errors.ts` mantendo a função pura e a regra R6.

---

*Insumo para `/plan`. Sem tarefas, story points ou código. Complementa o PRD-01 sem substituí-lo.*
