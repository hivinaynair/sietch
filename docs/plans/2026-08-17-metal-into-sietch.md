# Metal into Sietch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Copy the full Bare Metal stack into this Turborepo as sibling apps so both demo pillars run from one checkout.

**Architecture:** One-time snapshot from `/Users/vinay/code/metal`. Sietch `apps/web` stays. Metal web becomes `apps/bare-metal` on port 3003. Metal db/shared become `@repo/metal-db` and `@repo/metal-shared`. UI remounts onto `@repo/ui`. Do not merge schemas, contracts, or web apps. Do not copy secrets.

**Tech Stack:** Bun workspaces, Turborepo, Next.js 16.3, Eve, Hono, Drizzle, Biome.

**Source of truth for the copy:** `/Users/vinay/code/metal` (local checkout of `hivinaynair/metal`).

**Exclude from every copy:** `node_modules`, `.next`, `dist`, `.turbo`, `.env`, `.env.local`, `.eve`, `.output`, `.nitro`, `.vercel`.

---

### Task 1: Copy Metal packages that we keep

**Files:**
- Create: `packages/metal-db/**` (from `metal/packages/db`)
- Create: `packages/metal-shared/**` (from `metal/packages/shared`)
- Create: `packages/metal-scripts/**` (from `metal/scripts`)

**Step 1: rsync the three packages**

```bash
rsync -a --exclude node_modules --exclude dist --exclude .turbo --exclude .env --exclude .env.local \
  /Users/vinay/code/metal/packages/db/ /Users/vinay/code/sietch/packages/metal-db/

rsync -a --exclude node_modules --exclude dist --exclude .turbo --exclude .env --exclude .env.local \
  /Users/vinay/code/metal/packages/shared/ /Users/vinay/code/sietch/packages/metal-shared/

rsync -a --exclude node_modules --exclude dist --exclude .turbo --exclude .env --exclude .env.local \
  /Users/vinay/code/metal/scripts/ /Users/vinay/code/sietch/packages/metal-scripts/
```

**Step 2: Confirm no secrets landed**

```bash
find packages/metal-db packages/metal-shared packages/metal-scripts -name '.env*'
```

Expected: empty (or only `.env.example` if we add one later).

**Step 3: Commit**

```bash
git add packages/metal-db packages/metal-shared packages/metal-scripts
git commit -m "chore: snapshot Metal db, shared, and scripts packages"
```

---

### Task 2: Copy Metal apps and contracts

**Files:**
- Create: `apps/bare-metal/**` (from `metal/apps/web`)
- Create: `apps/agent/**` (from `metal/apps/agent`)
- Create: `apps/facilitator/**` (from `metal/apps/facilitator`)
- Create: `contracts/metal/**` (from `metal/contracts`)

**Step 1: rsync**

```bash
rsync -a --exclude node_modules --exclude .next --exclude dist --exclude .turbo --exclude .env --exclude .env.local --exclude .eve --exclude .output --exclude .nitro --exclude .vercel \
  /Users/vinay/code/metal/apps/web/ /Users/vinay/code/sietch/apps/bare-metal/

rsync -a --exclude node_modules --exclude dist --exclude .turbo --exclude .env --exclude .env.local --exclude .eve --exclude .output --exclude .nitro \
  /Users/vinay/code/metal/apps/agent/ /Users/vinay/code/sietch/apps/agent/

rsync -a --exclude node_modules --exclude dist --exclude .turbo --exclude .env --exclude .env.local \
  /Users/vinay/code/metal/apps/facilitator/ /Users/vinay/code/sietch/apps/facilitator/

rsync -a --exclude node_modules \
  /Users/vinay/code/metal/contracts/ /Users/vinay/code/sietch/contracts/metal/
```

**Step 2: Delete files we are not keeping**

- `apps/bare-metal/eslint.config.js`
- `apps/bare-metal/components.json`
- any copied `next-env.d.ts` if gitignored (leave it; `.gitignore` already has it)

**Step 3: Confirm no secrets**

```bash
find apps/bare-metal apps/agent apps/facilitator contracts/metal -name '.env*'
```

Expected: empty.

**Step 4: Commit**

```bash
git add apps/bare-metal apps/agent apps/facilitator contracts/metal
git commit -m "chore: snapshot Bare Metal web, agent, facilitator, and contracts"
```

---

### Task 3: Remap package names and workspace imports

**Files:**
- Modify: every copied `package.json`, `tsconfig.json`, and source file that mentions `@workspace/`

**Step 1: Rename packages**

`packages/metal-db/package.json`:
- `"name": "@repo/metal-db"`
- `"check-types": "tsc --noEmit"` (replace `typecheck`)
- `"@workspace/typescript-config"` → `"@repo/typescript-config"`

`packages/metal-shared/package.json`:
- `"name": "@repo/metal-shared"`
- same script and tsconfig remaps

`packages/metal-scripts/package.json`:
- `"name": "@repo/metal-scripts"`
- `"@workspace/db"` → `"@repo/metal-db"`
- `"@workspace/shared"` → `"@repo/metal-shared"`

`apps/bare-metal/package.json`:
- `"name": "bare-metal"`
- `"dev": "next dev --port 3003"`
- `"check-types": "SKIP_ENV_VALIDATION=1 next typegen && tsc --noEmit"`
- remove `lint` / `format` / `typecheck`
- `"next": "16.3.0"`
- `@workspace/db` → `@repo/metal-db`
- `@workspace/shared` → `@repo/metal-shared`
- `@workspace/ui` → `@repo/ui`
- drop `@workspace/eslint-config` and `eslint`
- `@workspace/typescript-config` → `@repo/typescript-config`

`apps/agent/package.json` and `apps/facilitator/package.json`:
- keep names `agent` and `facilitator`
- `typecheck` → `check-types`
- `@workspace/db` → `@repo/metal-db`
- `@workspace/shared` → `@repo/metal-shared`

**Step 2: Rewrite imports in source**

From repo root, only inside the copied trees:

```bash
rg -l '@workspace/' apps/bare-metal apps/agent apps/facilitator packages/metal-db packages/metal-shared packages/metal-scripts
```

Replace:
- `@workspace/ui` → `@repo/ui`
- `@workspace/db` → `@repo/metal-db`
- `@workspace/shared` → `@repo/metal-shared`
- `@workspace/typescript-config` → `@repo/typescript-config`

Also update `apps/bare-metal/tsconfig.json` paths (`@workspace/ui/*` → `@repo/ui/*`, extend `@repo/typescript-config/nextjs.json`).
Update other copied tsconfigs the same way.

**Step 3: Fix metal-scripts contract paths**

`packages/metal-scripts/compile-contracts.ts` currently reads `contracts/${name}.sol` from cwd. After the move it must read `contracts/metal/${name}.sol` and write `contracts/metal/artifacts/${name}.json` when run from the repo root.

Root `package.json` scripts to add:

```json
"metal:compile-contracts": "bun packages/metal-scripts/compile-contracts.ts",
"metal:deploy-contracts": "bun --env-file=packages/metal-scripts/.env.local packages/metal-scripts/deploy-contracts.ts",
"metal:fund-wallet": "bun --env-file=packages/metal-scripts/.env.local packages/metal-scripts/fund-wallet.ts",
"metal:bootstrap": "bun --env-file=packages/metal-scripts/.env.local packages/metal-scripts/demo-bootstrap/index.ts"
```

**Step 4: Commit**

```bash
git add -u
git commit -m "chore: remap Metal packages onto @repo/* and rename the web app"
```

---

### Task 4: Wire Turbo, UI source, and README

**Files:**
- Modify: `turbo.json` — add Metal build env vars (copy the list from `/Users/vinay/code/metal/turbo.json`)
- Modify: `packages/ui/src/styles/globals.css` — add `@source "../../../../apps/bare-metal/**/*.{ts,tsx}";`
- Modify: `apps/bare-metal/vercel.json` — `--filter=bare-metal`
- Modify: `apps/bare-metal/next.config.ts` — `transpilePackages: ["@repo/ui", "@repo/metal-shared"]`
- Modify: `README.md` Related section — one repo, two products
- Create: `.env.example` next to each Metal app / `packages/metal-db` from the env schemas (no secret values)

**Step 1: Apply the wiring edits**

**Step 2: Commit**

```bash
git add turbo.json packages/ui/src/styles/globals.css apps/bare-metal/vercel.json apps/bare-metal/next.config.ts README.md apps/bare-metal/.env.example apps/agent/.env.example apps/facilitator/.env.example packages/metal-db/.env.example
git commit -m "chore: wire Bare Metal into Turbo, shared UI, and README"
```

---

### Task 5: Install, format, and verify

**Step 1: Install**

```bash
bun install
```

Expected: lockfile updates, workspaces resolve `@repo/metal-db` and `@repo/metal-shared`.

**Step 2: Biome-format the copied trees so the repo lint passes**

```bash
bun run format-and-lint:fix
```

If Metal files explode the diff, that is intended — Biome owns the repo.

**Step 3: Typecheck Metal packages**

```bash
turbo run check-types --filter=bare-metal --filter=agent --filter=facilitator --filter=@repo/metal-db --filter=@repo/metal-shared
```

Expected: pass. `bare-metal` uses `SKIP_ENV_VALIDATION=1` like Sietch web.

**Step 4: Run Metal's existing tests**

```bash
bun test apps/agent apps/facilitator apps/bare-metal packages/metal-shared
```

Expected: existing tests pass.

**Step 5: Commit install + format**

```bash
git add bun.lock package.json
git commit -m "chore: install Bare Metal workspaces and format with Biome"
```
