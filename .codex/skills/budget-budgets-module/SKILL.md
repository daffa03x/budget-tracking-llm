---
name: budget-budgets-module
description: "Implement or review the Budget Tracking budgets module: budget CRUD by category and period, limit and spent calculations, progress percentages, threshold alerts at 80 and 100 percent, budget service, budget validation, API routes, BudgetCard, useBudgets, and synchronization with expense transactions."
---

# Budget Budgets Module

## Workflow

1. Read Phase 5 in `docs/budget-tracker-phases.md` and budget requirements in `docs/budget-tracker-modules.md`.
2. Read relevant Next.js 16 docs before editing route handlers or pages.
3. Implement the vertical slice: validation, service calculations, API routes, hook, cards/dialogs, and verification.
4. Coordinate with transaction logic because expense changes affect budget progress.

## Backend Rules

- Validate `limit`, `period`, `startDate`, `endDate`, and `categoryId` with Zod.
- Ensure the budget category belongs to the user or is an allowed default category.
- Calculate spending from transactions when correctness matters more than cached `spent`.
- Keep cached `spent` synchronized if the schema uses it.
- Detect warning and overspend thresholds at 80 percent and 100 percent.
- Prevent cross-user reads, updates, and deletes.

## Frontend Rules

- Build `/budgets` as a grid or compact list of `BudgetCard` items.
- Show category, limit, spent, remaining amount, percentage, and status color.
- Provide create/edit dialogs and delete confirmation.
- Use toast feedback for successful changes and threshold alerts.
- Add loading, error, and empty states.
