---
name: budget-settings-profile
description: "Implement or review Budget Tracking settings and profile: settings page sections, profile updates, preferences for currency/date/week start, password change, active session display, danger zone actions, profile API, password API, account deletion, and secure destructive confirmations."
---

# Budget Settings Profile

## Workflow

1. Read Phase 8 in `docs/budget-tracker-phases.md` and user profile routes in `docs/budget-tracker-modules.md`.
2. Read relevant Next.js 16 docs before editing settings pages or user API routes.
3. Split settings into focused sections: profile, preferences, security, and danger zone.
4. Implement validation, service logic, API handlers, forms, feedback states, and verification.

## Backend Rules

- Scope all user profile updates to the authenticated session user.
- Validate profile, preferences, password, and destructive action inputs with Zod.
- Hash new passwords with `bcryptjs`.
- Require the current password or an equivalent confirmation for password and account deletion flows.
- Delete user-owned data intentionally and consistently if account deletion is implemented.

## Frontend Rules

- Keep settings screens plain, clear, and form-focused.
- Use tabs or sections only when it improves scanability.
- Show success and failure feedback for every save action.
- Use destructive confirmation dialogs for data wipe and account deletion.
- Keep server-only fields out of client state.
