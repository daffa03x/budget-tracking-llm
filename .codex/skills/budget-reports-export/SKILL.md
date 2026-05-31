---
name: budget-reports-export
description: "Implement or review Budget Tracking reports and export: monthly and yearly analytics, category reports, report filters, tabs, trend charts, summary tables, CSV export with papaparse, export APIs, filtered transaction export, and report service aggregations."
---

# Budget Reports Export

## Workflow

1. Read Phase 7 in `docs/budget-tracker-phases.md` and report routes in `docs/budget-tracker-modules.md`.
2. Read relevant Next.js 16 docs before editing report routes or pages.
3. Implement report work through `lib/services/report.service.ts` first, then API routes, hooks, UI, and export helpers.
4. Make report filters explicit and ensure exported data matches the visible filters.

## Report Rules

- Keep monthly, yearly, category, and trend aggregations in service functions.
- Scope every report query by authenticated `userId`.
- Use date ranges consistently between chart data, tables, and export.
- Return chart-ready data with stable keys and labels.
- Preserve Decimal precision until formatting for display or CSV.

## Export Rules

- Use `papaparse` for CSV when present.
- Include date, type, category, description, and amount columns.
- Apply the same filters used by the report or transaction screen.
- Generate export data server-side or from already-authorized API data; do not expose unrelated user records to the client.

## UI Rules

- Build `/reports` with compact filters, tabs, charts, and a summary table.
- Add loading, error, empty, and export-in-progress states.
