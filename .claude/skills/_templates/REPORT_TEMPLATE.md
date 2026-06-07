# STANDARD REPORT TEMPLATES

## PRD Report
```
# PRD REPORT
## 1. File: {path}
## 2. Feature: {summary}
## 3. Impact: {areas}
## 4. Risks: {list}
## 5. Ambiguities: {list}
```

## Plan Report
```
# PLAN REPORT
## 1. File: {path}
## 2. Tasks: {count}
## 3. High-risk: {list}
## 4. Start with: {task} – {reason}
## 5. Blockers: {list}
```

## Spec Report
```
# SPEC REPORT
## 1. File: {path}
## 2. Task: {id} – {title}
## 3. Scope: {summary}
## 4. Risks: {list}
```

## TDD Report
```
# TDD REPORT
## 1. Task: {id} – {title}
## 2. Why TDD: {reason}
## 3. Tests: {summary}
## 4. Remaining: {what}
```

## Implementation Report
```
# IMPLEMENTATION REPORT
## 1. Task: {id} – {title}
## 2. Files: {list}
## 3. Changes: {summary}
## 4. Not changed: {boundaries}
## 5. Deviations: {spec-vs-CLAUDE.md conflicts resolved, or "none"}
## 6. Risks: {notes}
```

## Test Report
```
# TEST REPORT
## 1. Task: {id} – {title}
## 2. Coverage: {summary}
## 3. Scenarios: {list}
## 4. Gaps: {list or "none"}
```

## Review Report
```
# REVIEW
## 1. Task: {id} – {title}
## 2. Summary: {overview}
## 3. Positive: {list}
## 4. Problems: BLOCKER: {list} | WARNING: {list}
## 5. Risks: {list}
## 6. Adjustments: {list}
## 7. Verdict: {approved|approved with adjustments|rejected}
```

### UI/UX Review (append for UI tasks)
```
## UI/UX Review
| Priority | Category | Violations | Severity |
|---|---|---|---|
| 1 | Accessibility | {n} | BLOCKER if >0 |
| 2 | Touch & Interaction | {n} | BLOCKER if >0 |
| 3 | Performance | {n} | BLOCKER/WARNING |
| 4 | Style Consistency | {n} | WARNING |
| 5 | Layout & Responsive | {n} | BLOCKER/WARNING |
| 6 | Typography & Color | {n} | WARNING |
| 7 | Animation | {n} | WARNING |
| 8 | Forms & Feedback | {n} | WARNING |
| 9 | Navigation | {n} | BLOCKER/WARNING |
| 10 | Charts & Data | {n} | WARNING |
## BLOCKER count: {n}
## WARNING count: {n}
## Critical Violations (Priority 1-2): {list or "none"}
## Top-3 Priority Fixes: {list}
```

## Verify Report
```
# VERIFY REPORT
## 1. Task: {id} – {title}
## 2. Truths: VERIFIED {n} | FAILED {n} | UNCERTAIN {n}
## 3. Blockers: {list of FAILED truths with location}
## 4. Warnings: {list of UNCERTAIN truths}
## 5. Out-of-scope drift: {list or "none"}
## 6. Verdict: {goal-achieved | escalate | goal-missed}
```

## Debug Report
```
# DEBUG REPORT
## 1. Bug: {one-line summary}
## 2. Root cause: {one-line mechanism}
## 3. Hypotheses: tested {n} | refuted {n}
## 4. Fix: {file:line}
## 5. Verification: {original-repro pass | tests pass | new test added}
## 6. Status: {fixed | partial | escalate}
```

## Audit-Fix Report
```
# AUDIT-FIX REPORT
## 1. Scope: {files / range}
## 2. Findings: BLOCKER {n} | WARNING {n}
## 3. Fixed: {n} (commits: {short hashes})
## 4. Escalated: {n}
- {finding} — {reason}
## 5. Skipped: {n}
- {finding} — {reason}
## 6. Test suite: {pass | fail with details}
## 7. Recommendation: {next steps}
```

## Security Report
```
# SECURITY REPORT
## 1. Scope: {feature / task}
## 2. Threats: CLOSED {n} | OPEN {n} | UNCERTAIN {n}
## 3. Unregistered flags: {n}
## 4. Blockers: {list of T-IDs}
## 5. Verdict: {CLEAR | OPEN_THREATS | NEEDS_HUMAN_DECISION}
```

## Local Env Report
```
# LOCAL ENV REPORT
## 1. Setup: {strategy}
## 2. Data: {summary}
## 3. App: {status}
## 4. Validation: {results}
## 5. Problems: {list}
## 6. Actions: {list}
```

## Release Report
```
# RELEASE REPORT
## 1. File: {path}
## 2. Rollout: {strategy}
## 3. Risks: {list}
## 4. Prerequisites: {list}
```

## Screen Report
```
# SCREEN REPORT
## 1. Task: {id} – {title}
## 2. Platform: {web|mobile|both}
## 3. Screen spec: {ai/screen/task-{id}.md}
## 4. User flow: {summary of entry → happy path → exit}
## 5. Components specified: {list}
## 6. States covered: {loading|empty|populated|error|success|disabled}
## 7. Accessibility notes: {key requirements flagged}
## 8. Design gaps and assumptions: {list or "none"}
## 9. Out of scope: {list or "none"}
```

## Context Update Report
```
# CONTEXT UPDATE REPORT
## 1. Why: {reason}
## 2. Analyzed: {areas}
## 3. Changed: {findings}
## 4. Updated: {sections/files}
## 5. Unchanged: {stable parts}
```
