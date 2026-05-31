---
name: budget-data-api
description: "Implement or review the Budget Tracking backend slice: Prisma schema, migrations, Zod validations, service layer, API route handlers, session checks, ownership rules, Decimal money handling, and JSON error responses. Use for data models, lib/services, lib/validations, app/api routes, and user-owned record security."
---

# Budget Data API

## Workflow

1. Read the matching module and phase in `docs/budget-tracker-modules.md` and `docs/budget-tracker-phases.md`.
2. Before editing route handlers or server code, read the relevant Next.js 16 docs under `node_modules/next/dist/docs/`.
3. Implement backend vertical slices in this order: Prisma model/indexes, Zod schema, service functions, API route handler, focused tests or verification.
4. Keep API route handlers thin; put filtering, aggregation, ownership checks, and calculations in `lib/services`.
5. Derive `userId` from the authenticated session. Never accept `userId` from client input.

## Service Rules

- Validate every body and query with Zod before service calls.
- Enforce ownership before read, update, delete, and aggregate operations.
- Use Prisma as the persistence source of truth.
- Handle money with Decimal-compatible values and avoid floating-point calculations for stored amounts.
- Add indexes that match frequent filters, especially transaction `userId`, `[userId, date]`, and `[userId, categoryId]`.
- Return consistent JSON errors from route handlers without leaking server-only details.

## Verification

Run the narrowest useful checks:

- `npm run lint` for TypeScript and lint errors.
- `npm run build` for route-handler and Next.js integration issues.
- Prisma generate/migrate commands after schema edits.
