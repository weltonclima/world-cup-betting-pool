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

> Esta é a fundação arquitetural (TASK-01). Design system, libs de domínio,
> Firebase e demais recursos são adicionados nas tarefas subsequentes.
# world-cup-betting-pool
