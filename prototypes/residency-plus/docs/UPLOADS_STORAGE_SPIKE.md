# User Uploads — Storage & Metadata Spike (Phase 0)

Backend/storage foundation for User Uploads. **Zero production UX change.** No uploads UI in production path; hidden Labs and backend-only endpoints only.

---

## 1. Chosen storage approach

- **Metadata:** PostgreSQL table `public.user_uploads` in Supabase (same auth/DB as existing sync endpoints).
- **Auth:** Existing Supabase JWT; `getJwtUser(req)` and user token passed to Supabase REST so **Row Level Security (RLS)** enforces ownership. No client-supplied user_id trusted.
- **Object storage (future):** Supabase Storage bucket `uploads` with path convention `{user_id}/{upload_id}/{original_filename}`. This spike defines the metadata schema and endpoints; actual file upload and signed URLs are a follow-up step. `storage_url` in the table holds the object path or a public/signed URL when available.

---

## 2. Schema

**Table:** `public.user_uploads`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `user_id` | uuid | NOT NULL, FK to `auth.users(id)` ON DELETE CASCADE |
| `title` | text | NOT NULL, default `'Untitled'` |
| `artist` | text | Optional creator/display name |
| `original_filename` | text | Optional original file name |
| `mime_type` | text | Optional e.g. `audio/mpeg` |
| `duration_ms` | integer | Optional |
| `artwork_url` | text | Optional image URL |
| `storage_url` | text | NOT NULL — object path or playable URL |
| `created_at` | timestamptz | NOT NULL, default `now()` |
| `updated_at` | timestamptz | NOT NULL, default `now()` |

**Indexes:** `user_id`, `created_at DESC`.

**RLS:** Enabled. Policies: SELECT / INSERT / UPDATE / DELETE only where `auth.uid() = user_id`. No service role; user JWT only.

**Normalized view (for Residency+ / Labs):** Each row maps to: `id`, `title`, `artist`, `url`/`openUrl`/`playableUrl` = `storage_url`, `artworkUrl` = `artwork_url`, `sourceId: "uploads"`, `sourceLabel: "User Uploads"`, `playbackType: "html5_audio"`, `durationMs` = `duration_ms`.

---

## 3. Auth / ownership model

- **List and get:** Require `Authorization: Bearer <Supabase JWT>`. Server uses JWT to call Supabase; RLS restricts rows to `user_id = auth.uid()`. No user_id in query params from client.
- **Register (stub):** Same. `user_id` in the inserted row is set **server-side** from `getJwtUser(req).uid`. Client must not send `user_id`.
- **Secrets:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` (if used) are server-side only. Never expose storage internals or service keys to the client.

---

## 4. Env vars needed

| Variable | Purpose |
|----------|---------|
| `AUTH_ENABLED` | If not `true`, uploads endpoints return empty/401. |
| `SUPABASE_URL` | Supabase project URL (REST API). |
| `SUPABASE_ANON_KEY` | Supabase anon key for REST. |
| (Optional) `LABS_ENABLE_UPLOADS` | For Labs adapter `labs-search-uploads` to return data; still requires `AUTH_ENABLED`. |

No new env vars beyond existing Supabase + auth stack.

---

## 5. Backend endpoints (hidden / not in production UI)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/.netlify/functions/uploads-list` | GET | List current user’s uploads. Query: `limit` (default 50, max 100). Returns `{ items: [...] }`. |
| `/.netlify/functions/uploads-get` | GET | Get one upload by `id`. Query: `id=<uuid>`. Returns single row or 404. Ownership enforced by RLS. |
| `/.netlify/functions/uploads-register` | POST | Stub: register metadata. Body: `title`, `artist`, `storage_url` (required), `original_filename`, `mime_type`, `duration_ms`, `artwork_url`. `user_id` set server-side. |

All require valid Supabase JWT. Not wired into production discovery or player.

---

## 6. Labs compatibility

- **Labs adapter** `labs-search-uploads` reads from `user_uploads` via Supabase REST with the user’s JWT and selects `id, title, artist, duration_ms, storage_url, artwork_url`. It normalizes to the PlaybackContract (sourceId `uploads`, playbackType `html5_audio`, playableUrl = storage_url). No change to production player or discovery behavior.

---

## 7. Rollout notes

- Run migration `supabase/migrations/20250316000000_create_user_uploads.sql` against the Supabase project (e.g. `supabase db push` or run in SQL editor).
- Deploy Netlify functions; no frontend or production discovery changes.
- When adding real file upload: implement upload-to-Storage, then call `uploads-register` with the resulting `storage_url` (and optional signed URL for playback).

---

## 8. Rollback notes

- **Disable endpoints:** Do not call `uploads-list` / `uploads-get` / `uploads-register` from the client; they are backend-only. To “hide” them, remove or restrict routing if needed.
- **Table:** Do not drop the table on rollback if data may be needed; RLS keeps data isolated per user. To fully remove, drop RLS policies then drop table.
- **Labs:** Keep `LABS_ENABLE_UPLOADS` unset or false to avoid Labs adapter returning uploads.

---

## 9. Production SoundCloud path

- **Untouched:** scSearch, scResolve, doShuffle, ensureMinPool, quickFill, getFilteredLibrary, pickAndPlay, loadItem, SC.Widget, main player shell, History, Saved, Crates, Account/billing/auth, topbar. This spike does not modify any of these.

---

## 10. Smoke test checklist

- **Migration:** Run `20250316000000_create_user_uploads.sql` in Supabase; table `user_uploads` exists; RLS enabled; policies allow only own rows.
- **uploads-list:** GET with valid JWT returns `{ items: [] }` or items for that user only. Without JWT returns 401. Different user’s JWT does not see other’s rows (RLS).
- **uploads-get:** GET `?id=<uuid>` with valid JWT returns row only if owned; otherwise 404. Invalid id returns 400.
- **uploads-register:** POST with valid JWT and `storage_url` returns 202; row appears in uploads-list for that user. Client cannot set `user_id`.
- **Labs:** With `LABS_ENABLE_UPLOADS=true` and `AUTH_ENABLED=true`, Labs adapter returns normalized collection from `user_uploads`; no production UI or player change.
- **Production:** No new UI; no change to SoundCloud discovery, shuffle, or player.
