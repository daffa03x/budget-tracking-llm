---
name: budget-phase-planner
description: "Plan Budget Tracking project work against docs, MVP priority, and phase checklists. Use when Codex needs to choose the next slice, scope a feature, break down work, review phase alignment, or map user requests to setup, auth, transactions, dashboard, categories, budgets, reports, settings, quality, or deployment."
---

# Budget Phase Planner

## Workflow

1. Read `docs/budget-tracker-phases.md` and the relevant parts of `docs/budget-tracker-modules.md`.
2. Identify the closest phase and say whether the request follows or intentionally skips MVP order.
3. Prefer MVP order unless the user asks for another slice: setup, auth, transactions, dashboard, categories, then budgets/reports/settings/polish/testing.
4. Convert broad requests into a vertical slice: data model, validation, service, API route, hook, UI, and verification.
5. Keep the plan practical for a single developer and call out dependencies that block implementation.

## Planning Rules

- Treat `docs/budget-tracker-phases.md` as the phase source of truth.
- Treat `docs/budget-tracker-modules.md` as the architecture source of truth.
- Before editing Next.js files, read the relevant guide under `node_modules/next/dist/docs/`.
- Prefer project conventions already in the repo over new architecture.
- Do not expand scope into polish, reports, or deployment unless the current phase needs it.

## Output Shape

Use a short phase note, then a focused checklist. Include validation commands only for the touched surface, normally `npm run lint`, `npm run build`, and Prisma commands when `prisma/schema.prisma` changes.
