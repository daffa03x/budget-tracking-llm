---
name: budget-auth-user
description: "Implement or review Budget Tracking authentication and user management: NextAuth v5 credentials, Prisma adapter models, register/login/logout, password hashing with bcryptjs, middleware protection, session helpers, profile API, settings profile updates, and secure account flows."
---

# Budget Auth User

## Workflow

1. Read Phase 2 and Phase 8 in `docs/budget-tracker-phases.md`, plus auth/profile routes in `docs/budget-tracker-modules.md`.
2. Read relevant Next.js 16 and NextAuth project guidance in local files before editing auth routes, middleware, or layouts.
3. Implement auth work as a vertical slice: validation schema, service helper, route/action, form UI, session-aware redirect, and verification.
4. Keep credentials and server-only values on the server.

## Security Rules

- Hash passwords with `bcryptjs`.
- Validate register, login, profile, and password-change inputs with Zod.
- Do not expose password hashes, tokens, or server-only environment variables to client components.
- Use authenticated session data as the source of `userId`.
- Protect dashboard and user data routes with middleware and server-side session checks.
- Use generic auth error messages where detailed errors could leak account existence.
- For account deletion or destructive data actions, require confirmation and re-check authorization server-side.

## Verification

Run `npm run lint` and `npm run build` after auth flow changes. Add focused tests for validation schemas or auth services when a test setup exists.
