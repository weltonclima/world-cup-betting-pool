# CLAUDE.md – Engineering Workflow Commands

## Overview

Project provides Claude Code **slash commands** that orchestrate semi-automatic SE workflows — feature, bugfix, hotfix, migration, refactor — from requirement consolidation to release. Commands live in `.claude/commands/<name>.md` (front-matter), invoked as `/<name>`. `flow*` commands run full pipelines with approval checkpoints.

## Model & Effort

Each command declares `model:`/`effort:` in front-matter (guidance, not enforced — runs in active session model):

- **opus/high** — deep reasoning: `prd`, `plan`, `review`, `diagnose`, `analyze`, `assess`
- **sonnet/high** — codegen: `spec`, `implement`, `tdd`, `fix`, `migrate`, `refactor`, `ui-spec`, `ui-review`
- **sonnet/medium** — structured: `test`, `validate`, `local-env`, `gate`, `release`, `context`, `setup`, `flow*`
- **haiku/medium** — mechanical: `commit`, `pr`, `progress`, `docs`

## Process skills (superpowers)

Process commands reference battle-tested **superpowers** skills for *how* to work. User instructions + project conventions always win over a skill.

| Command | Skill | Role |
|---|---|---|
| `/prd` | `brainstorming` | Explore ambiguous intent. Skipped inside `/flow`. |
| `/plan` | `writing-plans` | Decompose into ordered independent steps. |
| `/tdd` | `test-driven-development` | Test-first discipline. |
| `/diagnose` | `systematic-debugging` | Hypothesis-driven root cause. |
| `/review` | `requesting-code-review` + `verification-before-completion` | No "approved" without evidence. |
| `/gate` | `verification-before-completion` | Pass/fail only from real output. |
| `/flow` (Stage 3) | `subagent-driven-development` + `using-git-worktrees` | Per-task cycle via subagents. |

## Lazy-load (token discipline)

External skills/subagents dominate token cost — load **conditionally, at point of use**, never always-on.

| Capability | Load only when |
|---|---|
| `ui-ux-pro-max` (`/ui-spec`) | once, in `/ui-spec`. Query narrowly. Bake decisions into artifact. |
| `ui-ux-pro-max` (`/ui-review`) | do NOT re-invoke — review against ui-spec artifact. |
| context7 MCP docs | task names a specific external library. Skip for pure domain/logic. |
| `patterns/<stack>` | load only the detected stack's pattern file. |

## UI design track (frontend only)

For `is_frontend: true`, UI commands compose under strict precedence:

1. **ui-ux-pro-max** — primary design intelligence (style, palette, spacing, states, a11y). Web stacks add shadcn MCP. Drives `/ui-spec` + `/ui-review`.
2. **Project patterns** (`patterns/<stack>`) — house rules. **Override ui-ux-pro-max on conflict.**
3. **context7** — confirms real component/library API.

**Codegen:** `frontend-design` skill generates web components (React/Next/Vue/HTML) during `/implement`. Non-frontend tasks skip the whole track.

## Library docs (context7)

`spec`, `implement`, `fix`, `assess`, `migrate`, `ui-spec` fetch current docs via context7 MCP (`resolve-library-id` → `query-docs`) before writing — only when a task touches a named external library. Skip for pure domain/logic.

## Workflows

**Feature (`/flow`):** `context → prd → plan → per task: spec → ui-spec (if frontend) → patterns:<stack> (if frontend) → tdd (if needed) → implement → test → review → ui-review (if frontend) → local-env → release`

**Bugfix (`/flow-bugfix`):** `diagnose → fix → test → review → (ui-review if frontend) → validate`

**Hotfix (`/flow-hotfix`):** `diagnose → fix → gate → release`

**Migration (`/flow-migration`):** `assess → per step: migrate → validate → review`

**Refactor (`/flow-refactor`):** `analyze → per unit: refactor → test → review`

**Checkpoints (require approval):** after `/prd`; after `/plan` (and `/assess`, `/analyze`); after each `/review`; before finishing `/release`.

## Commands

**Orchestrators:** `/flow` `/flow-bugfix` `/flow-hotfix` `/flow-migration` `/flow-refactor`

**Feature lifecycle:**
| Command | Input → Output |
|---|---|
| `/prd` | requirements → `ai/prd/feature.md` |
| `/plan` | prd → `ai/plan/feature.md` |
| `/spec` | plan + task ID → `ai/spec/task-{prd}-{NN}.md` |
| `/ui-spec` | spec (frontend) → `ai/ui-spec/task-{prd}-{NN}.md` |
| `/tdd` | spec → test files |
| `/implement` | spec → production code |
| `/test` | spec + impl → test files |
| `/review` | spec + changes → Review Report |
| `/ui-review` | ui-spec + changes → UI Review Report |
| `/commit` `/pr` `/release` | staged/branch/work → commit / PR / `ai/release/feature.md` |

**Bugfix:** `/diagnose` (root cause) · `/fix` (minimal fix) · `/validate` (compatibility)
**Migration/Refactor:** `/assess` `/migrate` · `/analyze` `/refactor`
**Ops:** `/setup` `/context` `/docs` `/local-env` `/gate` `/progress`
**UI:** `/ui-spec` `/ui-review` `/patterns:<stack>` (`flutter` `react` `react-native` `nextjs`)

## File Conventions

```
ai/
  prd/feature.md
  plan/feature.md
  spec/task-<slug>-NN.md
  ui-spec/task-<slug>-NN.md
  migration/  refactor/  release/feature.md
.claude/
  context/{architecture,modules,infra}.md   # generated by /context
  commands/<name>.md  +  patterns/{flutter,react,react-native,nextjs}.md
```

**Task IDs:** logical `TASK-{NN}` (validated `TASK-\d{2}`). Artifacts `task-{prd}-{NN}.md` where `{prd}` = slug of `ai/prd/<slug>.md`.

## Task Classification (`/plan`)

- **Type:** domain · application · persistence · api · integration · test · infra · migration · refactor-support
- **Story points:** 1 · 2 · 3 · 5 · 8
- **Criticality:** low · medium · high · critical
- **Technical risk:** low · medium · high

## TDD Decision Rule

Use `/tdd` for: business rules, validation, conditional behavior, calculations, authz/eligibility, regression-sensitive logic. Skip for: DTOs, config, wiring, trivial mappings, boilerplate — always state when skipping and why.

## Security

Validate file paths (no `..`); validate task IDs `TASK-\d{2}`; never execute untrusted code; never log env vars; minimize sensitive data in errors.

## Constraints

Never implement full feature at once — task by task. Never skip planning/review. Never pass a checkpoint without explicit approval. Never hide ambiguity/risk. One spec per task, no code in specs. No production code during TDD. New command → add `.claude/commands/<name>.md` + list it above.
