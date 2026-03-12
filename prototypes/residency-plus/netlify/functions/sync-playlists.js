/**
 * sync-playlists.js — Cloud continuity for playlists.
 * Synchronizes local playlists state to the Supabase database.
 * Method: POST
 * Body: { playlists: [{id, name, updated_at, items: [...]}] }
 */
import { allowOrigin, json } from "./lib/sc-auth-lib.js";
import { getJwtUser, supabaseRestCall } from "./sc-supabase-lib.js";

const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";

export default async function handler(req) {
    if (req.method === "OPTIONS") {
        const origin = allowOrigin(req.headers.get("origin"));
        return new Response("", { status: 204, headers: { "access-control-allow-origin": origin || "*", "access-control-allow-headers": "content-type, authorization", "access-control-allow-methods": "GET,POST,OPTIONS" } });
    }

    const origin = allowOrigin(req.headers.get("origin"));
    if (!AUTH_ENABLED) return json(200, { auth_enabled: false }, origin);
    if (!origin && req.headers.get("origin")) return json(403, { error: "Origin not permitted." });
    if (req.method !== "POST" && req.method !== "GET") return json(405, { error: "Method not allowed" }, origin);

    try {
        const user = getJwtUser(req);
        if (!user) return json(401, { error: "Missing or invalid token" }, origin);

        if (req.method === "GET") {
            const pls = await supabaseRestCall(`playlists?select=id,name,updated_at&order=updated_at.desc`, "GET", null, user.token);
            if (!pls || pls.length === 0) return json(200, { hasData: false, playlists: [] }, origin);

            const pItems = await supabaseRestCall(`playlist_items?select=playlist_id,soundcloud_url,title,artist,bucket,kind,duration_ms,added_at&order=added_at.asc`, "GET", null, user.token);
            const itemsByPl = {};
            if (pItems) {
                for (const t of pItems) {
                    if (!itemsByPl[t.playlist_id]) itemsByPl[t.playlist_id] = [];
                    itemsByPl[t.playlist_id].push({
                        url: t.soundcloud_url,
                        title: t.title,
                        artist: t.artist,
                        bucket: t.bucket,
                        kind: t.kind,
                        durationMs: t.duration_ms,
                        addedAt: t.added_at
                    });
                }
            }

            const mapped = pls.map(p => ({
                id: p.id,
                name: p.name,
                updated_at: p.updated_at,
                items: itemsByPl[p.id] || []
            }));
            return json(200, { hasData: true, playlists: mapped }, origin);
        }

        const body = await req.json();
        const playlists = body.playlists || [];
        if (!Array.isArray(playlists)) return json(400, { error: "Invalid payload format" }, origin);

        // Safe limits for Slice 3
        const SLICE_3_MAX_PLAYLISTS = 10;
        const SLICE_3_MAX_ITEMS = 50;

        const localPlaylists = playlists.slice(0, SLICE_3_MAX_PLAYLISTS);

        // In a real bidirectional sync, we'd fetch cloud state and merge.
        // For local-first "push to cloud" (Slice 3), we will upsert the playlists, 
        // clear their items, and re-insert the items. This is inefficient at scale but 
        // perfectly safe for 10 playlists of 50 items each, and keeps the code minimal.

        let syncedCount = 0;

        for (const pl of localPlaylists) {
            // 1. Upsert Playlist Record
            const plPayload = {
                id: pl.id,
                user_id: user.uid,
                name: pl.name,
                updated_at: pl.updated_at || new Date().toISOString()
            };

            await supabaseRestCall(`playlists?on_conflict=id`, "POST", plPayload, user.token);

            // 2. Clear existing playlist items in db (RLS protects other users' items)
            await supabaseRestCall(`playlist_items?playlist_id=eq.${pl.id}`, "DELETE", null, user.token);

            // 3. Insert new items
            const items = Array.isArray(pl.items) ? pl.items : [];
            const itemsPayload = items.slice(0, SLICE_3_MAX_ITEMS).map(t => ({
                playlist_id: pl.id,
                user_id: user.uid,
                soundcloud_url: t.url,
                title: t.title,
                artist: t.artist,
                bucket: t.bucket,
                kind: t.kind,
                duration_ms: t.durationMs,
                added_at: t.addedAt || new Date().toISOString()
            }));

            if (itemsPayload.length > 0) {
                await supabaseRestCall(`playlist_items`, "POST", itemsPayload, user.token);
            }

            syncedCount++;
        }

        // We can also fetch deleted IDs from client if client tracks deletions, 
        // but for now, we'll assume the client pushes the full active set and we just
        // rely on the user manually deleting from DB if they care, or we can just upsert.
        // To handle full local truth -> cloud truth sync (including deletes):
        // Pull all user playlist IDs from cloud. If cloud has IDs not in the local set, delete them.

        const cloudPlaylists = await supabaseRestCall(`playlists?select=id`, "GET", null, user.token) || [];
        const localIds = new Set(localPlaylists.map(p => p.id));

        for (const cloudPl of cloudPlaylists) {
            if (!localIds.has(cloudPl.id)) {
                // Delete from cloud
                await supabaseRestCall(`playlists?id=eq.${cloudPl.id}`, "DELETE", null, user.token);
            }
        }

        return json(200, {
            synced: syncedCount,
        }, origin);

    } catch (err) {
        return json(500, { error: err.message }, origin);
    }
}
