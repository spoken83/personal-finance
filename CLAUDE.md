# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A workspace-level `CLAUDE.md` lives one directory up at `/Users/gordonfrois/workspace/gordonfrois/CLAUDE.md` and covers cross-project conventions for `finance/`, `homepage/`, and `redesign/`. This file is the **finance-specific** companion — read both.

## Commands

Run all commands from `finance/`.

- `npm run dev` — Next.js dev server (default port 3000).
- `scripts/start.sh` — local helper: kills anything on port 3001, clears `.next`, then `next dev -p 3001`.
- `npm run build` / `npm start` — production build / serve.
- `npm run lint` — ESLint (Next.js core-web-vitals + TS config).
- `npm run db:push` — push Drizzle schema in `src/lib/schema.ts` to the Neon DB at `DATABASE_URL`.
- `npm run db:generate` — generate SQL migrations into `./drizzle`.
- `npm run db:studio` — Drizzle Studio.
- `npm run seed` — seed via `src/scripts/seed.ts`.
- `npm run cf:build` / `cf:deploy` / `cf:preview` — build / deploy / locally preview the Cloudflare Workers bundle via `@opennextjs/cloudflare`.
- One-off TS scripts: `npx tsx scripts/<name>.ts` — utilities in `scripts/` (`dump-db.ts`, `check-counts.ts`, `debug-spending.ts`, `restore-db.ts`) and in `src/scripts/` (`seed.ts`, `import-balances.ts`, `import-transactions.ts`).
- `scripts/reset-db.sh` — destructive DB reset helper. Confirm before running.
- `infra/start.sh` — production start script (`cd /Users/froisagent/finance-tracker && next start -p 3001`). Path is fixed for the deploy host, not local dev.

There is no test runner configured.

## Required environment

`DATABASE_URL` (Neon Postgres), `OPENAI_API_KEY`, `NEXTAUTH_SECRET`, `AUTH_PASSCODE` (defaults to `121314` in dev — see `src/lib/auth.ts`).

## Architecture

**Stack**: Next.js 16 App Router, React 19, Drizzle ORM (`drizzle-orm/neon-http`) against Neon serverless Postgres, NextAuth (Credentials/passcode), Tailwind 4 + shadcn 4 (base-nova style, neutral base color — see `components.json`), Anthropic SDK and OpenAI SDK for AI categorization.

### Route structure
- `src/app/(authenticated)/` — authenticated UI. The route group's `layout.tsx` enforces the auth gate; pages are `dashboard`, `transactions` (+ `transactions/upload`), `budget`, `categories`, `investments`, `settings`.
- `src/app/login/` and `src/app/api/auth/[...nextauth]/` — public auth.
- `src/app/api/` — REST route handlers grouped by domain: `auth`, `balances`, `budget` (+ `budget/runway`), `categories` (+ `categories/rules`), `dashboard` (+ `dashboard/summary`, `dashboard/health-check`), `investments` (+ `investments/snapshots`), `transactions` (+ `transactions/[id]`, `transactions/[id]/amortize`, `transactions/[id]/shift`), `upload` (+ `upload/[id]`, `upload/[id]/confirm`).
- The collection `/api/transactions` accepts bulk **PATCH** (re-categorize) and **DELETE** (`{ ids: number[] }`) for selections from the transactions table.

### Domain model (`src/lib/schema.ts`)
The schema is centered on transactions with a two-level taxonomy and an upload-then-confirm ingest flow:

- **Categories are two-tier**: `masterCategories` (top-level, has `isExcluded` to exclude from spend totals) ⟶ `spendCategories` (child). Every `transactions` row stores both `masterCategoryId` and `spendCategoryId` denormalized for index/query speed.
- **`bankAccounts`** — sources (Citibank, OCBC, Trust, DBS, etc.) with `accountType` (default `credit_card`).
- **`transactions`** — stores `accountingAmt` (always present, the SGD-equivalent used for reporting) plus optional `amountFcy` + `fcyCurrency` for FX transactions. `isConfirmed` gates whether a row from an upload is finalized. `parentTransactionId` + `isAmortized` model the **parent → children** pattern used by both `transactions/[id]/amortize` (split one txn evenly across N months) and `transactions/[id]/shift` (move one txn into a different reporting month — a "split into 1"). The parent is marked `isAmortized=true` and hidden from queries (the GET filter is `eq(isAmortized, false)`); children carry `parentTransactionId` and show an Undo affordance that reverts the operation. Don't expand the listing query to include `isAmortized=true` rows — that would double-count.
- **`statementUploads`** — a row per uploaded file (PDF/CSV/XLSX). Transactions are inserted with `statementUploadId` and `isConfirmed=false`; the `upload/[id]/confirm` route flips them to confirmed.
- **`categorizationRules`** — pattern-based rules with `priority`; consulted by `src/lib/categorizer.ts` before falling back to AI.
- **`accountBalances`** — one (bankAccount, month) row with the actual balance, unique on `(bankAccountId, month)`.
- **`investmentAccounts`** + **`investmentSnapshots`** — monthly balance/contributions/withdrawals per investment account, unique on `(investmentAccountId, month)`.
- **`budgets`** — monthly budget amounts scoped to either a master or spend category, with `effectiveFrom` / `effectiveTo` for time-bounded budgets.
- **`runwayConfig`** — single-row config (`totalProceeds`, `monthlyInvestmentTarget`, `expectedReturnRate`, `projectionYears`) feeding `api/budget/runway`.

### Library layer (`src/lib/`)
- `db.ts` — exports `db` (singleton `drizzle()` over `neon()` HTTP client). In non-prod it caches onto `globalThis.db` to survive HMR; in prod every cold start gets a fresh client. **Always import `db` from here, never construct a new client.**
- `auth.ts` — NextAuth `authOptions` with a single CredentialsProvider matching `AUTH_PASSCODE`. JWT session strategy, sign-in page at `/login`. The env var is `.trim()`ed (see commit `8ec2ecb`) — keep that.
- `claude.ts` / `categorizer.ts` — Anthropic-backed AI categorization. `categorizer.ts` is the orchestrator: rules first, AI fallback.
- `csv-parser.ts` / `pdf-parser.ts` — bank-statement parsers. `pdf-parse` cannot be webpack-bundled, so `next.config.ts` lists it under `serverExternalPackages`. Don't move it.
- `format.ts` / `utils.ts` — shared formatting and `cn()` helper.

### AI / external clients
- The OpenAI client must be **lazy-initialized** (see commit `f4d36c7`: "lazy-init OpenAI client to avoid build-time crash"). Construct it inside the handler, not at module top-level, so the build doesn't crash when `OPENAI_API_KEY` is absent.

### Component conventions
- shadcn config: `style: base-nova`, `baseColor: neutral`, `iconLibrary: lucide`. Aliases: `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, `@/hooks`.
- Tailwind v4 via `@tailwindcss/postcss` (no `tailwind.config.*`). CSS variables live in `src/app/globals.css`.
- `next.config.ts` sets `images.unoptimized: true` and `optimizePackageImports: ["lucide-react", "recharts", "date-fns"]`.

## Deploy

Two targets, both supported in this repo:
- **Vercel** (default) — `.vercel/` is the linked project.
- **Cloudflare Workers** via `@opennextjs/cloudflare` — `cf:deploy` builds with OpenNext and deploys via wrangler. The Cloudflare adapter has historical edge cases around uploads (see commit `dee868d`); when changing upload routes, sanity-check both targets.

## UI conventions worth knowing

- **Dashboard Monthly Breakdown** hides rows with no activity across the currently selected month range. A row is shown when *any* month in range has a non-zero value (not when the sum is non-zero), so a category that nets to 0 via refund still appears.
- **Portfolio & Balances** (`investments` page) shows a **Previous balance** column derived client-side from the full balances/snapshots history — it's the most recent record *before* the selected month, not the prior calendar month. The page fetches `/api/balances` without a month filter for this reason; don't narrow it back to a single month.
- **Currency inputs on balances** use a `CurrencyInput` wrapper that renders `$12,345` on blur and the raw editable number on focus. Underlying state is a clean numeric string so save handlers are untouched.

## History to be aware of

- ORM was migrated from Prisma to Drizzle (commit `6c14b71`). Don't reintroduce Prisma patterns; Drizzle's relational queries (`db.query.*`) are available because `schema` is passed to `drizzle()`.
