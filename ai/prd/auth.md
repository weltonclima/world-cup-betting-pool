# PRD — Autenticação e Aprovação (PRD-01)

> Origem: `docs/prd-01/PRD-01-Autenticacao-Bolao-dos-Parcas.md` + imagens de referência visual `docs/prd-01/*.png`. Fundação arquitetural (PRD-00) já construída e implantada.

---

## 1. Resumo da feature

Implementar o fluxo completo de **autenticação e controle de acesso** do Bolão dos Parças:
formulários reais de Login e Cadastro, criação do documento `users/{uid}` no Firestore com `status=pending` e `role=user` na conta nova, tela de "Aguardando Aprovação" com ação de refresh de status, recuperação de senha por e-mail, e superfície administrativa para aprovar ou bloquear usuários.

A fundação (PRD-00) já entregou os blocos estruturais reutilizáveis — `AuthProvider`, `useAuth`, `userSchema`, `AuthGuard`, `PendingApprovalScreen`, rotas `(auth)/login` e `(auth)/pending` com placeholders, e o `AuthLayout` com lógica de guarda inversa. **PRD-01 constrói sobre esses blocos; não os reconstrói.**

---

## 2. Escopo consolidado

### Decisões tomadas (resolvem ambiguidades A1, A4, A7)

- **A1 — Bootstrapping admin:** o **primeiro usuário cadastrado vira admin** (`role=admin`, `status=approved`). Demais usuários nascem `role=user`, `status=pending`. Mecanismo a definir no `/plan` (Security Rules atuais forçam `pending`/`user` no auto-create → exige Cloud Function ou regra especial para o doc inaugural).
- **A4 — Recuperação de senha:** será **rota separada em outra PRD**. Fora do escopo do PRD-01. O link "Esqueci minha senha" na tela de login fica como placeholder (sem ação funcional nesta PRD) ou oculto — decidir no `/plan`.
- **A7 — Painel admin (aprovar/bloquear):** será **outra PRD dedicada** às telas administrativas. Fora do escopo do PRD-01.

### Dentro do escopo

- **Formulário de Login** (`(auth)/login`): campos e-mail + senha, validação Zod + React Hook Form, ação "Entrar" via `signInWithEmailAndPassword`, link "Criar Conta" (navega para `(auth)/cadastro`), link "Esqueci minha senha" (placeholder — A4 em outra PRD).
- **Formulário de Cadastro** (`(auth)/cadastro`): campos Nome, Apelido, E-mail, Senha, Confirmar Senha, checkbox Termos de Uso. Ação "Criar Conta" faz: `createUserWithEmailAndPassword` → `setDoc(users/{uid}, { uid, name, nickname, email, role, status, createdAt })`. **Primeiro usuário do sistema → `role:"admin"`, `status:"approved"`; demais → `role:"user"`, `status:"pending"` (A1).** Falha atômica: se o `setDoc` falhar após o Firebase Auth criar o usuário, o usuário fica em estado inconsistente (sem doc de perfil) → rollback `user.delete()`.
- **Tela "Aguardando Aprovação"** (`(auth)/pending`): expandir `PendingApprovalScreen` com botão "Atualizar Status" que força uma releitura do doc `users/{uid}` e, se aprovado, redireciona para `/home`.

### Fora do escopo

- **Recuperação de senha** (A4) — outra PRD.
- **Painel admin / aprovar / bloquear usuários** (A7) — outra PRD.
- Edição de perfil do próprio usuário (PRD futuro).
- Notificação por e-mail ao admin sobre novo cadastro.
- Verificação de e-mail obrigatória antes do acesso (Firebase `emailVerified`) — ver ambiguidades.
- Autenticação social (Google, GitHub etc.).

---

## 3. Entendimento do sistema — o que a fundação já entrega vs. o que é novo

### O que a fundação (PRD-00) já entrega e deve ser **reutilizado**

| Artefato | Localização | Contrato |
|---|---|---|
| `AuthProvider` | `src/providers/AuthProvider.tsx` | Contexto com `firebaseUser`, `profile`, `status`, `role`, `loading`, `error`; escuta `onAuthStateChanged` e lê `users/{uid}` com `userSchema`. |
| `useAuth` hook | `src/hooks/useAuth.ts` | Acesso tipado ao `AuthContext`; lança se usado fora do provider. |
| `userSchema` (Zod) | `src/schemas/users.ts` | Valida `uid`, `name`, `nickname`, `email`, `role`, `status`, `createdAt`, `updatedAt`. Fonte única de tipos. |
| `AuthGuard` | `src/components/layout/AuthGuard.tsx` | Guarda rotas internas: `loading → LoadingScreen`, `!firebaseUser → /login`, `pending → /pending`, `blocked/null → BlockedScreen`, `approved → children`. |
| `AuthLayout` | `src/app/(auth)/layout.tsx` | Guarda inversa: `approved → /home`, `blocked → BlockedScreen`, demais → children. |
| `PendingApprovalScreen` | `src/components/layout/PendingApprovalScreen.tsx` | Tela estática com ícone `Clock`, título, descrição e botão "Sair". Já tem comentário explícito: "PRD-01 expande esta tela com botão Atualizar Status". |
| Rotas placeholder | `src/app/(auth)/login/page.tsx`, `src/app/(auth)/pending/page.tsx` | Páginas vazias aguardando implementação de PRD-01. |
| Firebase Security Rules | `firestore.rules` | **Implantadas e ativas.** Auto-create força `status=pending` + `role=user`. Owner não pode mudar próprio role/status. Admin muda qualquer campo. Deny-by-default. |
| Feature scaffold | `src/features/auth/` | Diretório vazio com `index.ts` e `README.md` — ponto de entrada dos módulos de auth. |

### O que é **novo** em PRD-01

| Artefato novo | Descrição |
|---|---|
| `features/auth/LoginForm` | Formulário RHF+Zod com campos e-mail/senha, ação "Entrar", links "Criar Conta" e "Esqueci minha senha". |
| `features/auth/SignupForm` | Formulário RHF+Zod com campos Nome, Apelido, E-mail, Senha, Confirmar Senha, Termos. Cria usuário Firebase Auth + doc Firestore. |
| `features/auth/schemas` | Schema Zod de validação dos formulários de login e cadastro (distinto do `userSchema` que valida o doc Firestore). |
| `features/auth/services` ou `services/auth` | Funções: `signIn`, `signUp` (Auth + Firestore setDoc), `signOut`, `sendPasswordReset`. |
| Rota `(auth)/cadastro` | Nova página — não existe no placeholder atual. |
| Expansão de `PendingApprovalScreen` | Adicionar botão "Atualizar Status" que força releitura do perfil; lógica de polling/refresh. |
| `features/admin/UsersTable` | Listagem de usuários pendentes + ações aprovar/bloquear. Usa `TanStack Table`. |
| Rota `(app)/admin/usuarios` | Nova página no shell protegido, acessível apenas para `role=admin`. |
| `services/admin` (ou `features/admin/services`) | Funções Firestore: `listPendingUsers`, `approveUser`, `blockUser` — escritas apenas por admin (validado pelas Security Rules). |

---

## 4. Análise de impacto técnico

| Área | Impacto |
|---|---|
| **Firebase Auth** | Uso de `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `sendPasswordResetEmail`, `signOut`. Todos já habilitados (Auth Email/Password ativo na fundação). |
| **Firestore** | Escrita em `users/{uid}` no cadastro; leitura de `users/{uid}` no refresh de status; leitura de `users/*` pelo admin (filtro `status=pending`). Cobertos pelas Security Rules existentes. |
| **Security Rules** | **Nenhuma alteração necessária.** As regras já forçam `status=pending`/`role=user` no auto-create, já permitem admin alterar qualquer campo, já permitem owner ler o próprio doc. |
| **AuthProvider** | Nenhuma alteração na lógica de contexto. O botão "Atualizar Status" pode disparar um `refetch` manual do perfil — pode ser necessário expor uma função `refreshProfile` no contexto ou usar `getDoc` diretamente na tela pending. |
| **Módulo `features/auth`** | Principal área de trabalho: formulários, schemas de validação de formulário, serviços de auth. |
| **Módulo `features/admin`** | Novo módulo. Requer query Firestore com `where("status","==","pending")` + `where("status","==","approved")` para listagem completa. Atenção: a Security Rule atual permite admin ler `users/{uid}` por documento direto, mas **não define explicitamente** `allow list` para `/users` — pode exigir ajuste nas rules ou consulta por UID explícito. |
| **Roteamento** | Nova rota `(auth)/cadastro`. A rota `(app)/admin/usuarios` depende da existência do layout de app shell (PRD-00 entregou o shell, mas sem link de admin no nav). |
| **TanStack Query** | Consultas ao Firestore no painel admin devem passar por React Query (regra de desenvolvimento obrigatória). |
| **React Hook Form + Zod** | Obrigatório para ambos os formulários — já instalados na fundação. |
| **Sonner (toast)** | Feedback de erros de auth (e-mail já cadastrado, senha incorreta, conta bloqueada) e sucesso de operações admin via toast. Já instalado e wired. |
| **Performance** | < 100 usuários — sem impacto de escala. Consultas Firestore sem paginação são aceitáveis. |

---

## 5. Riscos

| # | Risco | Severidade | Detalhe |
|---|---|---|---|
| R1 | **Bootstrapping do primeiro admin** | Alta | Nenhum usuário pode auto-se-promover a admin (Security Rules bloqueiam). O primeiro admin precisa ser criado manualmente via Firebase Console, Admin SDK (script de seed), ou Cloud Function privilegiada. Não existe fluxo de UI para isso. Se não documentado e operacionalizado antes do deploy, o sistema fica sem nenhum admin capaz de aprovar usuários. |
| R2 | **Inconsistência no cadastro** (`createUserWithEmailAndPassword` + `setDoc`) | Alta | Se o `setDoc` falhar após o Firebase Auth criar a conta, o usuário existe no Auth mas sem doc Firestore. `AuthProvider` retorna `error="not-found"`. O usuário fica preso: não pode logar com acesso, e se tentar recadastrar com o mesmo e-mail, o Firebase Auth retorna "email-already-in-use". Necessário: tratamento de erro com rollback (`deleteUser` do Firebase Auth SDK se `setDoc` falhar) ou idempotência no cadastro. |
| R3 | **Listagem de usuários pelo admin** (Security Rules `allow list`) | Média | A regra atual é `allow read: if isOwner(uid) \|\| isAdmin()` em `match /users/{uid}`. Isso cobre leitura por documento direto, mas queries Firestore que listam a coleção (`collection("users").where(...)`) podem ser negadas porque a rule opera no pattern `/users/{uid}` e não na collection raiz. Necessário testar e, se necessário, adicionar `match /users/{uid=**}` ou ajustar para permitir admin listar. |
| R4 | **Refresh de status na tela pending** | Baixa–Média | `AuthProvider` re-lê o perfil apenas quando `onAuthStateChanged` dispara (mudança de auth). Para o botão "Atualizar Status", é necessário uma leitura manual (`getDoc`) sem disparar `onAuthStateChanged`. Expor `refreshProfile` no contexto ou fazer a leitura diretamente na tela — requer decisão de design do contexto. |
| R5 | **Recuperação de senha sem tela dedicada** | Baixa | `sendPasswordResetEmail` redireciona o usuário para o link do e-mail que chega; o link aponta para a tela de reset do Firebase por padrão. Customizar o template de e-mail e a URL de ação (`actionCodeSettings`) pode ser necessário para experiência adequada. |
| R6 | **Erro de e-mail já cadastrado no signup** | Baixa | Firebase retorna código `auth/email-already-in-use`. O formulário deve mapear esse código para mensagem em pt-BR clara, sem expor internamente que aquele e-mail existe no sistema (privacidade). |

---

## 6. Ambiguidades e lacunas

| # | Ambiguidade | Impacto |
|---|---|---|
| A1 | **Como é criado o primeiro admin?** O sistema exige um admin para aprovar qualquer usuário, mas nenhum usuário pode nascer como admin via auto-cadastro. Não há fluxo definido para bootstrapping. Opções: (a) script Node com Admin SDK que promove um UID específico; (b) Cloud Function HTTP protegida por token chamada uma vez; (c) criação manual no Console Firebase. Qual abordagem usar e quem executa? | Bloqueante para produção |
| A2 | **Verificação de e-mail (emailVerified) é requisito?** O PRD-01 não menciona verificação de e-mail. O Firebase Auth emite `emailVerified=false` por padrão. Usuários aprovados com e-mail não verificado teriam acesso pleno? Ou a aprovação do admin substitui a verificação? | Define fluxo pós-cadastro |
| A3 | **Notificação ao admin sobre novo cadastro.** Mencionada indiretamente ("admin aprova cadastro"), mas nenhum mecanismo definido. O admin precisa verificar manualmente a lista de pendentes? Ou há e-mail/push ao criar uma conta? | Experiência operacional do admin |
| A4 | **Fluxo exato de "Esqueci minha senha".** É um modal dentro da tela de login, ou uma rota separada `(auth)/esqueci-senha`? O e-mail do usuário é preenchido automaticamente pelo campo e-mail já digitado? | Definição de rota e UX |
| A5 | **Termos de Uso e Política de Privacidade.** A imagem de cadastro mostra um checkbox "Li e aceito os Termos de Uso e a Política de Privacidade" com links. Esses documentos existem? São páginas internas ou externas? O aceite é salvo no doc Firestore? | Requisito legal e modelo de dados |
| A6 | **Campo "Confirmar Senha" no backend.** A validação é apenas frontend (Zod `refine` comparando os dois campos) — o Firebase Auth não tem "confirmar senha". Isso é aceitável? | Confirmação de escopo |
| A7 | **Política de exibição de usuários no painel admin.** O admin vê apenas usuários `pending`, ou todos (pending + approved + blocked)? Precisa de ação de desbloquear (`blocked → approved`)? | Escopo do painel admin |
| A8 | **Apelido (nickname) deve ser único?** O schema não define unicidade. O Firestore não tem constraint de unicidade nativa. Se for requisito de negócio, implementar verificação (query antes de criar) com risco de race condition. | Modelo de dados |

---

## 7. Impacto UI/Layout

**UI Impact:** sim
**Plataformas:** web (mobile-first, responsivo)
**Telas afetadas:**
- `(auth)/login` — substituir placeholder por formulário real
- `(auth)/cadastro` — nova rota, novo formulário
- `(auth)/pending` — expandir `PendingApprovalScreen` existente
- `(app)/admin/usuarios` — nova tela no shell protegido

**Product type:** sports betting pool — web app mobile-first; área de autenticação com estética de app nativo (dark/light, card centralizado, tipografia limpa).

**Direção de estilo (derivada das imagens de referência + design-system/MASTER.md):**

### Descrição visual das imagens de referência

**`login.png` — Tela de Login:**
Layout de app mobile. Fundo escuro (quase preto) com logo "Bolão dos Parças" centralizado no topo (tipografia bold com ícone de bola de futebol dourada). Abaixo do logo: texto de boas-vindas ("Bem-vindo de volta!") em branco, subtítulo em cinza claro. Card central com campos "Email" e "Senha" (inputs com fundo escuro, borda sutil, placeholder cinza). Link "Esqueci minha senha" abaixo do campo de senha, alinhado à direita. Botão CTA "Entrar" em verde esportivo (#3D7A3D ou equivalente), largura total, bordas arredondadas. Footer: "Não tem conta? Cadastre-se" como link textual. BottomNav visível com 5 ícones (Home, Jogos, Palpites, Ranking, Perfil). Paleta: fundo `#1A1A2E` ou similar (dark), primário verde, texto branco/cinza. A anotação lateral lista: Objetivo (autenticar usuário), Elementos (logo, boas-vindas, e-mail, senha, "Esqueci minha senha", Entrar, Cadastre-se, nav inferior), Cores (verde Principal, Secundária cinza claro, branco, cinza médio, branco), Tipografia (Poppins Bold título, Poppins Regular texto, links Poppins Medium).

**`cadastro.png` — Tela de Cadastro:**
Mesmo fundo escuro. Logo "Bolão dos Parças" menor, no topo. Título "Criar sua conta" em branco bold. Subtítulo em cinza. Campos: Nome completo, Apelido, E-mail, Senha (com olho para mostrar/ocultar), Confirmar senha (com olho). Checkbox "Li e aceito os Termos de Uso e a Política de Privacidade" (checkbox quadrado, texto com links sublinhados). Botão CTA "Criar conta" em verde, largura total. Footer: "Já tem conta? Fazer login". BottomNav visível. Anotações: campos obrigatórios marcados, Checkbox Termos de Uso (con opção de visualizar), Checklist Confirmar senha (validação visual), Link para tela de login; Regras: todos os campos obrigatórios, e-mail com validação de formato, senha mínimo 6 caracteres, todas as ações com feedback visual, botão desabilitado até preencher.

**`PRD01-Layout-Autenticacao.png` — Overview das 3 telas:**
Visão panorâmica com os 3 mockups lado a lado num fundo branco com descrição: "PRD 01 - AUTENTICAÇÃO — Permitir cadastro, login e aprovação de usuários." Tela 1 (Login): fundo escuro, logo topo, campos Email/Senha, botão "Entrar" verde, link Cadastrar-se. Tela 2 (Cadastro): fundo escuro, logo, título "Criar sua conta", campos Nome completo/Apelido/E-mail/Senha com máscaras, botão "Criar conta" verde, link "Já tem conta? Entrar". Tela 3 (Aguardando Aprovação): fundo branco/claro, ícone de relógio centralizado (clock circle), título "Aguardando Aprovação", mensagem "Cadastro realizado! Seu acesso está aguardando aprovação do administrador. Você receberá um email quando sua conta for liberada.", botão "Atualizar status" (estilo outline ou secundário). A tela pending usa fundo **claro** (light mode), quebrando o padrão escuro das telas de auth.

**Decisões de estilo para implementação:**

| Aspecto | Decisão |
|---|---|
| Fundo das telas Login/Cadastro | `bg-background` dark ou fundo escuro dedicado — alinhar com o tema dark sugerido pelas imagens; se o app usa light mode por padrão, aplicar `dark` na `AuthLayout` ou usar card centralizado sobre fundo neutro |
| Card de formulário | `bg-card rounded-xl shadow-md p-6` centralizado; max-width ~360–400px; `mx-auto` |
| Botão CTA principal | `Button variant="default"` largura total (`w-full`); em light mode será `bg-primary` (cinza escuro); as imagens mostram verde — verificar se token `--primary` deve ser ajustado para verde esportivo ou se as imagens usam tema divergente |
| Tela Pending | Fundo claro (`bg-background` light), sem card — conteúdo centralizado com `flex flex-col items-center justify-center min-h-screen`; ícone Clock grande; botão "Atualizar Status" outline |
| Logo | Usar logo `Bolão dos Parças` com ícone de bola — verificar se existe arquivo de logo em `public/` ou se é tipografia pura |
| Tipografia | `font-sans` (Inter) conforme design-system; títulos `text-2xl font-bold`, subtítulos `text-sm text-muted-foreground` |
| Inputs | `Input` Shadcn com `border-input`; fundo `bg-background`; placeholder `text-muted-foreground` |
| Senha com visibilidade | Adicionar botão `ghost` com ícone `Eye`/`EyeOff` (Lucide) à direita do input; não é componente Shadcn padrão — compor |
| Links textuais | `Button variant="link"` ou `<Link>` com `text-primary underline text-sm` |
| BottomNav nas telas auth | As imagens mostram BottomNav nas telas de login/cadastro, mas o shell de app (AppShell) provavelmente não envolve o `(auth)` layout. Definir se BottomNav é exibido em telas públicas ou apenas no app interno. |

**Design complexity:** média (formulários com validação inline, estados de loading/erro, componente de senha com toggle, tela pending com refresh ativo, painel admin com tabela).

---

## 8. Preocupações de implementação (alto nível, sem tarefas)

- **Atomicidade do cadastro:** implementar tratamento de falha no `setDoc` pós-`createUserWithEmailAndPassword` com rollback via `user.delete()` do Firebase Auth Client SDK para evitar usuários órfãos (auth sem perfil Firestore).

- **Separação de schemas de formulário vs. schema de coleção:** o `userSchema` (Zod) valida o documento Firestore. Os formulários precisam de schemas independentes (ex.: `loginFormSchema`, `signupFormSchema`) que incluem campos como `confirmPassword` que não existem no Firestore. Colocá-los em `features/auth/schemas.ts` — não contaminar `src/schemas/users.ts`.

- **`refreshProfile` no `AuthProvider`:** o botão "Atualizar Status" precisa forçar releitura do `users/{uid}`. Avaliar se expor `refreshProfile(): Promise<void>` no `AuthContextValue` é a abordagem correta ou se a tela pending faz `getDoc` diretamente e, se aprovado, dispara navegação — sem depender do contexto para isso.

- **Security Rules para `list` na coleção `users`:** testar com `@firebase/rules-unit-testing` se admin consegue executar `collection("users").where("status","==","pending").get()`. Se a rule `match /users/{uid}` não cobrir list queries, adicionar `match /users/{document=**}` para admin — ou usar Admin SDK via Cloud Function para operações de listagem admin.

- **Painel admin e roles:** a rota `/admin/*` deve ter guarda de role além do `AuthGuard`. Criar `AdminGuard` ou estender o `AuthGuard` com verificação de `role === "admin"`. Redirecionar `role === "user"` para `/home` (não expor 404 que revela a existência da rota).

- **Bootstrapping do primeiro admin:** definir e documentar o procedimento operacional (script de seed ou Console Firebase) antes do primeiro deploy em produção. Sem isso, o sistema é inoperável.

- **Mapeamento de erros Firebase Auth para pt-BR:** os códigos de erro (`auth/wrong-password`, `auth/user-not-found`, `auth/email-already-in-use`, `auth/weak-password`, `auth/too-many-requests`) devem ser mapeados para mensagens amigáveis em português. Centralizar em `features/auth/errors.ts` ou `lib/firebase-errors.ts`.

- **BottomNav em telas de auth:** as imagens de referência mostram a BottomNav nas telas de login/cadastro. Isso é inconsistente com a arquitetura do `AuthLayout` (sem AppShell). Esclarecer se é erro de design ou intenção, e como integrar se necessário.

- **Logo "Bolão dos Parças":** as imagens mostram um logotipo visual (ícone de bola de futebol + tipografia bold). Verificar se existe arquivo SVG/PNG em `public/` ou se será implementado com tipografia + ícone Lucide compostos. Essa decisão afeta o componente de logo compartilhado entre Login e Cadastro.

---

*Este PRD é insumo para `/plan`. Não contém tarefas, story points ou código. A fundação (PRD-00/`ai/prd/feature.md`) não deve ser substituída — este documento é complementar e autônomo.*
