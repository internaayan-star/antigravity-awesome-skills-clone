# CLOUD_PERSISTENCE_PLAN.md — Residency+ Cloud State
_G2 Prototype | Companion to AUTH_ARCHITECTURE.md | 2026-03-10_

---

## Current State: Browser-Only Persistence

| Data | Engine | Scope |
|---|---|---|
| Full track library | IndexedDB (`residencyDB_v16`) | This browser only |
| Saved crate | `localStorage` (`residencyCrate_v20`) | This browser only |
| Playback history | `localStorage` (`residencyHistory_v20`) | This browser only |
| Session state (genre/source/range/station) | `localStorage` (`residencyGenre_v1` etc.) | This browser only |
| Played URL map (dedup) | `localStorage` (`residencyPlayedMap_v12`) | This browser only |
| Last played track | `localStorage` (`residencyLast_v20`) | This browser only |

**Problem:** Every browser is a silo. Cross-device use loses everything.

---

## Phase 1: Cloud Sync (Slice 3 target)

Cloud tables are defined in `AUTH_ARCHITECTURE.md`. This doc covers the **sync strategy**.

### What Syncs to Cloud

| Data | Local Engine | Cloud Table | Sync Direction |
|---|---|---|---|
| Saved crate | localStorage | `public.crate` | bidirectional |
| Playback history | localStorage | `public.history` | write-remote on play, read-remote on login |
| Session state | localStorage | `public.session_state` | bidirectional |
| Track library | IndexedDB | **NOT synced** | local-only (too large, rebuilt per search) |
| Played URL map | localStorage | **NOT synced** | local-only (per-device ephemeral) |

### Why Not Sync the Library?

The full track library is rebuilt via `quickFill()` searches. It can be up to thousands of entries and changes constantly. Syncing it would:
- Create massive ingestion costs
- Require conflict resolution on every search
- Provide negligible value (it's always refreshable)

The library is best modeled as a **derived cache**, not source of truth.

---

## Sync Strategy: Optimistic Local-First

1. **All writes go to localStorage immediately** (no latency for the user)
2. After auth confirmation, a background sync pushes to Supabase
3. On login from a new device, cloud state is fetched and merged into localStorage
4. Conflicts resolved by **recency** (`saved_at` / `updated_at`)

```
User action (save track)
      ↓
Update localStorage (instant)
      ↓ (async, after 500ms debounce)
POST /.netlify/functions/sync-crate (with JWT)
      ↓
Supabase upserts row
```

This keeps the app fast and offline-capable while achieving eventual consistency.

---

## Planned Netlify Functions (Slice 2–3)

| Function | Purpose | Auth Required |
|---|---|---|
| `auth-session` | Validate JWT, return user plan | ✅ |
| `sync-crate` | Upsert crate rows for user | ✅ |
| `sync-history` | Append history rows | ✅ |
| `sync-session-state` | Upsert genre/source/range/station | ✅ |
| `migrate-local-data` | One-time anon→account migration | ✅ |
| `get-entitlements` | Return plan limits for gating | ✅ |

---

## Free vs Pro Persistence Limits

| Feature | Free | Pro |
|---|---|---|
| Crate size | 50 tracks | Unlimited |
| History | Last 200 | Last 2,000 |
| Cloud sync | ❌ localStorage only | ✅ |
| Stations | 3 | Unlimited |
| Cross-device | ❌ | ✅ |

**Rule:** Free users get full local functionality. Cloud sync is the core Pro value prop.

---

## Data Migration (Anon → Account)

See `AUTH_ARCHITECTURE.md` for the full migration flow. Summary:
1. On sign-up: detect local data
2. Prompt once: "Migrate N saved tracks and your settings?"
3. If yes: `POST /migrate-local-data` (authenticated) with crate + session_state JSON
4. Server upserts, deduplicates by URL
5. Local data retained until user clears it

**Never auto-migrate without explicit user consent.**

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Sync conflict on two devices | Low | Resolve by recency; last-write-wins is acceptable for music curation |
| localStorage overwrite on sync pull | Medium | Never overwrite local data that is newer than cloud data |
| Crate size bloat | Low | Validate limit server-side in `sync-crate`; return 409 if over limit |
| IndexedDB schema bumps | Low | Library is always rebuilt; schema version bump wipes and refills |

---

## Rollback Plan

All cloud sync is **additive and optional**. The app works identically without cloud sync functions deployed. To disable sync: remove/unset `SUPABASE_URL` and `SUPABASE_ANON_KEY` env vars. The app falls back gracefully to localStorage-only mode.
