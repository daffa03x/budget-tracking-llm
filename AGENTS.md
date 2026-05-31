<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Budget Tracking Project Agents

This repository is a Next.js 16 fullstack budget tracker. The product requirements live in:

- `docs/budget-tracker-modules.md`
- `docs/budget-tracker-phases.md`

Before planning or coding a feature, read the relevant section of those docs and map the work to the closest phase. Prefer the documented MVP order unless the user asks for a different slice: setup, auth, transactions, dashboard, categories, then budgets/reports/settings/polish/testing.

## Agent Roles

Use these roles as working lenses when splitting or reviewing work:

- Product/Phase Agent: keep implementation aligned with the phase checklist, MVP priority, and expected output for each phase.
- Data/API Agent: own Prisma schema, migrations, validation schemas, service layer, API route handlers, auth checks, and data ownership rules.
- Frontend Agent: own App Router pages, dashboard layout, shadcn/ui components, hooks, forms, charts, and responsive UX.
- Quality Agent: own lint/build checks, test coverage, accessibility, loading/error/empty states, and deployment readiness.

## Project Conventions

- Use Next.js App Router under `app/`; route handlers live in `app/api`.
- Keep business logic in `lib/services`; keep API handlers thin.
- Validate input with Zod in `lib/validations` before calling services.
- Use Prisma as the data access layer and enforce `userId` ownership for all user-owned records.
- Use TypeScript types intentionally; avoid `any` unless it is isolated and justified.
- Use shadcn/ui and Tailwind for UI, React Hook Form for forms, TanStack Query for client fetching/mutations, Recharts for charts, and Sonner for action feedback when those dependencies are present.
- Build vertical slices: schema/validation, service, API route, hook, UI, then verification.
- Keep the UI practical and workflow-focused: compact dashboard, clear tables, efficient forms, responsive layouts, and visible loading/error/empty states.

## Security And Data Rules

- Protect dashboard and user data routes with NextAuth session checks and `middleware.ts`.
- Hash passwords with `bcryptjs`.
- Never trust client-supplied `userId`; derive it from the authenticated session.
- Validate record ownership before read/update/delete.
- Do not expose server-only environment variables to client components.

## Local Skill

Use the local skill at `.codex/skills/budget-tracker-builder` when implementing or planning this project. It summarizes the docs into a repeatable workflow and points to the source requirement files when exact detail is needed.

## Validation

Run the narrowest useful checks after changes:

- `npm run lint`
- `npm run build`
- Prisma generate/migrate commands when `prisma/schema.prisma` changes

If a command cannot run because dependencies or environment variables are missing, report that clearly with the remaining risk.
