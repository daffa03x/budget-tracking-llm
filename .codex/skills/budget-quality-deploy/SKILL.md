---
name: budget-quality-deploy
description: "Improve, test, review, or prepare the Budget Tracking app for release: lint/build checks, focused unit tests, service tests, E2E flows, loading/error/empty states, accessibility, responsive validation, performance, Prisma indexes, rate limiting, environment audit, migration deploy, and Vercel deployment readiness."
---

# Budget Quality Deploy

## Workflow

1. Read Phase 9 and Phase 10 in `docs/budget-tracker-phases.md`.
2. Inspect the touched feature surface before proposing checks.
3. Prioritize correctness, data isolation, and deployability over broad refactors.
4. Run the narrowest meaningful commands and report skipped checks clearly.

## Quality Rules

- Add or verify loading, error, empty, and success states for user workflows.
- Check responsive behavior around 375px, 768px, and 1280px when UI changes are substantial.
- Prefer accessible shadcn/ui patterns and maintain labels, focus states, and keyboard paths.
- Add Prisma indexes for proven frequent filters.
- Use `select` in Prisma queries when full records are unnecessary.
- Add rate limiting to sensitive auth or destructive endpoints when the project has a rate-limit utility.

## Testing Rules

- Unit test utilities and Zod schemas when tests exist or when logic is easy to isolate.
- Service tests should cover ownership, validation boundaries, and edge cases.
- E2E priority: register, login, create transaction, verify dashboard.
- Do not add a large test framework casually; align with the repo setup.

## Deployment Rules

- Ensure `npm run build` passes before claiming deploy readiness.
- Confirm required environment variables are documented.
- Run Prisma generate/migrate/deploy commands when schema or deployment flow requires them.
- Keep production-only secrets out of client code and logs.
