# HANDOFF — ResidencySolutions G2 Slice 1: Identity + Cloud Persistence Foundation
**Timestamp:** 2026-03-10T21:18:00-04:00 (2026-03-11T01:18:00Z)
**Commit:** Pending
**Repo:** `C:\Users\sean\antigravity-awesome-skills`

---

## What Was Done

### Layer A — Architecture Docs

**`prototypes/residency-plus/AUTH_ARCHITECTURE.md`**
- Decision: **Supabase Auth + PostgreSQL** (beats Netlify Identity, Firebase, Clerk)
- User model with `public.users` profile table (plan, stripe_customer_id)
- Session model: Supabase JWTs verified server-side in Netlify functions
- Persistence model: crate, history, session_state SQL schemas with RLS
- Anonymous → account migration flow (opt-in, one-time prompt)
- G1 entitlements attach point: `public.users.plan` + future `public.entitlements` table
- Phased rollout: Slice 2 (auth UI) → 3 (sync) → 4 (migration) → 5 (gating) → 6 (billing)

**`prototypes/residency-plus/CLOUD_PERSISTENCE_PLAN.md`**
- What syncs (crate/history/session) vs what stays local (library/playedMap)
- Why library is NOT synced (derived cache, not source of truth)
- Optimistic local-first sync strategy (localStorage wins for UX, cloud eventual-consistent)
- Planned Netlify functions for Slice 2–3
- Free vs Pro persistence limits
- Rollback: all sync additive, remove env vars to disable

### Layer B — Tiny Scaffold

**`prototypes/residency-plus/index.html`**
- Added `<button id="accountBtn">Sign In</button>` to the topbar (visually dimmed, `disabled`)
- This is the anchor point for Slice 2's auth UI — no functionality yet
- Does not affect any existing feature

---

## Architecture Decision: Why Supabase

| Criteria | Winner |
|---|---|
| SQL persistence (not NoSQL) | Supabase |
| Row-level security built-in | Supabase |
| G1 entitlements attach naturally | Supabase Postgres |
| Free tier (50k users, 500MB) | Supabase |
| Vendor-agnostic (standard Postgres) | Supabase |

---

## Known Limitations / Deferrals
- OAuth (Google/Apple sign-in): intentionally deferred to Slice 3
- Stripe billing: intentionally deferred to Slice 5
- SoundCloud Instagram/social links: unavailable from official API response shape

---

## Rollback
`git revert HEAD` is clean. The account button is visually dimmed and `disabled`. No behavior change.
