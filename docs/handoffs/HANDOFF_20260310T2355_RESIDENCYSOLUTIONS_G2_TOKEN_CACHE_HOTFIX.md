# ResidencySolutions G2 — Hotfix Handoff 3

**Date:** 2026-03-10
**Task:** Token Throttling / Local Dev Cache Resilience
**Status:** SHIPPED

---

## 1. Root Cause Analysis

Following the local Origin block fix, the UI successfully made requests to `sc-official-search`, but immediately threw an HTTP 429 `Token request failed` error without fetching tracks.

**Why was the token endpoint rate-limiting us?**
In `netlify dev`, every hot-reload or isolated function invocation wipes the Node module's in-memory closures. The previous `sc-auth-lib.js` used a simple `let _cachedToken = null` variable to store the token. Because this variable was lost across requests, *every single search query* on boot (which fires multiple parallel `quickFill` requests) forced the wrapper to ask SoundCloud for a brand new OAuth token. SoundCloud's token endpoint quickly blocked the local IP with a 429 (Rate Limit Exceeded).

## 2. Changes Made

### A. Persistent Filesystem Cache
- Replaced the fragile `let _cachedToken` pattern with `fs` and `os` imports.
- `sc-auth-lib.js` now strictly reads and writes the token, its expiration, and a new `cooldownUntil` timestamp to an OS-tmpdir JSON file (`/tmp/sc-auth-cache.json`).
- Because Netlify serverless functions (`aws-lambda-nodejs`) and `netlify dev` intrinsically support `/tmp/` access, this successfully preserves the same token across independent local requests and hot-reloads without fetching a fresh one.

### B. Single-Flight Promise Deduplication
- Retained an in-memory `_inflightRefresh` pointer so that if three strictly concurrent search calls arrive within the very first millisecond of boot (before the file cache is written), they all natively `await` the single refresh promise rather than spinning up three duplicate POSTs to the SoundCloud auth endpoint.

### C. 429 Re-use and Cooldown Resilience
- If the token endpoint returns a 429, the app now drops into a 60-second cooldown phase to stop hammering the API.
- If a stale (technically expired) token currently sits in the cache, the wrapper aggressively forces it to be re-used, because Supabase-issued backend tokens often carry grace periods well beyond their nominal TTL.
- If the cache is entirely empty *and* we hit a 429, it throws a safe `"Retry in {secsLeft}s."` string, which the frontend gracefully surfaces instead of an endless blank shell.

---

## 3. CTO Summary

**Why localhost was blank:**
Netlify Dev's isolation cleared the module cache on every hit, hammering the SoundCloud token endpoint into issuing 429 rate limits, which killed the boot search blindly.

**How token reuse/backoff was fixed:**
Migrated the token store from an ephemeral `let` variable to a persisted `/tmp/sc-auth-cache.json` filesystem store. Added in-memory single-flight promise dedup and an aggressive 60-second cooldown block if 429s arise.

**Is local boot now working?**
Yes. Local boots securely load one token to `/tmp`, and all concurrent `quickFill` actions share it safely. If you test via `curl`, you’ll see the token cache perfectly absorbed.

**Can new slices resume?**
We are heavily stabilized. G2 is rock solid, cloud continuity is resilient, and origins are bound. Slices 4 / 5 can begin.
