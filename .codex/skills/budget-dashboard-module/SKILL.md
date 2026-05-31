---
name: budget-dashboard-module
description: "Implement or review the Budget Tracking dashboard and visualization module: summary report APIs, monthly chart data, category breakdown, StatCard, MonthlyBarChart, CategoryPieChart, RecentTransactions, BudgetOverview, MonthSelector, Suspense, skeletons, and server/client component boundaries."
---

# Budget Dashboard Module

## Workflow

1. Read Phase 6 in `docs/budget-tracker-phases.md` and dashboard/report routes in `docs/budget-tracker-modules.md`.
2. Read the relevant Next.js 16 docs for server components, route handlers, caching, and loading UI before coding.
3. Put aggregation logic in `lib/services/report.service.ts`.
4. Use server components for initial dashboard data when it fits, and client components for charts or interactive controls.
5. Verify both empty datasets and realistic transaction datasets.

## Data Rules

- Summary should include income, expense, net balance, transaction count, and current month context when requested.
- Monthly charts should return stable labels and numeric values ready for Recharts.
- Category breakdown should include category identity, color, and expense total.
- Recent transactions should be limited and scoped to authenticated `userId`.
- Budget overview should use the same calculation rules as the budgets module.

## UI Rules

- Keep the dashboard dense and scannable.
- Use `StatCard` for high-level metrics.
- Wrap Recharts in responsive containers with loading and empty states.
- Avoid charts that collapse to zero height.
- Add `Suspense` and skeletons for slow sections.
