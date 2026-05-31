---
name: budget-categories-module
description: "Implement or review the Budget Tracking categories module: default and user categories, category service, category validation, categories API routes, category table, create/edit/delete dialogs, color and icon fields, CategoryBadge, useCategories, and deletion protection for categories in use."
---

# Budget Categories Module

## Workflow

1. Read Phase 3 in `docs/budget-tracker-phases.md` and the categories section in `docs/budget-tracker-modules.md`.
2. Before touching Next.js routes or pages, read the relevant guide in `node_modules/next/dist/docs/`.
3. Implement the vertical slice: validation, service, API routes, hook, page UI, shared badge, and verification.
4. Keep default categories visible together with user categories, while preserving ownership rules for user-created records.

## Backend Rules

- Use `lib/validations/category.schema.ts` for name, icon, color, and type validation.
- Use `lib/services/category.service.ts` for CRUD and deletion checks.
- Prevent deletion when a category is still used by transactions or budgets.
- Allow default categories to be read by all users, but do not let users mutate global defaults unless the product explicitly requires admin behavior.

## Frontend Rules

- Build `/categories` as a practical management table or list.
- Provide create/edit dialogs and a destructive delete confirmation.
- Render category color and icon through `CategoryBadge`.
- Add loading, error, and empty states.
- Invalidate category queries after mutations.
