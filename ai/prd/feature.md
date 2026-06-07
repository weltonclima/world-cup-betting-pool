# PRD — Fundação Arquitetural (Bolão dos Parças)

> Origem: `docs/prd-00/PRD-00-Arquitetura-Bolao-dos-Parcas.md`. Este documento traduz a arquitetura base em entendimento técnico de engenharia, análise de impacto e riscos — pré-requisito para `/plan`.

## 1. Resumo da feature

Estabelecer a **fundação arquitetural** do Bolão dos Parças: aplicação web de prognósticos da Copa do Mundo 2026 (placar exato, pontuação binária), mobile-first, baixo custo, < 100 usuários. Não é uma feature de usuário final — é o alicerce sobre o qual todas as features do MVP (auth, jogos, palpites, rankings, estatísticas) serão construídas.

Entregáveis centrais: scaffold Next.js 15/React 19/TS, tooling obrigatório, integração Firebase (Auth/Firestore/Functions/Hosting), modelagem das 9 coleções Firestore, regras de segurança por status/role, e o pipeline server-side API-Football → Cloud Functions → Firestore → Frontend.

## 2. Escopo consolidado

**Dentro do escopo:**
- Projeto Next.js 15 (App Router) + React 19 + TypeScript strict.
- Tailwind CSS + Shadcn UI com tema base mobile-first.
- Libs obrigatórias instaladas e wired: Zod, React Hook Form, TanStack Query, TanStack Table, date-fns, Lucide, Sonner, Framer Motion.
- Estrutura de pastas `src/` + `features/` por domínio.
- Firebase inicializado (client + admin SDK), env gerenciado.
- Provedores globais: QueryClient (staleTime 30min / gcTime 24h), AuthProvider, Sonner.
- Tipos + schemas Zod das 9 coleções Firestore.
- Firestore Security Rules por `status` (pending/approved/blocked) e `role` (user/admin).
- Esqueleto Cloud Functions + cliente API-Football server-side + scheduler stub 02:00.
- Configuração de deploy Firebase Hosting + Functions.
- App shell mobile-first com guard de rota por status.

**Fora do escopo (features posteriores):**
- Telas de Login/Cadastro/Aprovação (PRD-01).
- Lógica de palpites, cálculo de rankings e estatísticas.
- Sync completo de dados reais da Copa.
- Notificação ao admin de novos cadastros.

## 3. Entendimento do sistema (partes relevantes)

Projeto **greenfield** — sem código existente. Único insumo: PRD-00 (arquitetura) + PRD-01 (auth, referência futura). `.claude/CLAUDE.md` consolida o contexto de engenharia.

Camadas arquiteturais definidas:
- **Apresentação:** `app/` (rotas) + `components/` + `features/*` (UI por domínio).
- **Estado/dados:** `providers/` (QueryClient, Auth) + `hooks/` + TanStack Query.
- **Contratos:** `schemas/` (Zod, fonte única) + `types/` (derivados).
- **Acesso a dados:** `services/` (Firestore) + `firebase/` (init).
- **Servidor:** Cloud Functions (`functions/`) — único ponto de contato com API-Football.

Fluxo de dados crítico: **API-Football → Cloud Functions → Firestore → Frontend**. Browser nunca chama API-Football direto.

## 4. Análise de impacto técnico

| Área | Impacto |
|---|---|
| **Stack** | Define toda a stack — decisão irreversível de alto custo de mudança |
| **Módulos** | Cria todos os módulos base (`src/**`, `functions/**`) |
| **Persistência** | Modela 9 coleções Firestore + índices + regras de segurança |
| **Integrações** | Firebase (4 produtos) + API-Football (externa, com cota) |
| **API/Eventos** | Cloud Functions callable + scheduled (cron 02:00) |
| **Performance** | Cache React Query (30min/24h) + Local Storage; otimizado p/ < 100 users |
| **Segurança** | Firestore Rules = principal barreira de acesso (status/role) |
| **Rollout** | Deploy Firebase Hosting com SSR Next 15 (ponto de atenção) |

## 5. Riscos

| # | Risco | Severidade |
|---|---|---|
| R1 | Firestore Security Rules **não especificadas** no PRD — controle de acesso é segurança crítica | Alta |
| R2 | API-Football: **cota** e **mapeamento de IDs Copa 2026** indefinidos; fixtures podem ainda não existir na API | Alta |
| R3 | Next 15 SSR no Firebase Hosting exige frameworks-aware hosting ou adapter | Média |
| R4 | Compatibilidade de versões React 19 + Next 15 + Shadcn | Média |
| R5 | Service account / segredos server-side podem vazar se mal configurados | Média |

## 6. Ambiguidades e lacunas

- **Regras Firestore:** quem lê/escreve cada coleção não foi definido — derivar de status/role.
- **API-Football:** plano/cota, estratégia de retry e mapeamento de entidades Copa 2026 não documentados.
- **Notificação ao admin** de novo cadastro: mencionada no fluxo, sem mecanismo (email? in-app?).
- **Recuperação de senha** ("Esqueci minha senha" no PRD-01) sem fluxo técnico definido.
- **Ambientes** (dev/staging/prod) e estratégia de seed de dados não especificados.
- **Bônus** (`bonus_predictions` — campeão/artilheiro): regras de pontuação não detalhadas.

## 7. Impacto UI/Layout

- **UI Impact:** sim (parcial — só app shell nesta fundação)
- **Platforms:** web (mobile-first responsivo)
- **Screens:** nenhuma tela de feature; apenas **app shell + layout base + guard por status**
- **Product type:** sports betting pool / dashboard web app
- **Recommended style direction:** mobile-first, Shadcn + Tailwind, estética esportiva limpa; tema base define tokens que alimentam o futuro `design-system/MASTER.md`
- **Design complexity:** baixa (nesta fundação); média/alta nas features seguintes

## 8. Preocupações de implementação (alto nível)

- **Ordem de fundação:** scaffold deve preceder tudo; Firebase init bloqueia provedores e dados.
- **Segurança primeiro:** Security Rules e modelagem de dados devem ser tratadas com TDD (rules-unit-testing).
- **Abstração da API-Football:** isolar cliente externo atrás de interface para permitir mock/fallback enquanto fixtures 2026 não existem.
- **Schemas Zod como contrato único:** tipos derivados de `z.infer`, sem duplicação manual.
- **SSR no Hosting:** validar abordagem de deploy cedo (TASK de hosting) para evitar retrabalho.
- **Env management:** separar `NEXT_PUBLIC_*` (client) de segredos server-side desde o início.

---

**Próximo stage:** `/plan` lê este arquivo e quebra em tarefas com ondas de execução paralela.
