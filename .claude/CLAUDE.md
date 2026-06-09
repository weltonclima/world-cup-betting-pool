# CLAUDE.md – Engineering Workflow Commands

## Overview

This project provides a set of Claude Code **slash commands** that orchestrate complete, semi-automatic software engineering workflows — feature delivery, bugfix, hotfix, migration, and refactoring — from requirement consolidation to production release.

Commands live in `.claude/commands/` (one `<name>.md` per command, with front-matter). They are invoked as `/<name>`. The `flow*` commands run full pipelines with approval checkpoints.

---

## Model & Effort

Every command declares `model:` and `effort:` in its front-matter. These guide which model and reasoning depth a stage should use:

- **opus / high** — deep reasoning: `prd`, `plan`, `review`, `diagnose`, `analyze`, `assess`
- **sonnet / high** — code generation: `spec`, `implement`, `tdd`, `fix`, `migrate`, `refactor`, `ui-spec`, `ui-review`
- **sonnet / medium** — structured execution: `test`, `validate`, `local-env`, `gate`, `release`, `context`, `setup`, `flow*`
- **haiku / medium** — mechanical: `commit`, `pr`, `progress`, `docs`

The `flow*` orchestrators read each stage's declared `model`/`effort` (and a task's `Execution cost` profile in `ai/plan/feature.md`) and announce which is in use at each stage. There is no model-switch hook — commands run in the active session model; the declared values are guidance for calibration and cost optimization.

---

## Process skills (superpowers)

Process commands invoke battle-tested **superpowers** skills for *how* to work (they are referenced, not copied). User instructions and project conventions always take precedence over a superpowers skill.

| Command | superpowers skill | Role |
|---|---|---|
| `/prd` | `brainstorming` | Explore intent when requirements are ambiguous. **Skipped inside `/flow`** (the PRD checkpoint already covers it). |
| `/plan` | `writing-plans` | Decompose into ordered, independent steps. |
| `/tdd` | `test-driven-development` | Rigid test-first discipline. |
| `/diagnose` | `systematic-debugging` | Hypothesis-driven root-cause method. |
| `/review` | `requesting-code-review` + `verification-before-completion` | Structured review; no "approved" without evidence. |
| `/gate` | `verification-before-completion` | Pass/fail only from real command output. |
| `/flow` (Stage 3) | `subagent-driven-development` + `using-git-worktrees` | Drive per-task cycle via subagents; optional worktree isolation. |

---

## GSD agents (wrap — pilot)

Selected commands tap battle-tested **GSD** subagents via the Agent tool (`subagent_type`), without adopting GSD's `.planning/` structure. They run as standalone verification passes inside the existing `ai/`-based flow; the command's own spec/goal judgment stays authoritative.

| Command | GSD agent | Role |
|---|---|---|
| `/review` | `gsd-code-reviewer` | Independent bug/security/quality pass on the diff, folded into the verdict. |
| `/plan` | `gsd-plan-checker` | Goal-backward check that the task breakdown achieves the feature goal. |

If a GSD agent is unavailable in the current environment, skip the pass and note it — do not fail the command. (`/diagnose` deliberately does **not** wrap `gsd-debugger` — it already uses `superpowers:systematic-debugging`.)

---

## Lazy-load policy (token discipline)

External skills and subagents are the dominant token cost — far more than the command bodies. Measured per single task: ui-ux-pro-max ~11.4k, gsd-plan-checker ~9k, gsd-code-reviewer ~3.8k, superpowers subagent-driven ~3.1k. They are loaded **conditionally, at the point of use** — never a standalone always-on doc. The gates below are authoritative; each command restates only its own trigger.

| Capability | Cost | Load only when |
|---|---|---|
| `gsd-code-reviewer` (`/review`) | ~3.8k | diff ≥ 5 files **OR** criticality high/critical **OR** type api/integration/persistence/migration **OR** a critical/high finding already surfaced. Else skip + note. |
| `gsd-plan-checker` (`/plan`) | ~9k | plan ≥ 4 tasks **OR** any task critical / risk high **OR** PRD flagged ambiguity. Else skip + note. |
| `ui-ux-pro-max` (`/ui-spec`) | ~11.4k | once, in `/ui-spec` only. Query narrowly (this component's style/palette/states). Bake all decisions into the ui-spec artifact. |
| `ui-ux-pro-max` (`/ui-review`) | ~11.4k | **do not re-invoke** — review against the ui-spec artifact. Re-load only if artifact missing or implementation diverges and needs a fresh ruling. |
| context7 / expo MCP docs | varies | task names a specific external library/component. Skip for pure domain/logic. |
| `patterns/<stack>` + `expo:*` skills | ~3k each | load only the detected stack's pattern file and only the specific `expo:*` skill the task touches — not the full set. |

Principle: a gated pass is **quality-neutral** — it only skips when the marginal value is ~zero (trivial diff, artifact already self-contained, no named library). When the work genuinely needs the pass, it fires unchanged.

---

## Library docs (context7)

Commands that produce code against third-party libraries — `spec`, `implement`, `fix`, `assess`, `migrate`, `ui-spec` — fetch current docs via the **context7** MCP (`resolve-library-id` → `query-docs`) before writing, instead of relying on training memory. This kills hallucinated/outdated APIs. The step is conditional: it fires only when a task touches a named external library, and is skipped for pure domain/logic work. Allow the `mcp__plugin_context7_context7__*` tools in local settings to enable it.

---

## UI design track (frontend only)

For `is_frontend: true` tasks, the UI commands compose three external capabilities under a strict precedence so the sources never compete:

1. **ui-ux-pro-max** (skill) — primary design intelligence: style, palette, font pairing, spacing, interaction states, UX guidelines, accessibility. Web stacks also use its shadcn/ui MCP. Covers Flutter / React Native too (design only, no shadcn). Drives `/ui-spec` and `/ui-review`.
2. **Project patterns** (`patterns/<stack>`) — house rules (architecture, naming, allowed libs, theming). **Override ui-ux-pro-max on any conflict.** Kept as the project authority and as offline fallback.
3. **context7** — confirms the real component/library API for the installed version.

**Code generation:** `frontend-design` (skill) generates components for **web** stacks (React/Next/Vue/HTML) during `/implement`. It is web-only — **Flutter / React Native** build widgets from `patterns/<stack>` + context7 instead. Non-frontend tasks skip the whole track.

| Stack | Design (`/ui-spec`) | Codegen (`/implement`) |
|---|---|---|
| React / Next / web | ui-ux-pro-max + shadcn MCP | **frontend-design** + patterns |
| Flutter / React Native | ui-ux-pro-max (no shadcn) | **patterns/<stack>** + context7 |
| Expo | ui-ux-pro-max (no shadcn) | **patterns/expo** (+ react-native) + context7 |

Stack detection checks **Expo before React Native** (`app.json`/`app.config.*` or an `expo` dependency), since Expo projects also carry a `react-native` dep.

---

## Expo (EAS build & release)

For Expo projects, build/release/observability run through the **Expo MCP** and Expo skills (`expo:*`), wired into:

| Command | Expo capability |
|---|---|
| `/ui-spec`, `/implement`, `/ui-review` | `patterns/expo` (Expo Router, EAS, NativeWind) + the `expo:*` skills it references |
| `/local-env` | dev client / dev server; EAS builds via MCP `build_run`/`build_logs` |
| `/gate` | EAS workflow `workflow_validate` when `.eas/workflows/` exists |
| `/release` | EAS Update (OTA) vs new native build; gate on `expo:eas-update-insights`; submit via `build_submit` |
| `/diagnose` | field crashes/feedback via MCP `testflight_crashes` / `testflight_feedback` |

Skip all of this for non-Expo projects. Allow the relevant `mcp__plugin_expo_expo__*` tools in local settings to enable the MCP paths.

---

## Workflows

### Feature (`/flow`)
```
context (mandatory) → prd → plan → per task: spec → ui-spec (if frontend) → patterns:<stack> (if frontend) → tdd (if needed) → implement → test → review → ui-review (if frontend) → local-env → release
```

### Bugfix (`/flow-bugfix`)
```
diagnose → fix → test → review → (ui-review if frontend) → validate
```

### Hotfix (`/flow-hotfix`)
Urgent production fix, minimal ceremony: diagnose → fix → gate → release.

### Migration (`/flow-migration`)
```
assess → per step: migrate → validate → review
```

### Refactor (`/flow-refactor`)
```
analyze → per unit: refactor → test → review
```

### Checkpoints (require approval before continuing)
- After `/prd`
- After `/plan` (and after `/assess`, `/analyze`)
- After each `/review`
- Before finishing `/release`

---

## Available Commands

### Workflow orchestrators
| Command | Role |
|---|---|
| `/flow` | Full feature workflow, task by task |
| `/flow-bugfix` | Bugfix workflow |
| `/flow-hotfix` | Urgent production hotfix |
| `/flow-migration` | Project migration workflow |
| `/flow-refactor` | Controlled refactoring workflow |

### Feature lifecycle
| Command | Input | Output |
|---|---|---|
| `/prd` | requirements / Cards | `ai/prd/feature.md` |
| `/plan` | `ai/prd/feature.md` | `ai/plan/feature.md` |
| `/spec` | plan + task ID | `ai/spec/task-{prd}-{NN}.md` |
| `/ui-spec` | spec (frontend) | `ai/ui-spec/task-{prd}-{NN}.md` |
| `/tdd` | spec | test files |
| `/implement` | spec | production code |
| `/test` | spec + impl | test files |
| `/review` | spec + changes | Review Report |
| `/ui-review` | ui-spec + changes | UI Review Report |
| `/commit` | staged changes | conventional commit |
| `/pr` | branch + artifacts | pull request |
| `/release` | prd + plan + work | `ai/release/feature.md` |

### Bugfix lifecycle
| Command | Input | Output |
|---|---|---|
| `/diagnose` | bug report / description | root cause (inline) |
| `/fix` | diagnosis | minimal scoped fix |
| `/validate` | migration/fix step | compatibility check |

### Migration / Refactor
| Command | Input | Output |
|---|---|---|
| `/assess` | codebase | `ai/migration/` plan |
| `/migrate` | assessment plan | one migration step |
| `/analyze` | codebase | `ai/refactor/` plan |
| `/refactor` | refactor plan | one refactor unit |

### Project context & ops
| Command | Role |
|---|---|
| `/setup` | Configure workflow (permissions, `ai/` dirs, git tracking) |
| `/context` | Update persistent engineering context → `.claude/context/` |
| `/docs` | Generate/update technical docs from code |
| `/local-env` | Validate full local environment |
| `/gate` | Run lint + test + build as a validation gate |
| `/progress` | Show workflow progress |

### UI / design
| Command | Role |
|---|---|
| `/ui-spec` | Implementation-ready UI spec, auto-detects stack |
| `/ui-review` | UX/UI-focused review (interaction, accessibility) |
| `/patterns:<stack>` | Load stack UI patterns: `flutter`, `react`, `react-native`, `nextjs` |

---

## File Conventions

### AI Artifacts
```
ai/
  prd/feature.md
  plan/feature.md
  spec/task-benefit-eligibility-01.md
  ui-spec/task-benefit-eligibility-01.md
  migration/...
  refactor/...
  release/feature.md
```

### Engineering Context (generated by `/context`)
```
.claude/
  CLAUDE.md
  context/
    architecture.md
    modules.md
    infra.md
```

### Commands
```
.claude/commands/
  <name>.md            # one slash command each, with name/description/model/effort front-matter
  patterns/
    flutter.md
    react.md
    react-native.md
    nextjs.md
```

### Cards
```
/docs/cards/
  AUDIT-001-*.docx
  ...
```

### Task IDs
Logical ID: `TASK-{NN}` (e.g., `TASK-01`), validated against `TASK-\d{2}`.
Artifact filenames: `task-{prd}-{NN}.md`, where `{prd}` is the PRD/feature slug (`ai/prd/<slug>.md` without extension) and `{NN}` is the zero-padded task number. Example: `task-benefit-eligibility-01.md`.

---

## Task Classification (used by `/plan`)

**Type:** domain · application · persistence · api · integration · test · infra · migration · refactor-support

**Story points:** 1 (very small) · 2 (small) · 3 (medium) · 5 (complex) · 8 (very complex)

**Criticality:** low · medium · high · critical

**Technical risk:** low · medium · high

---

## TDD Decision Rule

Use `/tdd` when task has: business rules, validation logic, conditional behavior, calculations, authorization/eligibility, regression-sensitive behavior.

Skip when mostly: DTOs, config, wiring, trivial mappings, low-value boilerplate. Always state explicitly when skipping and why.

---

## Security

- Validate all file paths (no `..` traversal)
- Validate task IDs match `TASK-\d{2}` format
- Never execute untrusted code
- Never log environment variables
- Minimize exposure of sensitive data in errors

---

## Constraints

- Never implement the full feature at once — always task by task
- Never skip planning or review
- Never continue past a checkpoint without explicit approval
- Never hide ambiguity or risk
- One spec per task, no code in specs
- No production code during TDD phase
- When adding a command, add a `<name>.md` to `.claude/commands/` and list it in the tables above
