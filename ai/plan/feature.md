# PLAN — Fundação Arquitetural (PRD-00)

> Entrada: `ai/prd/feature.md`. Metodologia goal-backward + ondas paralelas.

## 1. Resumo do planejamento

PRD define a **arquitetura base** do Bolão dos Parças, não uma feature de usuário. O plano cobre scaffold do projeto, tooling obrigatório, integração Firebase, modelagem Firestore, regras de segurança e esqueleto de Cloud Functions para API-Football. Nenhuma tela de produto final aqui (vêm em PRD-01+); apenas **app shell** mínimo e provedores globais.

Total de tarefas: **11**. Predominantemente `infra` / `persistence` / `integration`. Apenas 1 com saída visual (app shell).

Truths que devem ser verdadeiras ao fim:
- Projeto Next.js 15 + TS strict compila e roda local.
- Tailwind + Shadcn configurados, tema base aplicável.
- Libs obrigatórias instaladas + provedores globais ativos (React Query, Sonner, Auth).
- Firebase inicializado (client + admin), Firestore funcional.
- 9 coleções modeladas como tipos/schemas Zod.
- Firestore Security Rules bloqueiam acesso por `status`/`role`.
- Cloud Function esqueleto consome API-Football server-side e grava no Firestore.
- Deploy Hosting + Functions configurado, env gerenciado.

## 2. Fases recomendadas de execução

1. **Fundação** — scaffold, tooling, libs, estrutura (TASK-01..04)
2. **Backend/Firebase** — init, provedores, modelo de dados, security rules (TASK-05..08)
3. **Integração/Exposição** — Cloud Functions + API-Football, hosting/deploy, app shell (TASK-09..11)

## 3. Tarefas

### TASK-01 – Scaffold Next.js 15 + TypeScript + Tailwind
- Type: infra
- Goal: Inicializar projeto Next.js 15 (App Router) com React 19, TypeScript strict e Tailwind CSS.
- Scope: `create-next-app`, `tsconfig` strict (`strict: true`, sem `any`), config Tailwind, scripts npm, `.gitignore`, ESLint/Prettier base.
- Main modules/files: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `src/app/layout.tsx`, `src/app/globals.css`
- Dependencies: —
- Story points: 2
- Criticality: critical
- Technical risk: low
- Recommended TDD: no
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: Base de tudo. Confirmar compat React 19 + Next 15.

### TASK-02 – Configurar Shadcn UI + tema base
- Type: infra
- Goal: Instalar e inicializar Shadcn UI com tema (cores, radius, dark mode opcional) mobile-first.
- Scope: `shadcn init`, `components.json`, tokens de tema em `globals.css`, 3-4 componentes base (button, input, form, sonner).
- Main modules/files: `components.json`, `src/components/ui/*`, `src/lib/utils.ts`, `globals.css`
- Dependencies: TASK-01
- Story points: 2
- Criticality: high
- Technical risk: low
- Recommended TDD: no
- Recommended screen: no – n/a (config de design system, não tela)
- Design domains: style, color, typography
- Design complexity: low
- Accessibility level: standard
- Notes: Tema base alimenta o futuro `design-system/MASTER.md`.

### TASK-03 – Instalar e configurar libs obrigatórias
- Type: infra
- Goal: Instalar todas as libs mandatórias do PRD-00 e validar import.
- Scope: Zod, React Hook Form, @hookform/resolvers, TanStack Query, TanStack Table, date-fns, Lucide React, Sonner, Framer Motion. Pin de versões.
- Main modules/files: `package.json`, `src/lib/`
- Dependencies: TASK-01
- Story points: 1
- Criticality: high
- Technical risk: low
- Recommended TDD: no
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: Sem wiring de provider ainda (TASK-06). Só instalação + smoke import.

### TASK-04 – Criar estrutura de pastas + barrels
- Type: infra
- Goal: Materializar estrutura `src/` e `features/` do PRD-00 com placeholders tipados.
- Scope: Diretórios `app, components, features/{auth,home,matches,predictions,rankings,statistics,profile,admin}, services, hooks, schemas, types, lib, firebase, providers`. Barrels onde fizer sentido.
- Main modules/files: árvore `src/**`
- Dependencies: TASK-01
- Story points: 1
- Criticality: medium
- Technical risk: low
- Recommended TDD: no
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: Convenção, sem lógica. Imports consistentes nas features futuras.

### TASK-05 – Inicializar Firebase (client + admin SDK)
- Type: integration
- Goal: Configurar projeto Firebase e init SDK client (browser) e admin (server/functions).
- Scope: `firebase init` (Firestore, Functions, Hosting, Auth), `src/firebase/client.ts`, `src/firebase/admin.ts`, env vars (`NEXT_PUBLIC_FIREBASE_*` + service account server-side), `firebase.json`, `.firebaserc`.
- Main modules/files: `src/firebase/client.ts`, `src/firebase/admin.ts`, `firebase.json`, `.firebaserc`, `.env.local.example`
- Dependencies: TASK-01
- Story points: 3
- Criticality: critical
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: Segredos server-side nunca expostos ao browser. Usar emulador se sem projeto real.

### TASK-06 – Provedores globais (QueryClient, Auth, Toaster)
- Type: application
- Goal: Montar provedores raiz: React Query (staleTime 30min / gcTime 24h), AuthProvider (sessão Firebase), Sonner Toaster.
- Scope: `providers/QueryProvider.tsx`, `providers/AuthProvider.tsx`, `providers/index.tsx`, wiring no `app/layout.tsx`. Hook `useAuth`.
- Main modules/files: `src/providers/*`, `src/hooks/useAuth.ts`, `src/app/layout.tsx`
- Dependencies: TASK-03, TASK-05
- Story points: 3
- Criticality: critical
- Technical risk: medium
- Recommended TDD: yes
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: `useAuth` carrega perfil + status do Firestore. Sessão = regressão-prone → TDD.

### TASK-07 – Modelo de dados Firestore (tipos + schemas Zod)
- Type: persistence
- Goal: Definir tipos TS e schemas Zod para as 9 coleções.
- Scope: `schemas/*.ts` (Zod) + `types/*.ts` derivados (`z.infer`) para users, teams, groups, matches, predictions, rankings, statistics, bonus_predictions, system_settings. Enums role/status/stage.
- Main modules/files: `src/schemas/*`, `src/types/*`
- Dependencies: TASK-04
- Story points: 3
- Criticality: high
- Technical risk: low
- Recommended TDD: yes
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: Schemas Zod = fonte única de verdade. TDD valida parsing/refinements.

### TASK-08 – Firestore Security Rules (status/role)
- Type: infra
- Goal: Escrever e testar regras que bloqueiam acesso por `status` e `role`.
- Scope: `firestore.rules` — `approved` lê áreas internas; `pending`/`blocked` negados; admin gerencia `users`; escrita de palpites só do próprio uid; leitura pública controlada (teams/matches). Testes via emulador.
- Main modules/files: `firestore.rules`, `firestore.indexes.json`, testes de regras
- Dependencies: TASK-05, TASK-07
- Story points: 5
- Criticality: critical
- Technical risk: high
- Recommended TDD: yes
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: Risco alto — controle de acesso = segurança. Gap PRD (R1). TDD com `@firebase/rules-unit-testing` obrigatório.

### TASK-09 – Esqueleto Cloud Functions + integração API-Football
- Type: integration
- Goal: Cloud Function server-side que consome API-Football e grava no Firestore (nunca frontend direto).
- Scope: pasta `functions/`, função callable/scheduled exemplo (ex: sync teams), cliente HTTP API-Football com chave em env servidor, mapeamento → schema Firestore, tratamento cota/erro. Scheduler stub 02:00.
- Main modules/files: `functions/src/index.ts`, `functions/src/apiFootball/*`, `functions/package.json`
- Dependencies: TASK-05, TASK-07
- Story points: 5
- Criticality: high
- Technical risk: high
- Recommended TDD: yes
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: Gap PRD (R2): cota + IDs Copa 2026 indefinidos. Implementar com mock/fallback. TDD no mapeamento.

### TASK-10 – Firebase Hosting + deploy + gestão de env
- Type: infra
- Goal: Configurar deploy Next.js no Firebase Hosting + Functions e gestão de ambientes.
- Scope: `firebase.json` (hosting + rewrites Functions/SSR), build script, env por ambiente (dev/prod), doc de deploy. Smoke deploy.
- Main modules/files: `firebase.json`, scripts de deploy, `.env.production.example`, doc
- Dependencies: TASK-05, TASK-09
- Story points: 3
- Criticality: medium
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: no – n/a
- Design domains: n/a
- Design complexity: n/a
- Accessibility level: n/a
- Notes: Gap PRD (R3): Next 15 SSR no Hosting exige frameworks-aware hosting ou adapter. Validar cedo.

### TASK-11 – App shell + layout base (mobile-first)
- Type: ui
- Goal: Esqueleto de layout raiz mobile-first com navegação base e estados de auth (logado/deslogado/pendente).
- Scope: `app/layout.tsx` shell, container responsivo, slot de navegação, roteamento protegido base (redirect por status), tela placeholder. Sem telas de feature.
- Main modules/files: `src/app/layout.tsx`, `src/components/layout/*`, guard de rota
- Dependencies: TASK-02, TASK-06
- Story points: 3
- Criticality: high
- Technical risk: medium
- Recommended TDD: no
- Recommended screen: yes – web – shell de layout + navegação + guard por status
- Design domains: style, ux, layout
- Design complexity: medium
- Accessibility level: enhanced
- Notes: 1ª tarefa de UI → /screen gera `design-system/MASTER.md` com `--design-system --persist`.

## 4. Mapa de dependências

```
TASK-01 (scaffold)
├── TASK-02 (shadcn)
├── TASK-03 (libs)
├── TASK-04 (estrutura)
└── TASK-05 (firebase init)
        ├── TASK-06 (providers)      ← + TASK-03
        ├── TASK-07 (modelo dados)   ← + TASK-04
        │     ├── TASK-08 (security rules)  ← + TASK-05
        │     └── TASK-09 (functions/api)   ← + TASK-05
        │           └── TASK-10 (hosting/deploy) ← + TASK-05
        └── TASK-11 (app shell)       ← + TASK-02, TASK-06
```

## 5. Ondas de execução (grupos paralelos)

- **Wave 1:** TASK-01 *(bloqueante, roda sozinha)*
- **Wave 2:** TASK-02, TASK-03, TASK-04, TASK-05 *(independentes após scaffold)*
- **Wave 3:** TASK-06, TASK-07 *(dependem de Wave 2)*
- **Wave 4:** TASK-08, TASK-09, TASK-11 *(dependem de Wave 3)*
- **Wave 5:** TASK-10 *(depende de TASK-09)*

## 6. Ordem sequencial (fallback)

01 → 03 → 04 → 02 → 05 → 07 → 06 → 11 → 08 → 09 → 10

Início recomendado: **TASK-01** (bloqueia tudo).

## 7. Riscos e bloqueios de planejamento

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| R1 | Firestore Security Rules não especificadas (TASK-08) | Alta | Derivar de status/role; TDD com rules-unit-testing |
| R2 | API-Football: cota + IDs Copa 2026 (TASK-09) | Alta | Mock/fallback; sync sob demanda; abstrair cliente |
| R3 | Next 15 SSR no Firebase Hosting (TASK-10) | Média | Validar frameworks-aware hosting ou static export + Functions |
| R4 | Compat React 19 + Next 15 + Shadcn | Média | Pin de versões; smoke test no scaffold |
| R5 | Notificação ao admin de novo cadastro | Baixa | Fora do escopo PRD-00; tratar em PRD-01 |

**TDD recomendado:** TASK-06, TASK-07, TASK-08, TASK-09.
**/screen recomendado:** TASK-11 (única UI; gera design system master).
