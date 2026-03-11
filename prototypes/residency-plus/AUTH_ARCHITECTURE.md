# AUTH_ARCHITECTURE.md — Residency+ Identity Foundation
_G2 Prototype | Decision Date: 2026-03-10_

---

## The Problem

Without identity:
- "Free vs paid" is theatre — no billing surface
- Library and crate are browser-local — lost on new device or cleared storage
- Retention signals don't tie to real users
- Lifecycle comms (email, push) have no recipient

Residency+ needs an auth foundation that is **lightweight but real** — not a toy.

---

## Architecture Decision: Supabase Auth + Database

### Chosen Stack

**Auth provider:** [Supabase Auth](https://supabase.com/docs/guides/auth)
**Persistence:** Supabase PostgreSQL (via Supabase client or Netlify edge functions)
**Session model:** JWTs issued by Supabase, verified server-side in Netlify functions

---

## Why Supabase Beats the Alternatives

| Criteria | Netlify Identity | Firebase/Firestore | Clerk | **Supabase** |
|---|---|---|---|---|
| Auth (email/OAuth) | ✅ built-in | ✅ | ✅ | ✅ |
| Real SQL persistence | ❌ | ❌ (NoSQL) | ❌ | ✅ PostgreSQL |
| Row-level security | ❌ | partial | ❌ | ✅ built-in RLS |
| G1 entितlement attach | hard | hard | hard | ✅ natural via db |
| Free tier generous | limited | ok | limited | ✅ 500MB, 50k users |
| Self-hostable | ❌ | ❌ | ❌ | ✅ |
| Vendor lock-in | Netlify-only | Google | ✅ open | ✅ Postgres-standard |
| Serverless-friendly | ✅ | ✅ | ✅ | ✅ REST + SDK |

**Decision: Supabase.** Best SQL persistence, open ecosystem, clean JWT model, aligns with G1's SQLite entitlements work (eventual migration to Supabase Postgres is natural).

---

## User Model

```sql
-- Supabase manages auth.users internally
-- We create a public.users profile table:
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  plan TEXT DEFAULT 'free',         -- 'free' | 'pro' | 'lifetime'
  plan_expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT,          -- future billing attach point
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: users can only read/write their own row
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self_only" ON public.users USING (auth.uid() = id);
```

---

## Session Model

- Supabase issues `access_token` (JWT, default: 1 hour) + `refresh_token`
- `access_token` passed as `Authorization: Bearer <token>` to Netlify function edge
- Netlify functions verify JWT using `SUPABASE_JWT_SECRET` — never trust client-supplied user IDs
- Session stored in `localStorage` (Supabase client handles this automatically)

---

## Persistence Model

### Cloud Tables

```sql
-- Saved crate (user's bookmarked tracks)
CREATE TABLE public.crate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  soundcloud_url TEXT NOT NULL,
  title TEXT,
  artist TEXT,
  bucket TEXT,
  kind TEXT,
  duration_ms INTEGER,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, soundcloud_url)
);
ALTER TABLE public.crate ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_crate" ON public.crate USING (auth.uid() = user_id);

-- Playback history (last 500)
CREATE TABLE public.history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  soundcloud_url TEXT NOT NULL,
  title TEXT,
  artist TEXT,
  bucket TEXT,
  played_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_history" ON public.history USING (auth.uid() = user_id);

-- Session state (genre, source, range, station)
CREATE TABLE public.session_state (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  genre TEXT DEFAULT 'all',
  source TEXT DEFAULT 'both',
  dig_range INTEGER DEFAULT 70,
  station_id TEXT DEFAULT '__all__',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.session_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_state" ON public.session_state USING (auth.uid() = user_id);
```

### What Stays Local (localStorage / IndexedDB)
- Full library track pool (IndexedDB `residencyDB_v16`) — too large for cloud per-request
- Played URL map (dedup guard) — ephemeral, local is correct
- Anonymous session state — until the user signs in

---

## Anonymous → Account Migration Flow

When a user signs up after using the app anonymously:

1. **Detect anonymous data** on sign-up completion
2. **Ask once**: "We found N saved tracks and your session settings. Migrate them to your account?"
3. If yes: `POST /.netlify/functions/migrate-local-data` with the local crate array + session state, authenticated with the new JWT
4. Server upserts into `crate` and `session_state` tables (deduplicates by URL)
5. Clear the "migration prompt shown" flag in localStorage

**Rule:** Never auto-migrate silently. One explicit prompt, one time.

---

## Where G1 Entitlements Attach

The `public.users.plan` column is the attachment point. G1 (residencysolutions-core) will eventually write or read this column (or a separate `entitlements` table) to determine feature access.

```sql
-- Future entitlements table (G1 integration point)
CREATE TABLE public.entitlements (
  user_id UUID PRIMARY KEY REFERENCES public.users(id),
  crate_limit INTEGER DEFAULT 50,           -- free: 50
  history_limit INTEGER DEFAULT 200,        -- free: 200
  cloud_sync_enabled BOOLEAN DEFAULT FALSE, -- free: false (localStorage only)
  export_enabled BOOLEAN DEFAULT TRUE,      -- always available
  stations_limit INTEGER DEFAULT 3,         -- free: 3 stations
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Risks and Rollback

| Risk | Mitigation |
|---|---|
| Supabase outage | App degrades to localStorage-only mode; no hard dependency in Slice 2 |
| JWT secret rotation | SUPABASE_JWT_SECRET updated in Netlify env; zero-downtime since tokens short-lived |
| Migration data loss | Migration is opt-in; local data remains until user explicitly deletes it |
| Over-building auth | Slice 2 scope: email/password only. OAuth in Slice 3. SAML never. |

---

## Phased Rollout

| Slice | Deliverable |
|---|---|
| **1 (this)** | Architecture docs + tiny scaffold (account button placeholder) |
| **2** | Supabase project setup + email/password auth UI + session JWT verified in functions |
| **3** | Cloud crate sync + history sync + session_state sync |
| **4** | Migration flow (anon → account) |
| **5** | Entitlements gating (free tier limits) |
| **6** | Paid plan + Stripe billing attach |
