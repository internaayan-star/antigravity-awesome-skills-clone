# HANDOFF — ResidencySolutions G2 Slice 0: Stats Utility Restore
**Timestamp:** 2026-03-10T21:08:00-04:00 (2026-03-11T01:08:00Z)
**Commit:** Pending
**Repo:** `C:\Users\sean\antigravity-awesome-skills`

---

## Root Cause
`_SAFE_FIELDS` in both wrapper functions (`sc-official-search.js`, `sc-official-resolve.js`) were over-stripped to 5–6 basic fields. As a result:
- `playback_count`, `favoritings_count`, `comment_count` → all `null`
- `duration`, `created_at` → stripped → Len/Uploaded pills show `—`
- Artist page URL (`user_permalink_url`) → never returned

Frontend: `applyStatsPills()`, `fmtMs()`, `fmtDate()`, `fmtNum()`, `setPill()` were all completely absent (dead code references), causing silent runtime `ReferenceError`s.

---

## Changes

### `netlify/functions/sc-official-search.js`
- Expanded `_SAFE_FIELDS` to include: `playback_count`, `favoritings_count`, `comment_count`, `duration`, `created_at`, `bpm`
- Added `user_permalink_url` to `shapeTrack()` output

### `netlify/functions/sc-official-resolve.js`
- Expanded `_SAFE_TRACK_FIELDS` with same engagement + duration fields
- Added `duration`, `created_at` to `_SAFE_PLAYLIST_FIELDS`
- Added `user_permalink_url` to `shapeResource()` output

### `prototypes/residency-plus/index.html`
- Restored `fmtMs()` — duration formatter (m:ss / Xh Xm)
- Restored `fmtDate()` — ISO date to "Month YYYY"
- Added `fmtNum()` — number to "1.2k" / "3.4M"
- Restored `setPill(el, text)` — show/hide pill with text
- Restored `applyStatsPills(item, showStats)` — conditionally shows plays/likes/comments based on statsToggle
- Fixed all dead `pillLen.textContent` / `pillRel.textContent` calls → `setPill()`
- Fixed dead `applyStatsPills(item)` call → `applyStatsPills(item, statsToggle.checked)`
- Post-resolve block now also updates stats pills after background resolution

---

## Safety Notes
- Only public engagement counts are exposed (not credentials, tokens, or private user data)
- Instagram/social outbound links were NOT added — not reliably in SoundCloud API response shape; documented as limitation
- Stats pills remain `statsToggle`-gated (off by default)
- Len/Uploaded/BPM pills always show (not gated)

---

## Limitation
SoundCloud's official API does not reliably return Instagram/social links in the track response shape. These are omitted intentionally. The `user_permalink_url` provides the artist's SoundCloud profile page which is a safe public URL.

---

## Rollback Plan
`git revert HEAD` cleanly removes this commit from all three files.
