-- Expense Tracker initial schema
-- Layered model:
--   raw_imports      : immutable original rows (never destroyed)
--   transactions     : normalized, re-derivable (upsert by fingerprint)
--   transaction_overrides : manual user edits, keyed by stable fingerprint
--   reporting        : computed at query time (effective spending)
--
-- Every user-owned table carries user_id and has RLS: user_id = auth.uid().

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type account_type as enum ('checking', 'debit_card', 'credit_card', 'savings', 'cash', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type normalized_txn_type as enum ('expense', 'refund', 'transfer', 'income', 'adjustment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type import_strategy as enum ('chase_debit', 'chase_credit', 'robinhood_credit', 'generic');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sign_convention as enum ('negative_is_spending', 'positive_is_spending');
exception when duplicate_object then null; end $$;

do $$ begin
  create type parse_status as enum ('parsed', 'error');
exception when duplicate_object then null; end $$;

do $$ begin
  create type batch_status as enum ('pending', 'committed', 'failed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  -- How incoming money on non-credit accounts is treated by default.
  reimbursement_behavior text not null default 'income'
    check (reimbursement_behavior in ('income', 'refund', 'review')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- Create a profile row automatically when a new auth user is created.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- import_formats (reusable templates the user creates)
-- ---------------------------------------------------------------------------
create table if not exists import_formats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  institution text,
  strategy import_strategy not null default 'generic',
  -- Column names used to auto-detect this format from a file's header row.
  header_signature text[] not null default '{}',
  sign_convention sign_convention not null default 'negative_is_spending',
  -- Flexible config: autopay_patterns[], date_format, type rules, etc.
  config jsonb not null default '{}'::jsonb,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger import_formats_updated_at before update on import_formats
  for each row execute function set_updated_at();

create index if not exists import_formats_user_idx on import_formats(user_id);

-- Column -> normalized-field mapping (the "choose which columns to keep" flow)
create table if not exists import_format_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  format_id uuid not null references import_formats(id) on delete cascade,
  source_column text not null,
  -- target_field: transaction_date | posting_date | description | merchant |
  --               amount | bank_category | bank_type | ignore
  target_field text not null,
  transform text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists import_format_mappings_format_idx on import_format_mappings(format_id);

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  institution text,
  account_type account_type not null default 'other',
  last_four text check (last_four is null or last_four ~ '^[0-9]{3,4}$'),
  currency text not null default 'USD',
  import_format_id uuid references import_formats(id) on delete set null,
  -- Which sign in the raw amount indicates an outgoing purchase for this account.
  purchase_sign sign_convention not null default 'negative_is_spending',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger accounts_updated_at before update on accounts
  for each row execute function set_updated_at();

create index if not exists accounts_user_idx on accounts(user_id);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists categories_user_name_uidx
  on categories(user_id, lower(name));
create index if not exists categories_user_idx on categories(user_id);

-- ---------------------------------------------------------------------------
-- trips
-- ---------------------------------------------------------------------------
create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  destination text,
  start_date date,
  end_date date,
  notes text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists trips_user_idx on trips(user_id);

-- ---------------------------------------------------------------------------
-- import_batches (one uploaded file)
-- ---------------------------------------------------------------------------
create table if not exists import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  format_id uuid references import_formats(id) on delete set null,
  filename text not null,
  file_hash text,
  storage_path text,
  status batch_status not null default 'pending',
  total_rows int not null default 0,
  imported_rows int not null default 0,
  skipped_rows int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists import_batches_user_idx on import_batches(user_id);
create index if not exists import_batches_account_idx on import_batches(account_id);

-- ---------------------------------------------------------------------------
-- raw_imports (immutable source rows)
-- ---------------------------------------------------------------------------
create table if not exists raw_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null references import_batches(id) on delete cascade,
  row_number int not null,
  raw jsonb not null,
  parse_status parse_status not null default 'parsed',
  parse_error text,
  created_at timestamptz not null default now()
);

create index if not exists raw_imports_batch_idx on raw_imports(batch_id);

-- ---------------------------------------------------------------------------
-- transactions (normalized, re-derivable)
-- ---------------------------------------------------------------------------
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  raw_import_id uuid references raw_imports(id) on delete set null,
  batch_id uuid references import_batches(id) on delete set null,
  -- Stable identity across re-imports; overrides re-attach by this value.
  fingerprint text not null,
  transaction_date date not null,
  posting_date date,
  raw_description text not null,
  merchant text,
  raw_amount numeric(14,2) not null,
  -- + = spending, - = reduces spending. Sign already normalized by the adapter.
  normalized_spending_amount numeric(14,2) not null,
  bank_category text,
  bank_type text,
  normalized_type normalized_txn_type not null default 'expense',
  include_in_spending boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger transactions_updated_at before update on transactions
  for each row execute function set_updated_at();

-- Fingerprint is unique per user (it embeds an occurrence index) enabling
-- idempotent re-imports via upsert.
create unique index if not exists transactions_user_fingerprint_uidx
  on transactions(user_id, fingerprint);
create index if not exists transactions_user_date_idx on transactions(user_id, transaction_date);
create index if not exists transactions_account_idx on transactions(account_id);

-- ---------------------------------------------------------------------------
-- transaction_overrides (manual edits, separate layer)
-- Keyed by fingerprint so re-import/reprocessing never destroys user work.
-- ---------------------------------------------------------------------------
create table if not exists transaction_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fingerprint text not null,
  user_category_id uuid references categories(id) on delete set null,
  trip_id uuid references trips(id) on delete set null,
  location text,
  notes text,
  include_override boolean,           -- null = no override
  type_override normalized_txn_type,  -- null = no override
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger transaction_overrides_updated_at before update on transaction_overrides
  for each row execute function set_updated_at();

create unique index if not exists transaction_overrides_user_fingerprint_uidx
  on transaction_overrides(user_id, fingerprint);

-- ---------------------------------------------------------------------------
-- budgets (monthly category budgets)
-- ---------------------------------------------------------------------------
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  month date not null,   -- first day of the month
  amount numeric(14,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger budgets_updated_at before update on budgets
  for each row execute function set_updated_at();

create unique index if not exists budgets_user_category_month_uidx
  on budgets(user_id, category_id, month);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table accounts enable row level security;
alter table import_formats enable row level security;
alter table import_format_mappings enable row level security;
alter table import_batches enable row level security;
alter table raw_imports enable row level security;
alter table transactions enable row level security;
alter table transaction_overrides enable row level security;
alter table categories enable row level security;
alter table trips enable row level security;
alter table budgets enable row level security;

-- profiles: owner-only (id == auth.uid())
create policy "profiles_select_own" on profiles for select using (id = auth.uid());
create policy "profiles_update_own" on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_insert_own" on profiles for insert with check (id = auth.uid());

-- Generic owner policies for user_id tables.
do $$
declare t text;
begin
  foreach t in array array[
    'accounts','import_formats','import_format_mappings','import_batches',
    'raw_imports','transactions','transaction_overrides','categories','trips','budgets'
  ] loop
    execute format('create policy %I on %I for select using (user_id = auth.uid());', t||'_select_own', t);
    execute format('create policy %I on %I for insert with check (user_id = auth.uid());', t||'_insert_own', t);
    execute format('create policy %I on %I for update using (user_id = auth.uid()) with check (user_id = auth.uid());', t||'_update_own', t);
    execute format('create policy %I on %I for delete using (user_id = auth.uid());', t||'_delete_own', t);
  end loop;
end $$;
