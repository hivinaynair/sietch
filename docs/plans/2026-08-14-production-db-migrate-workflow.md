# Production DB migrate workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a GitHub Action that runs Drizzle migrate on pushes to `staging` and `main`, create the `staging` branch, and document secrets plus the branch model.

**Architecture:** One workflow file. Job `environment` is `production` when `github.ref_name == main`, otherwise `staging`. The job uses `secrets.DATABASE_URL_UNPOOLED` from that environment and runs the existing root script `bun run db migrate` (`turbo run db:migrate --filter=@repo/db` → `drizzle-kit migrate` in `packages/db`). Skip the migrate command when `packages/db/drizzle/meta/_journal.json` is missing so an empty schema does not fail CI.

**Tech Stack:** GitHub Actions, Bun 1.4.0, Drizzle Kit, Neon (unpooled URL), GitHub Environments.

---

### Task 1: Add the migrate workflow

**Files:**
- Create: `.github/workflows/migrate.yml`
- Modify: `README.md` (Commands / Neon section — add branching + CI)

**Step 1: Create `.github/workflows/migrate.yml`**

```yaml
name: Migrate database

on:
  push:
    branches: [main, staging]
  workflow_dispatch:

concurrency:
  group: migrate-${{ github.ref }}
  cancel-in-progress: false

jobs:
  migrate:
    name: Apply Drizzle migrations
    runs-on: ubuntu-latest
    environment: ${{ github.ref_name == 'main' && 'production' || 'staging' }}
    steps:
      - uses: actions/checkout@v5

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.4.0"

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Apply migrations
        env:
          DATABASE_URL_UNPOOLED: ${{ secrets.DATABASE_URL_UNPOOLED }}
        run: |
          if [ ! -f packages/db/drizzle/meta/_journal.json ]; then
            echo "No Drizzle journal yet; skipping migrate."
            exit 0
          fi
          if [ -z "$DATABASE_URL_UNPOOLED" ]; then
            echo "DATABASE_URL_UNPOOLED is not set on the ${{ github.ref_name == 'main' && 'production' || 'staging' }} GitHub Environment."
            exit 1
          fi
          bun run db migrate
```

**Step 2: Document in README.md**

After the Neon paragraph, add a short “Branches and production migrate” section covering:

- `staging` vs `main`
- workflow name and when it runs
- GitHub Environments `staging` / `production` each need secret `DATABASE_URL_UNPOOLED` (Neon **direct**, hostname without `-pooler`)
- Vercel still deploys from Git; migrations should be additive
- skip behavior when there are no generated SQL files

**Step 3: Create `staging` from current `main`**

```bash
git branch staging
```

Do not push or change the GitHub default branch unless the user asks. After they push `staging`, they should set it as the repo default and add the two Environments + secrets in GitHub settings (or `gh api` if they request that).

**Step 4: Sanity-check YAML locally if `actionlint` is available; otherwise visual review.**

Expected: workflow uses Bun 1.4.0, frozen lockfile, environment mapping, skip-without-journal, fail-closed if secret missing when journal exists.
