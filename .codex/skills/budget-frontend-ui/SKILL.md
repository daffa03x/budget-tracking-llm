---
name: budget-frontend-ui
description: "Build or review Budget Tracking frontend workflows with Next.js App Router, shadcn/ui, Tailwind, React Hook Form, Zod, TanStack Query, Recharts, Sonner, loading/error/empty states, responsive tables, dialogs, sheets, forms, hooks, and operational dashboard UX."
---

# Budget Frontend UI

## Workflow

1. Read the relevant UI route and module requirements in `docs/budget-tracker-modules.md`.
2. Read the relevant phase checklist in `docs/budget-tracker-phases.md`.
3. Before editing App Router files, read the matching Next.js 16 guide under `node_modules/next/dist/docs/`.
4. Reuse existing shadcn/ui primitives, layout patterns, hooks, utilities, and component style.
5. Build complete states for user-facing workflows: loading, error, empty, success, and destructive confirmation where needed.

## UI Rules

- Keep app screens compact, scannable, and workflow-focused.
- Use React Hook Form plus Zod for create/edit forms.
- Use TanStack Query for interactive client fetches and mutations.
- Use Recharts for charts and wrap chart components for responsive sizing.
- Use Sonner for action feedback when mutations succeed or fail.
- Keep responsive behavior explicit for tables, filter bars, forms, and sidebars.
- Do not create marketing-style landing pages for app workflows.

## Common Paths

- Pages: `app/(dashboard)/...`
- Shared UI: `components/common`
- shadcn primitives: `components/ui`
- Hooks: `hooks`
- Utilities: `lib/utils.ts` and focused files under `lib/utils`
