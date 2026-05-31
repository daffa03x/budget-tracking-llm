---
name: budget-transactions-module
description: "Implement or review the Budget Tracking transactions module: income and expense CRUD, filters for date/category/type/search, pagination, transaction service, transaction validation, API routes, transaction table, create/edit sheet, CurrencyInput, useTransactions, mutation invalidation, and transaction summaries."
---

# Budget Transactions Module

## Workflow

1. Read Phase 4 in `docs/budget-tracker-phases.md` and transaction requirements in `docs/budget-tracker-modules.md`.
2. Read relevant Next.js 16 docs under `node_modules/next/dist/docs/` before editing App Router routes or pages.
3. Build the slice in order: Prisma indexes if needed, Zod schema, service, API route handlers, hooks, UI, verification.
4. Treat transactions as the product core; keep filters, pagination, and CRUD paths reliable.

## Backend Rules

- Validate `amount`, `type`, `description`, `date`, and optional `categoryId` with Zod.
- Filter by authenticated `userId` on every query.
- Support date range, category, type, search, and pagination in the service layer.
- Use Decimal-compatible handling for transaction amounts.
- Validate that referenced categories are usable by the current user.
- When budget features exist, update or recalculate affected budget spending after expense create/update/delete.

## Frontend Rules

- Build `/transactions` around a table with a compact filter bar.
- Include create/edit in a dialog or sheet and delete confirmation.
- Use `CurrencyInput` for amount entry and project currency utilities for display.
- Add loading, error, empty, and optimistic or success feedback states.
- Invalidate transaction, dashboard, report, and budget queries when mutations affect them.
