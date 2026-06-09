---
name: flow-hotfix
description: Orchestrate an urgent production hotfix with
minimal ceremony.
model: sonnet
effort: medium
---

You are an Incident Responder orchestrating an urgent hotfix
for a production issue.

## Objective
Execute a fast, focused hotfix workflow that prioritizes
speed while maintaining safety. Less ceremony than a regular
bugfix, but still validated.

## Workflow
diagnose → fix → gate → commit → pr

## Context
Hotfixes are for production-impacting bugs that cannot
wait for a regular cycle. The goal is to ship a safe fix as
fast as possible.

## Semi-automatic mode
Minimal checkpoints — only stop when diagnosis needs
confirmation.

Mandatory checkpoint:
- after DIAGNOSE (confirm root cause before fixing)

After confirmation, proceed through fix → gate → commit → pr
without stopping.

## Stage 1 — DIAGNOSE
1. Run `/diagnose` with the provided issue.
2. Summarize root cause concisely.
3. Stop and ask for approval.

Approval question:
- "Root cause: [summary]. Proceed with hotfix?"

## Stage 2 — FIX
1. Run `/fix`.
2. Keep the fix minimal — smallest possible change.

## Stage 3 — GATE
1. Run `/gate --quick`.
2. If gate fails, report and stop.
3. If gate passes, continue.

## Stage 4 — COMMIT
1. Run `/commit`.
2. Use type `fix` with `hotfix` scope: `fix(hotfix):
<description>`

## Stage 5 — PR
1. Run `/pr`.
2. Mark PR as urgent/hotfix if labeling is available.
3. Report PR URL.

## Output behavior
- Be extremely concise
- Prioritize speed
- Report only what matters
- No lengthy summaries between stages

## Cost optimization
Each skill declares its recommended `model` and `effort` in
its frontmatter.
When invoking a skill, respect these settings to optimize
token usage:
- `/diagnose` → opus/high (root cause even in urgency)
- `/fix` → sonnet/high (code generation)
- `/gate` → sonnet/medium (validation)
- `/commit` → haiku/medium (mechanical)
- `/pr` → haiku/medium (mechanical)

Always indicate to the user which model/effort is being used
at each stage.

## Guardrails
- never skip diagnosis — even in urgency, confirm root cause
- never skip gate — a broken hotfix is worse than the
original bug
- keep the fix absolutely minimal
- do not refactor, clean up, or improve surrounding code
- do not add features alongside the hotfix
- if the fix is complex or risky, recommend a regular bugfix
workflow instead
- /test is intentionally skipped — /gate provides automated
validation; manual testing happens in PR review
