# Uploads: production-flagged first integration

First production-ready Uploads path behind a single feature flag: **`PRODUCTION_UPLOADS_ENABLED`**.

## Flag

- **Name:** `PRODUCTION_UPLOADS_ENABLED`
- **Location:** `index.html` (client), ~line 1364: `const PRODUCTION_UPLOADS_ENABLED = false;`
- **Default:** `false` (no uploads in production UI).

## Behaviour

### When flag is **false** (default)

- Production app behaves exactly as before.
- No "User Uploads" in Discovery Sources list.
- No upload control in the drawer.
- Uploads do not enter discovery; `getActiveDiscoverySources()` excludes `"uploads"`.
- **loadItem:** If the item is uploads (`_source` / `sourceId === "uploads"`), `loadItem` returns immediately without changing player, history, or crate. SoundCloud path is never used for upload URLs.
- `searchUploads()` is not called with auth (uploads not in active sources).
- Backend `search-uploads` returns `{ collection: [] }` when no `Authorization` header.

### When flag is **true**

- **Discovery:** "User Uploads" appears in Discovery Sources; when selected, `searchUploads()` sends `Authorization: Bearer <token>` and `search-uploads` returns the user’s uploads from `user_uploads`.
- **Drawer:** One production "Upload file" row (file input + button + status). Flow: prepare → storage upload → register; on success the new item is added to the library.
- **Playback:** Upload items use HTML5 audio in the main player (`#playerUploadsWrap` / `#playerUploadsAudio`). SoundCloud iframe is hidden for uploads, shown for SoundCloud.
- **Station:** Make Station is disabled for uploads; `createStation` returns early for upload items.
- **Management:** In crate/history, upload items show Edit and Delete; Edit calls `uploads-update`, Delete calls `uploads-delete` and removes from library/crate/history.

## search-uploads.js — runtime / module

- **Decision:** **CommonJS only.** No ESM or dynamic `import()`.
- **Implementation:** `search-uploads.js` uses `require("./lib/sc-auth-lib.js")` and `require("./lib/sc-supabase-cjs.js")`.
- **Helper:** `netlify/functions/lib/sc-supabase-cjs.js` is a CJS copy of the JWT + Supabase REST logic (same behaviour as `sc-supabase-lib.js`). Used so the function does not mix CJS and ESM in one process.

## Player reset behaviour

- **When loading an uploads item (flag on):**
  - `widgetPause()` is called; SoundCloud iframe `src` is set to `about:blank` and hidden.
  - Uploads HTML5 audio is reset (`pause()`, `currentTime = 0`, `removeAttribute("src")`), then new `src` set and optionally `play()`.
- **When loading a SoundCloud (or non-uploads) item:**
  - Uploads HTML5 audio is paused, `currentTime = 0`, `src` removed; uploads wrap is hidden.
  - SoundCloud iframe is shown and `widgetLoad(item.url, autoplay)` runs.
- No stale title/meta/pills or player state is left when switching source.

## Regression-safe logs (uploads only)

- **Client (only when `PRODUCTION_UPLOADS_ENABLED`):** `[Uploads] source selected for discovery`, `[Uploads] search count N`, `[Uploads] player switched to uploads`, `[Uploads] player switched to soundcloud`.
- **Server:** `[search-uploads] uploads count { uid, count }` when auth present and query succeeds.
- No extra logs in the normal SoundCloud flow when the flag is false.

## Files changed

| File | Change |
|------|--------|
| `index.html` | Flag; discovery/source gating; loadItem uploads branch + early return when flag off and item is uploads; player reset (widget pause + iframe blank, uploads audio reset); regression-safe logs; production upload row; Edit/Delete for uploads. |
| `netlify/functions/search-uploads.js` | CJS only; `require("./lib/sc-supabase-cjs.js")`; when `Authorization` present, get user and query `user_uploads`, return normalized `{ collection }`; log uploads count. |
| `netlify/functions/lib/sc-supabase-cjs.js` | CJS helper: `getJwtUser`, `supabaseRestCall` (no ESM). |

## Smoke test checklist

**Flag OFF**

- [ ] No "User Uploads" in Discovery Sources.
- [ ] No "Upload file" row in drawer.
- [ ] Play on an upload item (e.g. from crate if one exists) does nothing (no widget load, no error).
- [ ] Shuffle / Auto-Dig / History / Saved / Crates unchanged.
- [ ] SoundCloud play and Station unchanged.
- [ ] No `[Uploads]` logs in console.

**Flag ON**

- [ ] "User Uploads" visible in Discovery Sources; can select.
- [ ] "Upload file" row visible in drawer; sign-in required to upload.
- [ ] Upload flow (prepare → upload → register) completes and item appears in library.
- [ ] Upload item plays in main player (HTML5); Station disabled for that item.
- [ ] Switching to a SoundCloud item: widget plays; uploads player hidden and reset.
- [ ] Switching to an uploads item: HTML5 plays; SoundCloud iframe hidden and reset.
- [ ] Edit/Delete on upload items in crate/history work; Delete removes from lists and storage.

## Rollback

1. Set `PRODUCTION_UPLOADS_ENABLED = false` in `index.html`.
2. Redeploy (or keep existing `search-uploads` behaviour: no auth → empty collection).

No data migration; uploads are additive and flag-gated.
