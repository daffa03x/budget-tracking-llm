# Product Scope

Source of truth:

- `docs/budget-tracker-modules.md`
- `docs/budget-tracker-phases.md`

## Stack

- Next.js 16+ App Router
- TypeScript 5+
- Prisma 5+
- PostgreSQL for production, SQLite acceptable for local development
- NextAuth.js v5 beta
- shadcn/ui, Tailwind CSS, Recharts, React Hook Form, Zod, TanStack Query, Zustand, date-fns, bcryptjs, Sonner, papaparse/xlsx

## App Routes

- `/`: dashboard with balance summary, expense charts, budget overview, recent transactions
- `/transactions`: CRUD income and expenses with filters and pagination
- `/budgets`: budget limits by category and period
- `/reports`: monthly/yearly analytics and CSV/PDF export
- `/categories`: custom category management
- `/settings`: profile and preferences
- `/settings/members`: invite members and manage shared budget tracking access
- `/login`, `/register`: auth pages

## API Routes

- `/api/auth/[...nextauth]`: NextAuth handler
- `/api/transactions`: `GET`, `POST`
- `/api/transactions/[id]`: `GET`, `PATCH`, `DELETE`
- `/api/budgets`: `GET`, `POST`
- `/api/budgets/[id]`: `GET`, `PATCH`, `DELETE`
- `/api/categories`: `GET`, `POST`
- `/api/categories/[id]`: `PATCH`, `DELETE`
- `/api/reports/summary`: `GET`
- `/api/reports/monthly`: `GET`
- `/api/user/profile`: `GET`, `PATCH`
- `/api/workspaces`: `GET`, `POST`
- `/api/workspaces/[id]/members`: `GET`, `POST`
- `/api/workspaces/[id]/members/[memberId]`: `PATCH`, `DELETE`
- `/api/invitations/[token]/accept`: `POST`

Protect user data routes with session checks, ownership validation, and workspace membership/role validation for shared data.

## Service Responsibilities

- `TransactionService`: filters by date/category/type/search, pagination, CRUD, total income, total expense, net balance
- `BudgetService`: budget CRUD, spending progress, threshold alerts, overspend detection
- `ReportService`: monthly/yearly aggregation, category grouping, chart data, CSV export source data
- `AuthService` and `UserService`: password hashing, session/permission helpers, profile and preference updates
- `CategoryService`: default plus user categories, CRUD, prevent deletion when still in use
- `WorkspaceService` and `SharingService`: personal workspace creation, member invitations, role management, active workspace access, and permission checks

## Prisma Models

Core models:

- `User`: id, name, email, emailVerified, image, password, currency, timestamps; owns accounts, sessions, transactions, budgets, categories, owned workspaces, memberships
- `Workspace`: shared budget book boundary; owner relation, members, invitations, transactions, budgets, categories
- `WorkspaceMember`: user/workspace membership with role (`owner`, `admin`, `editor`, `viewer`)
- `WorkspaceInvitation`: email invite with role, token, expiry, accepted timestamp, workspace, and inviter
- `Transaction`: id, amount, type (`income` or `expense`), description, date, timestamps, user/creator relation, workspace relation, optional category relation
- `Budget`: id, limit, spent, period (`weekly`, `monthly`, `yearly`), startDate, endDate, timestamps, user/creator relation, workspace relation, category relation
- `Category`: id, name, icon, color, type (`income`, `expense`, `both`), isDefault, createdAt, optional user relation, optional workspace relation, transactions, budgets
- `Account` and `Session`: NextAuth adapter models

Recommended indexes:

- `Transaction`: `userId`, `[userId, date]`, `[userId, categoryId]`
- Shared data: index `workspaceId`, `[workspaceId, date]`, `[workspaceId, categoryId]`, and unique `[userId, workspaceId]` on memberships
- Add module-specific indexes when queries prove they need them.

## Shared UI

- `TransactionForm`: add/edit transaction form with Zod validation
- `BudgetCard`: budget progress display
- `CategoryBadge`: colored category badge with optional icon
- `CurrencyInput`: IDR-friendly currency input
- `DateRangePicker`: filter date range
- `StatCard`: dashboard summary metric
- `ChartWrapper`: responsive Recharts wrapper
- `MemberInviteDialog`: invite member and choose role
- `MemberRoleBadge`: show owner/admin/editor/viewer role

## Hooks

- `useTransactions`
- `useBudgets`
- `useCategories`
- `useReports`
- `useCurrency`
- `useWorkspaceMembers`

Use hooks for client interactivity; prefer server components for initial dashboard data where it fits Next.js 16 guidance.

## Utilities

- `formatCurrency(amount, currency)`
- `formatDate(date, format)`
- `getDateRange(period)`
- `calculateBudgetProgress(spent, limit)`
- `groupTransactionsByDate(transactions)`
- CSV export helpers under `lib/utils/export.ts` when report export is implemented
