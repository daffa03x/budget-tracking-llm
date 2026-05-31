# Implementation Roadmap

Source of truth:

- `docs/budget-tracker-phases.md`

## Phase 1: Project Setup And Foundation

Goal: project runs locally with connected database and accessible placeholder pages.

Key work:

- Configure TypeScript, Tailwind, ESLint, path alias, `.env.example`
- Install Prisma, shadcn/ui, TanStack Query, Zustand, React Hook Form, Zod, date-fns, bcryptjs, Recharts, Sonner
- Initialize Prisma and create User, Transaction, Budget, Category, Account, Session models
- Add Prisma client singleton in `lib/prisma.ts`
- Create dashboard layout, root providers, main route placeholders, and seed data

## Phase 2: Auth And User Management

Goal: register, login, logout, protected dashboard, and profile API.

Key work:

- Configure NextAuth v5 with credentials provider and Prisma adapter
- Build register and login forms with Zod validation
- Hash passwords with `bcryptjs`
- Add `middleware.ts` route protection
- Add session helpers/provider and logout action
- Implement `GET`/`PATCH /api/user/profile`

## Phase 3: Categories

Goal: user can list, create, edit, and delete categories.

Key work:

- Add category API routes and service
- Validate with `categorySchema`
- Build `/categories` table, create/edit dialogs, delete confirmation, and `CategoryBadge`
- Add `useCategories`
- Prevent deleting categories still used by transactions or budgets

## Phase 4: Transactions

Goal: user can record, view, filter, update, and delete income/expense transactions.

Key work:

- Add transaction API routes and service
- Support filters for date, category, type, search, and pagination
- Validate with `transactionSchema`
- Build `/transactions` table, filter bar, pagination, create/edit sheet, delete confirmation, `CurrencyInput`
- Add `useTransactions` and mutation hooks
- Provide currency formatting and grouping utilities

## Phase 5: Budgets

Goal: user can set category budgets and track usage.

Key work:

- Add budget API routes and service
- Validate with `budgetSchema`
- Update budget spending when expense transactions change
- Alert at 80% and 100% usage
- Build `/budgets` grid, `BudgetCard`, create/edit dialogs, and delete confirmation
- Add `useBudgets`

## Phase 6: Dashboard And Visualization

Goal: dashboard shows a complete financial snapshot.

Key work:

- Add report summary and monthly API routes/services
- Build `StatCard`, `MonthlyBarChart`, `CategoryPieChart`, `RecentTransactions`, `BudgetOverview`, `MonthSelector`
- Use server components for initial data and client components for charts/interactivity when appropriate
- Add Suspense and skeleton states

## Phase 7: Reports And Export

Goal: user can analyze finances and export transaction data.

Key work:

- Add monthly, category, and export report routes
- Build `/reports` filters, tabs, line/bar charts, and monthly summary table
- Add CSV export with papaparse
- Respect report filters during export

## Phase 8: Settings, Profile, And Sharing

Goal: user can manage account, preferences, and shared budget tracking access.

Key work:

- Build settings sections for profile, preferences, security, and danger zone
- Add profile, password, and account delete APIs
- Support currency, date format, and week-start preferences
- Add personal workspaces and shared budget books
- Add member invitations by email with one-time expiring tokens
- Add roles: owner, admin, editor, viewer
- Enforce workspace membership and role checks across dashboard, transactions, budgets, categories, and reports
- Add `/settings/members` UI for inviting, updating roles, and removing members

## Phase 9: Optimization And Polish

Goal: app feels fast, resilient, secure, accessible, and responsive.

Key work:

- Add skeleton, empty, error, and toast states
- Optimize lists, pagination, Prisma selects, and indexes
- Add rate limiting to sensitive APIs
- Add workspace membership and role validation for shared data
- Test mobile widths around 375px, 768px, and 1280px
- Add dark mode only after base UI is stable

## Phase 10: Testing And Deployment

Goal: app is stable and deployment-ready.

Key work:

- Add unit tests for utilities and Zod schemas
- Add integration tests for service layer when feasible
- Add E2E test for register, login, add transaction, dashboard check
- Ensure `npm run build` passes
- Prepare production env, Prisma migration deploy, logging, and Vercel deployment

## MVP Priority

If the user asks for a fast release path, prioritize:

1. Phase 1 setup
2. Phase 2 auth
3. Phase 4 transactions
4. Phase 6 dashboard
5. Phase 3 categories
6. Phase 5+ iteration
