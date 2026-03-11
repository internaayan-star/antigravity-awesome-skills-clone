# ResidencySolutions G2 — Hotfix Handoff

**Date:** 2026-03-10
**Task:** Auth Boot / Cloud Sync Regression Hotfix
**Status:** SHIPPED

---

## 1. Root Cause Analysis

After Slice 2 was completed, the local prototype booted into a "half-ready empty state" without bootstrap tracks or functionality. The root cause was a **JavaScript ReferenceError** inside the `index.html` file.

During the Auth Client wiring, `supabase.auth.onAuthStateChange` was placed early in the file execution to detect user session. Inside the auth check closure, it referenced variables (`crate`, `history`, `playlists`) to determine if local data existed for a cloud migration prompt. 

However, `playlists` was declared utilizing `let playlists = [];` roughly 400 lines *below* the auth initialization block. Because `let` variables strictly enforce block bindings via the **Temporal Dead Zone (TDZ)** in V8, accessing `typeof playlists` before its declaration fired a synchronous `ReferenceError`. This fatal exception destroyed the runtime context of `index.html`, which meant `document.addEventListener("DOMContentLoaded")` never triggered, blocking `doShuffle()`, leaving the UI as a completely blank shell.

Additionally, a parameter mapping mismatch was identified in `fetchCloudData` where the backend yielded `dig_range` and `station_id` but the UI expected `range` and `station`.

## 2. Changes Made

### A. Temporal Dead Zone Fix
- Relocated the global data arrays (`library`, `crate`, `history`, `playlists`, `currentItem`, `stations`, `playedMap`, etc.) to line ~1350, directly above the `window.supabase` initialization block. 
- The `typeof playlists` check inside the auth state handler now executes cleanly.

### B. Endpoint Payload Mismatch Fix
- Standardized the Session State fetch inside `fetchCloudData` to parse `s.dig_range` and `s.station_id` to strictly match the `sync-session-state.js` GET endpoint JSON shape.

### C. Validation of Cloud Hydration Invariants
- Verified that `fetchCloudData` merges accurately. When the cloud returns an empty state array (e.g. freshly created cloud account), `body.hasData` natively returns `false`, gracefully skipping the destructive overwrite of active anonymous data. 
- Validated that `sync-crate.js` throws a structured HTTP fail on missing headers rather than a string, which correctly trips the `fetchCloudData` catch block, bypassing the sync without destroying the local arrays.

---

## 3. CTO Summary

**What broke?** 
A modern Javascript execution block issue (TDZ) where `onAuthStateChange` was calling variables prematurely on boot. This killed the `index.html` parser outright.

**What was fixed?**
Reordered the `index.html` DOM variables to precede their usage inside the Supabase Auth listener, and patched a mismatched key-value mapping in session persistence (`dig_range`).

**Is Slice 2 trustworthy?**
Yes. Authentication, hydration, and migration are now stable and fail passively if the cloud misbehaves or is offline. Anonymous boot no longer evaluates undefined variables violently.

**Can Slice 4 resume?**
Slice 4 (or 5, depending on progression) can resume safely. The app shell is restored, endpoints are mapped, and cloud persistence is secure.
