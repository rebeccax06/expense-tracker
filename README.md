# Expense Tracker

A personal finance and expense-tracking web app that normalizes multiple bank/
credit-card CSV & XLSX exports into one master transaction table, with manual
categorization, trips, budgets, and spending dashboards.

Built with Next.js (App Router) + TypeScript + Supabase (Auth, Postgres, RLS,
Storage) + Tailwind + shadcn/ui (Radix) + TanStack + Recharts.

## Architecture

A layered model keeps imported data and manual edits separate so re-imports
never destroy your work:

```
Uploaded file
   └─▶ raw_imports          immutable original rows (never discarded)
         └─▶ transactions   normalized, re-derivable (upsert by fingerprint)
               └─▶ transaction_overrides   your manual edits, keyed by fingerprint
                     └─▶ transactions_view  effective spending, computed at query time
```

- **Fingerprint** = stable hash of account + date + amount + description +
  occurrence index. Manual overrides attach by fingerprint, so reprocessing or
  re-importing the same file preserves categories, trips, and notes.
- **Import adapters** (`src/domain/imports/`) are pure functions. Known formats
  (Chase debit, Chase credit, Robinhood credit) ship as typed adapters; new
  formats use a config-driven generic adapter built from a column mapping you
  define in Settings — no code changes needed to add a bank.
- **Effective spending** logic lives in one place
  (`src/domain/transactions/normalization.ts`) and is mirrored by the
  `transactions_view` SQL for fast reporting.
- **Transfers / card autopays** are detected by configurable description
  patterns, flagged for review during import, and never auto-deleted. Transfers
  and income count as zero in expense reports; refunds reduce spending.

### Folder layout

```
src/
  app/(auth)/            login, signup, forgot/reset password
  app/(app)/             dashboard, transactions, imports, accounts,
                         categories, trips, budget, settings
  app/api/               import preview/commit + CSV export route handlers
  components/ui/         shadcn/ui components
  domain/                pure business logic (adapters, normalization, fingerprint)
  features/              client components per feature
  lib/                   supabase clients, env, validation (zod), parsing, format
  server/                queries, actions (server actions), services
supabase/migrations/     SQL schema (RLS, view, commit_import RPC, storage)
```

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project, then copy `.env.example` to `.env.local` and fill
   in the values from **Project Settings → API**:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
   - `NEXT_PUBLIC_SITE_URL` (`http://localhost:3000` for dev)

3. Apply the database schema. Either:

   - **SQL Editor (simplest):** open the Supabase Dashboard → SQL Editor, paste
     the contents of `supabase/schema.sql`, and run it. Or
   - **Supabase CLI:**

     ```bash
     supabase login
     supabase link --project-ref YOUR_PROJECT_REF
     supabase db push
     ```

4. (Optional but recommended) regenerate typed database types:

   ```bash
   supabase gen types typescript --linked > src/lib/supabase/database.types.ts
   ```

5. Run the dev server:

   ```bash
   npm run dev
   ```

The three known import formats are seeded automatically the first time you sign
in. Add accounts on the Accounts page, then import files on the Imports page.

## Supabase configuration notes

- **Auth:** email/password is enabled by default. For local testing you may
  disable "Confirm email" (Dashboard → Authentication → Providers → Email) so
  signups log in immediately.
- **Redirect URLs:** add `http://localhost:3000/**` (and your production URL)
  under Authentication → URL Configuration.
- **Storage:** the `imports` bucket (private, 10 MB limit, csv/xlsx only) is
  created by the migrations. Uploaded files are retained under a per-user prefix
  with RLS.
- **Email:** the built-in SMTP is rate-limited; configure custom SMTP for
  production password-reset emails.

## Deployment (Vercel)

1. Push this repo to GitHub and import it in Vercel.
2. Add the four env vars from `.env.local` to the Vercel project (set
   `NEXT_PUBLIC_SITE_URL` to your Vercel URL).
3. Add your Vercel URL to Supabase Auth redirect URLs.
4. Deploy.

## Security

- Row-level security on every user-owned table (`user_id = auth.uid()`).
- All server inputs validated with Zod; user identity always derived from the
  session, never from client input.
- Service-role key is server-only and never shipped to the browser.
- Imports: file-type/size/row-count limits, sanitized filenames, XLSX parsed
  with formulas disabled, and CSV export escapes formula-injection characters.

## Scripts

```bash
npm run dev     # start dev server
npm run build   # production build
npm run start   # run production build
npm run lint    # eslint
```
