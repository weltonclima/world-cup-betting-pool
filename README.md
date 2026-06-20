# Bolão dos Parças

Sistema de prognósticos da Copa do Mundo 2026. Aplicação **Next.js 15** (App Router) com
**React 19**, **TypeScript** em modo strict (sem `any`) e **Tailwind CSS**.

## Pré-requisitos

- **Node.js** `>= 20` (LTS)
- **npm** (gerenciador de pacotes padrão do projeto)

## Instalação

```bash
npm install
```

## Comandos

| Comando                | Descrição                                       |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Sobe o servidor de desenvolvimento (Turbopack). |
| `npm run build`        | Gera o build de produção.                       |
| `npm run start`        | Inicia o servidor de produção (após `build`).   |
| `npm run lint`         | Executa o ESLint (flat config, ESLint 9).       |
| `npm run typecheck`    | Checagem de tipos com `tsc --noEmit`.           |
| `npm run format`       | Formata o código com Prettier.                  |
| `npm run format:check` | Verifica a formatação sem alterar arquivos.     |

## Desenvolvimento

```bash
npm run dev
```

A aplicação fica disponível em [http://localhost:3000](http://localhost:3000).

## Convenções

- **TypeScript strict**, proibição de `any` (regra ESLint `@typescript-eslint/no-explicit-any`).
- **Sem estilos inline** — estilização apenas via Tailwind CSS.
- Import alias `@/*` → `./src/*`.

## Cron de pontuação (PRD-15)

O pipeline **scoring → recalc → notificações** roda automaticamente via GitHub
Actions (`.github/workflows/score-cron.yml`), agendado a cada 30 min. O workflow faz
`POST /api/predictions/score` com o header `x-cron-secret`; esse único request
encadeia o recálculo de rankings e os fan-outs de notificações in-process.

Configuração (Settings do repositório → Secrets and variables → Actions):

| Nome              | Tipo     | Onde                  | Propósito                                                                 |
| ----------------- | -------- | --------------------- | ------------------------------------------------------------------------ |
| `SCORE_SECRET`    | secret   | GitHub **e** deploy   | Autoriza `POST /api/predictions/score`. Deve ser idêntico nos dois lados. |
| `RANKINGS_SECRET` | secret   | **só** deploy (Vercel) | Autoriza o recalc encadeado; sem ele, notificações de ranking não disparam. |
| `APP_BASE_URL`    | variable | GitHub (opcional)     | Sobrescreve a URL de produção (fallback `https://bolaodosparcas.vercel.app`). |

Gere os secrets com `openssl rand -base64 32`. **Nunca** commite valores reais nem
os exponha em logs. Disparo manual de teste: aba **Actions → score-cron → Run workflow**.

> Esta é a fundação arquitetural (TASK-01). Design system, libs de domínio,
> Firebase e demais recursos são adicionados nas tarefas subsequentes.
# world-cup-betting-pool
