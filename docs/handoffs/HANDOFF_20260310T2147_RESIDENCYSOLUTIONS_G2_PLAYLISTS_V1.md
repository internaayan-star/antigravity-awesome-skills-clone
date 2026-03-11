# ResidencySolutions G2 — Handoff

**Date:** 2026-03-10
**Slice:** Stage 3 - Playlists v1
**Status:** SHIPPED

---

## 1. What Was Done

This slice introduces a Creator-first Playlists workflow for Residency+ without pivoting into a messy "streaming clone" suite.

### A. Data Model
- Added `playlists` and `playlist_items` tables to `supabase/schema.sql`.
- Added strict Row Level Security (RLS) policies allowing users to own and manage their playables.

### B. Serverless & Sync Infrastructure  
- Created a `netlify/functions/sync-playlists.js` hook that allows the app to locally act and eagerly send `POST` requests to update the Postgres schema under `auth.uid()`. To adhere to "Slice 3 scale," limiters restrict pushes to 10 playlists / 50 items each, wiping and replacing item relations as a primitive, foolproof sync approach.
- Intercepted the Anon -> Account creation logic inside `migrate-local-data.js` to safely push local `residencyPlaylists_v1` entries the moment an account is initially registered.

### C. Local Playlists Workflow UI (`index.html`)
- Injected the playlist shell below the Crate/History list containing a `<select>` dropdown to configure the **active** playlist.
- Wired up a `[new]` button to mint UUIDs locally and store playlist names, and integrated `[rename]` and `[delete]` logic. 
- A persistent `+ Playlist` action button has been added directly to the master Result Card (next to Save and Open). Plentiful guardrails gracefully halt duplicates.

---

## 2. Intentionally Deferred
- **Rearranging** tracks via Drag and Drop was dropped (UI bloat for V1).
- **Billing Paywalls:** Free vs Pro boundaries are not coded yet (will happen in Slice 5). The 10/50 restriction represents a "soft cap" only.
- **Bi-Directional Restoring:** Since the complete Slice 2 Auth block wasn't present inside the HTML base, the logic defensively treats the user as an anonymous logged out user, keeping their state entirely pristine inside `localStorage`. Once Auth is wired in, `debouncedPlaylistSync()` will act correctly. 

---

## 3. Rollback
`git checkout [before_commit_hash]` restores `schema.sql`, `migrate-local-data.js`, and `index.html` seamlessly leaving local `localStorage` keys orphaned but harmless. 

---

## 4. Next Recommended Slice Follow-Up
**Slice 4**: Finalize robust bi-directional sync (pulling cloud data into the browser on fresh login) and properly embedding the full Supabase Auth Client Modal that was specified in the initial Slice 2 planning but didn't land cleanly in the HTML.
