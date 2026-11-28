-- Hardware passwords -> relay codes. Run once in the Supabase SQL editor (or psql).
-- One row per robot box. The password itself is never stored: only its SHA-256
-- (see src/boxcode.js). Rows are created by tools/seed-devices.mjs.

create table if not exists robot_devices (
  id            bigserial primary key,
  password_hash text        not null unique,        -- sha256 hex of the normalized password
  relay_id      text        not null unique check (relay_id ~ '^[2-9A-HJ-NP-Z]{6}$'),
  label         text,                                -- e.g. batch / box number
  created_at    timestamptz not null default now(),
  claimed_at    timestamptz,                         -- first successful login
  last_login_at timestamptz,
  login_count   integer     not null default 0,
  revoked       boolean     not null default false   -- true = password no longer works
);

-- Supabase exposes `public` tables through its REST API. With RLS on and NO policies,
-- the anon/authenticated API keys can read nothing; the relay worker connects with
-- the database password (postgres role), which bypasses RLS.
alter table robot_devices enable row level security;
