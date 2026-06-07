# PRD — Aprovação de Usuários (PRD-01.2)

> Fonte de verdade: `docs/prd-01-2/` — `PRD-01-2-Aprovacao-Usuarios.md` + 6 imagens (01–06).
> Constraint do usuário: **telas 01, 02 e 06 NÃO têm BottomTabBar** (pending/blocked não acessa nav interna). Telas 03/04/05 têm nav.

## 0. Decisões travadas (resolvem §6)

| Ref | Decisão |
|-----|---------|
| A1 | **Rejeitar = marcar `blocked`** (sem mudança de enum; reversível) |
| A2 | **Escrita admin = Client SDK + Firestore Security Rules** (sem Cloud Function) |
| A4 | **Tela 01 cortada** — signup mantém auto-login; `AuthGuard` leva direto a `/pending`. Mock 01 não será implementado |
| A5 | **Desbloquear permitido** — admin reverte `blocked→approved` na tab Bloqueados |
| A6 | **Sem serviço de email** — apenas emails nativos do Firebase Auth (reset de senha). **Nenhum** email de aprovação. Tela 02 deve **remover** a frase "você receberá um email" |
| A3 | **Painel admin é exclusivo de `role === "admin"`** — invisível para `user`. Gating em 3 camadas: (1) entrada de nav/menu só aparece p/ admin; (2) route guard em `/admin` bloqueia/redireciona não-admin mesmo via URL direta; (3) Security Rules recusam list/update de `users` a não-admin. Defesa em profundidade — UI esconde, guard barra, rules são a autoridade final |

## 1. Feature summary

Painel administrativo para o admin **aprovar, rejeitar e bloquear** usuários cadastrados, fechando o ciclo de acesso do PRD-01: `cadastro → pending → aprovação do admin → acesso liberado`. Inclui a tela de confirmação pós-cadastro (tela 01) e a aplicação consistente da máquina de estados de acesso (`pending` / `approved` / `blocked`) já iniciada no PRD-01.

O grosso da máquina de estados **já existe** (AuthProvider, AuthGuard, PendingApprovalScreen, BlockedScreen). O que falta é majoritariamente o **lado admin** (telas 03/04/05), a tela de sucesso de cadastro (tela 01) e o **gating de segurança** das escritas administrativas.

## 2. Consolidated scope

Mapa imagem → tela → estado (numeração das imagens diverge da numeração do `.md`; abaixo a das imagens):

| Img | Tela | Estado | Nav | Situação atual |
|-----|------|--------|-----|----------------|
| 01 | Cadastro realizado! ("Ir para o login") | pós-signup | ❌ | **Não existe** (hoje só toast em `SignupForm`) |
| 02 | Aguardando aprovação ("Atualizar status" / "Sair") | pending | ❌ | Existe (`PendingApprovalScreen`); falta botão "Sair" |
| 03 | Usuários Pendentes — tabs Pendentes/Aprovados/Bloqueados + lista | admin | ✅ | **Não existe** (`features/admin` vazio) |
| 04 | Modal "Usuário aprovado!" | admin | ✅ | **Não existe** |
| 05 | Home do aprovado ("Fala João", dashboard) | approved | ✅ | Placeholder `/home`; dashboard é PRD futuro |
| 06 | Conta bloqueada | blocked | ❌ | Existe (`BlockedScreen`) |

**Em escopo:**
1. Painel admin (telas 03/05): rota `/admin`, tabs Pendentes/Aprovados/Bloqueados, lista de usuários (avatar, nome, email, data de cadastro), contadores por tab.
2. Ações admin: **Aprovar** (`pending→approved`), **Rejeitar** (`pending→blocked`, A1), **Bloquear** (`approved→blocked`), **Desbloquear** (`blocked→approved`, A5).
3. Modal de confirmação de aprovação (tela 04).
4. Camada de dados admin: listar usuários por status via TanStack Query + serviço de mutação de status.
5. **Firestore Security Rules** gating leitura/escrita administrativa (arquivo não existe hoje).
6. Ponto de acesso do admin ao painel (nav/menu role-gated).
7. Botão "Sair" na tela 02 + **remover** a frase "você receberá um email" (A6 — não há email de aprovação).

**Fora de escopo:**
- **Tela 01** (Cadastro realizado) — cortada (A4); signup mantém auto-login → `/pending`.
- Dashboard real da home (tela 05 permanece placeholder; conteúdo é PRD futuro).
- Bootstrap/promoção do primeiro admin (`role` é promovido por Cloud Function — CLAUDE.md).
- Qualquer serviço de envio de email (A6) — só os emails nativos do Firebase Auth.

## 3. System understanding (partes relevantes)

- **Auth/estado** já implementado:
  - `AuthProvider` expõe `profile`, `status`, `role`, `loading`, `error`, `refreshProfile()` (releitura sob demanda — usado pelo "Atualizar status").
  - `AuthGuard` (em `(app)/layout.tsx`) já roteia por status: `loading→Loading`, sem auth→`/login`, `pending→/pending`, `blocked|null→BlockedScreen`, `approved→children`. **A integração de acesso já está pronta**; aprovar/bloquear muda o doc e o guard reage.
  - Constraint do tabbar **já satisfeita** para 02 (rota `(auth)/pending`, fora do AppShell) e 06 (`BlockedScreen` renderizado pelo AuthGuard *no lugar* do AppShell). Tela 01 deve seguir o mesmo padrão (grupo `(auth)`, sem AppShell).
- **Dados**: coleção `users` (`users/{uid}`) com `userSchema` (`status: pending|approved|blocked`, `role: user|admin`, `createdAt` ISO já gravado no signup). `Data Cadastro` da tela 03 vem de `createdAt`.
- **Serviços**: `services/auth.ts` cobre signUp/signIn/signOut/reset. **Não há** serviço de listagem de usuários nem de mutação de status por terceiro.
- **UI base (Shadcn)** presente: button, checkbox, form, input, label, sonner, tooltip. **Faltam**: `tabs`, `dialog` (modal tela 04), `avatar`, `badge` (contadores), possivelmente `card`.
- **Segurança**: **não existe `firestore.rules`** no repositório. Hoje qualquer escrita depende só do default do projeto — gating administrativo precisa ser criado.

## 4. Technical impact analysis

- **STACK**: Next.js App Router (nova rota `/admin` no grupo `(app)`), React 19, TanStack Query (listagem + mutações), Zod (schema de mutação de status), Shadcn (novos primitivos), Sonner (feedback), date-fns (formatar `createdAt`).
- **ARCHITECTURE**:
  - Nova feature `features/admin/` (componentes: lista, item de usuário, tabs, modal de confirmação; hooks de query/mutation).
  - Novo serviço `services/users.ts` (ou estender): `listUsersByStatus`/`listUsers`, `updateUserStatus(uid, status)`.
  - Novo schema de input para mutação de status (Zod, restrito às transições válidas).
  - Tela 01: nova rota/estado no fluxo de cadastro em `(auth)`.
  - Ponto de navegação admin: item de nav/menu condicionado a `role === "admin"` (Header tem slot reservado; BottomNav/SideNav usam `NAV_ITEMS`).
- **INTEGRATIONS / persistência**:
  - Escritas em docs de **outros** usuários (admin altera `status` alheio) — exige Security Rules. Decisão de caminho: **client SDK + rules** vs **Cloud Function** (§6).
  - Leitura de coleção inteira `users` (list/query por status) — exige rule de leitura para admin e índice trivial (`where status ==`).
- **CONCERNS**:
  - **Segurança/escalada de privilégio** (alta): sem rules, um `user` poderia auto-aprovar/auto-promover editando o próprio doc. Rules devem: permitir a admin alterar **apenas** `status` de terceiros; impedir qualquer cliente de alterar o próprio `role`/`status`; manter o self-write do signup restrito a `role:user`/`status:pending`.
  - **Consistência de UI**: após mutação, invalidar queries (contadores + listas das 3 tabs) para refletir a troca de aba do usuário.
  - **Performance/escala**: <100 usuários → listagem simples sem paginação é aceitável; contador "Aprovados 52" cabe em uma query/contagem leve.
  - **Acesso reativo**: aprovação não emite evento de Auth no cliente do usuário; o caminho de atualização é o "Atualizar status" (polling manual) já existente — sem realtime push.

## 5. Riscos

1. **Ausência de `firestore.rules`** → risco de escalada de privilégio (auto-aprovação/auto-admin). Mitigação obrigatória neste PRD: criar e versionar as rules antes de habilitar escrita administrativa.
2. **"Rejeitar" sem status correspondente** no enum (`pending|approved|blocked`) → comportamento indefinido (ver §6).
3. **Tela 01 vs auto-login**: `createUserWithEmailAndPassword` **já autentica** o usuário; ao cair o signup o `AuthGuard` levaria a `/pending`. O botão "Ir para o login" da tela 01 pressupõe usuário deslogado → precisa decidir se o signup faz `signOut` antes de exibir a tela 01 (ver §6).
4. **Promessa de email** na tela 02 ("você receberá um email quando for liberado") sem mecanismo de envio → expectativa não cumprida se não houver Cloud Function.
5. **Bootstrap de admin**: sem um primeiro admin, o painel é inacessível; depende de promoção fora de banda (Cloud Function / console).
6. **Invalidação de cache**: esquecer de invalidar as 3 tabs/contadores após mutação gera contagem/lista obsoleta.

## 6. Ambiguidades e lacunas

| # | Ambiguidade | Opções | Recomendação |
|---|-------------|--------|--------------|
| A1 | Semântica de **Rejeitar** (enum só tem pending/approved/blocked) | (a) deletar conta/doc; (b) marcar `blocked`; (c) adicionar status `rejected` | Decisão de produto. Default sugerido: `blocked` (reversível, sem perda de dado) **ou** novo `rejected` se quiser distinguir na tab |
| A2 | **Caminho de escrita** admin | (a) client SDK + Security Rules; (b) Cloud Function `setStatus` | (a) para custo/simplicidade (<100 users); rules robustas bastam |
| A3 | ~~Acesso ao painel~~ **RESOLVIDO (§0)**: exclusivo admin, gating em 3 camadas (nav oculto + route guard + rules). Forma da entrada (nav item vs menu no Header) fica a cargo do `/screen` | — | resolvido |
| A4 | **Tela 01** — signup auto-loga; "Ir para o login" pressupõe deslogado | (a) `signOut` após signup → mostra tela 01 → login; (b) sem tela 01, manter guard→/pending | Decisão de produto; (a) honra o mock |
| A5 | **Desbloquear** usuário na tab Bloqueados | mock/`.md` não preveem ação de unblock | Confirmar se admin pode reverter `blocked→approved` |
| A6 | **Email de aprovação** | Cloud Function on-update vs fora de escopo | Marcar fora de escopo deste PRD ou abrir tarefa separada |
| A7 | Formato/timezone de **Data Cadastro** | `dd/MM/yyyy HH:mm` (mock) em qual fuso | date-fns, fuso local; confirmar |

## 7. UI/Layout impact

- **UI Impact:** yes
- **Platforms:** web (Next.js, mobile-first/responsivo)
- **Screens:** Tela 01 (Cadastro realizado), Tela 03 (Usuários — tabs + lista), Tela 04 (modal Usuário aprovado), Tela 02 (ajuste: botão "Sair"). Telas 05/06 sem novo design (05 placeholder, 06 já existe).
- **Product type:** painel administrativo de gestão de usuários dentro de um PWA de bolão esportivo
- **Recommended style direction:** travada por `design-system/MASTER.md` (superfície clara, primary verde, Shadcn, mobile-first). Reusar; gerar overrides de página só p/ lista/tabs/modal se necessário.
- **Design complexity:** medium
- Novos primitivos Shadcn prováveis: `tabs`, `dialog`, `avatar`, `badge`, (`card`).
- Constraint do tabbar: tela 01 nova **sem** AppShell (grupo `(auth)`); 02/06 já conformes.

## 8. Implementation concerns (alto nível, sem tarefas)

- Criar `firestore.rules` **antes** de habilitar escrita administrativa; modelar: self-signup (`role:user`/`status:pending` apenas), admin pode ler todos e atualizar somente `status` de terceiros, ninguém altera o próprio `role`/`status` via cliente.
- Serviço `services/users.ts` + schema Zod de transição de status (validar transições permitidas).
- `features/admin/`: componente de painel com tabs (Pendentes/Aprovados/Bloqueados), item de usuário (avatar com iniciais, nome, email, data), ações por contexto, modal de confirmação.
- Hooks TanStack Query: listagem por status + contadores; mutação de status com invalidação das queries afetadas.
- Resolver A1 (Rejeitar) e A4 (tela 01) **antes** do `/plan`, pois mudam schema e fluxo.
- Reaproveitar AuthGuard/máquina de estados existente — sem reescrever roteamento por status.
- Adicionar entrada de navegação role-gated (A3).
- Decidir email de aprovação (A6) — provável tarefa/PRD separado (Cloud Function).
