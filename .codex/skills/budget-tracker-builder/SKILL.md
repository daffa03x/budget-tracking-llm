---
name: budget-tracker-builder
description: Build, plan, review, or modify the Budget Tracking Next.js 16 fullstack app in this repository. Use when working on the documented budget tracker modules, development phases, Prisma schema, NextAuth auth flow, transactions, categories, budgets, dashboard, reports, settings, shadcn/Tailwind UI, API route handlers, services, hooks, validation, testing, or deployment readiness.
---

# Budget Tracker Builder

## Core Workflow

1. Read the relevant source requirement docs first:
   - `docs/budget-tracker-modules.md`
   - `docs/budget-tracker-phases.md`
2. Identify the phase and vertical slice being changed.
3. Before editing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`; this project uses Next.js 16 and may differ from older App Router assumptions.
4. Implement vertical slices in this order when applicable: Prisma model/indexes, Zod validation, service logic, API route handler, hooks, UI, then tests or verification.
5. Keep API route handlers thin. Put filtering, aggregation, ownership checks, and calculations in `lib/services`.
6. Preserve user data boundaries. Derive `userId` from the authenticated session and validate ownership on every user-owned record.
7. Finish with the narrowest meaningful verification, normally `npm run lint` and `npm run build`.

## Phase Selection

Use `references/implementation-roadmap.md` for the phase summary and MVP order. If the user asks for "fitur berikutnya" or gives a broad request, prefer this MVP sequence:

1. Project setup and foundation
2. Auth and user management
3. Transactions
4. Dashboard and visualization
5. Categories
6. Budgets, reports, settings, polish, tests, deployment

## Module Pattern

For a feature module, keep names and paths consistent with the docs:

- Pages: `app/(dashboard)/<module>/page.tsx`
- API list/create routes: `app/api/<module>/route.ts`
- API detail routes: `app/api/<module>/[id]/route.ts`
- Services: `lib/services/<module>.service.ts`
- Validations: `lib/validations/<module>.schema.ts`
- Hooks: `hooks/use<Module>.ts`
- Shared UI: `components/common`

Use `references/product-scope.md` for routes, service responsibilities, Prisma models, shared components, hooks, utilities, and library choices.

## Backend Rules

- Prisma is the source of persistence truth.
- Use Decimal-compatible handling for money values.
- Add useful Prisma indexes for frequent queries, especially `userId`, `date`, and `categoryId` on transactions.
- Return consistent JSON errors from route handlers.
- Validate all request bodies and query parameters with Zod.
- Do not duplicate complex query or aggregation logic between route handlers.

## Frontend Rules

- Use shadcn/ui primitives when available.
- Use React Hook Form plus Zod for create/edit forms.
- Use TanStack Query for client-side fetches and mutations when the feature is interactive.
- Use Recharts for dashboard and report visualizations.
- Add loading, error, empty, and success states for user-facing workflows.
- Keep operational screens dense, clear, and responsive; avoid landing-page composition for app screens.

## Verification

Run the checks that match the touched surface:

- `npm run lint` for TypeScript and lint issues.
- `npm run build` for Next.js integration issues.
- Prisma generate/migrate commands after schema changes.
- Unit tests for utilities and validation schemas when tests exist or are added.
- E2E coverage for critical auth-to-transaction flows when Playwright is introduced.

Report skipped checks and why.

## References

- `references/product-scope.md`: distilled module architecture, routes, data models, shared UI, hooks, utilities, and stack.
- `references/implementation-roadmap.md`: distilled phase plan, outputs, and MVP priority.
