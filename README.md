# Tehila Bodyshop CRM

Next.js + Supabase CRM for bodyshop repair workflow (intake to closure).

## Setup

### 1. Supabase Project

1. Create a [Supabase](https://supabase.com) project.
2. In **Authentication → Providers**: enable **Email** (Email + Password).
3. In **Storage**: create a bucket named **extras-images**, set to **Private**.
4. In **SQL Editor**: run migrations in order:
   - `src/db/migrations/001_init.sql`
   - `src/db/migrations/002_storage.sql` (after bucket exists)
   - `src/db/migrations/003_schema_align.sql` (if present)
   - `src/db/migrations/004_seed_branches.sql` (if present)

### 2. Environment

Copy `.env.example` to `.env.local` and set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- **anon key** is safe for client-side (browser). Use it in Next.js for Supabase client.
- **service_role key**: only for server-side admin tasks if needed; do not expose to the client.

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Seed users (optional)

Create users in Supabase Dashboard → Authentication → Users (email + password). Then in SQL Editor insert profiles:

```sql
-- Replace USER_ID with each auth user id from Dashboard
INSERT INTO profiles (id, full_name, role, branch_id)
VALUES
  ('USER_ID_ERAN', 'ערן', 'SERVICE_MANAGER', (SELECT id FROM branches WHERE name = 'NETIVOT' LIMIT 1)),
  ('USER_ID_ILANA', 'אילנה', 'OFFICE', (SELECT id FROM branches WHERE name = 'NETIVOT' LIMIT 1)),
  ('USER_ID_AMIT', 'עמית', 'CEO', NULL),
  ('USER_ID_AREZ', 'ארז', 'PAINTER', (SELECT id FROM branches WHERE name = 'NETIVOT' LIMIT 1)),
  ('USER_ID_KINERET', 'כנרת', 'SERVICE_ADVISOR', (SELECT id FROM branches WHERE name = 'NETIVOT' LIMIT 1));
```

## Docs

- [SPEC.md](SPEC.md) — technical spec
- [BUSINESS_PROCESS.md](BUSINESS_PROCESS.md) — business process (one page)
