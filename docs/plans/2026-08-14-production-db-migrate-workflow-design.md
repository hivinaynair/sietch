# Production database migrate workflow

**Date:** 2026-08-14  
**Status:** Approved

## Goal

Automatically apply Drizzle migrations to the matching Neon database when code is pushed to `staging` or merged to production (`main`), without putting GitHub in charge of Vercel deploys.

## Branch model

- **`staging`:** check-in branch (new). PRs target this branch. GitHub default branch should be `staging`.
- **`main`:** production. Customers. Merge `staging` → `main` to release.

Create `staging` from current `main`.

## Workflow

- **Trigger:** `push` to `staging` or `main` (every push; `drizzle-kit migrate` is a no-op when nothing is pending).
- **Job:** checkout, install Bun `1.4.0`, `bun install --frozen-lockfile`, run `bun run db migrate`.
- **Connection:** Neon unpooled URL via `DATABASE_URL_UNPOOLED` (drizzle-kit must not use the pooler).
- **Secrets:** GitHub Environments `staging` and `production`, each with its own `DATABASE_URL_UNPOOLED`. Never the same database.
- **Concurrency:** one migrate per branch; do not cancel in-progress runs.
- **If no SQL journal yet:** skip migrate successfully (repo has no `packages/db/drizzle` files today).

## Deploy coupling

Leave Vercel Git deploys as-is (`staging` branch → staging deployment, `main` → production). Migrations must be additive / expand-contract so a brief overlap with the running app is safe. A failed migrate job does not roll back Vercel; fix forward. Do not merge to `main` until the same migration files have already been applied on staging.

## Out of scope

- GitHub-owned `vercel deploy --prod`
- Migrate during the Vercel build
- Path filters on `packages/db/drizzle/**`
- Preview-deploy Neon branching
