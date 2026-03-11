/**
 * sync-crate.js — Cloud continuity for the saved crate.
 * Synchronizes the local crate state to the Supabase database.
 * Method: POST
 * Body: { tracks: [...] }
 */
import { allowOrigin, json } from "./sc-auth-lib.js";
import { getJwtUser, supabaseRestCall } from "./sc-supabase-lib.js";

export default async function handler(req) {
    if (req.method === "OPTIONS") {
        const origin = allowOrigin(req.headers.get("origin"));
        return new Response("", { status: 204, headers: { "access-control-allow-origin": origin || "*", "access-control-allow-headers": "content-type, authorization", "access-control-allow-methods": "POST,OPTIONS" } });
    }

    const origin = allowOrigin(req.headers.get("origin"));
    if (!origin && req.headers.get("origin")) return json(403, { error: "Origin not permitted." });
<<<<<<< HEAD
    if (req.method !== "POST") return json(405, { error: "Method not allowed" }, origin);
=======
    if (req.method !== "POST" && req.method !== "GET") return json(405, { error: "Method not allowed" }, origin);
>>>>>>> main

    try {
        const user = getJwtUser(req);
        if (!user) return json(401, { error: "Missing or invalid token" }, origin);

<<<<<<< HEAD
=======
        if (req.method === "GET") {
            const data = await supabaseRestCall(`crate?select=soundcloud_url,title,artist,bucket,kind,duration_ms,saved_at&order=saved_at.desc`, "GET", null, user.token);
            if (!data) return json(200, { hasData: false, items: [] }, origin);

            // Map back to local state keys
            const mapped = data.map(r => ({
                url: r.soundcloud_url,
                title: r.title,
                artist: r.artist,
                bucket: r.bucket,
                kind: r.kind,
                durationMs: r.duration_ms,
                savedAt: r.saved_at
            }));
            return json(200, { hasData: mapped.length > 0, items: mapped }, origin);
        }

>>>>>>> main
        const body = await req.json();
        const tracks = body.tracks || [];
        if (!Array.isArray(tracks)) return json(400, { error: "Invalid payload format" }, origin);

        // For slice 2, we just enforce a hard limit of 50 for all users for safety.
        // Slice 5 will dynamically gate this based on plan.
        const SLICE_2_LIMIT = 50;

        const payload = tracks.slice(0, SLICE_2_LIMIT).map(t => ({
            user_id: user.uid,
            soundcloud_url: t.url,
            title: t.title,
            artist: t.artist,
            bucket: t.bucket,
            kind: t.kind,
            duration_ms: t.durationMs,
            saved_at: t.savedAt || new Date().toISOString()
        }));

        if (payload.length > 0) {
            // Upsert on conflict by (user_id, soundcloud_url)
            await supabaseRestCall(`crate?on_conflict=user_id,soundcloud_url`, "POST", payload, user.token);
        }

        // Return a representation of the server's truth (just counts for now)
        const serverData = await supabaseRestCall(`crate?select=id,soundcloud_url,saved_at`, "GET", null, user.token);

        return json(200, {
            synced: payload.length,
            total_cloud: serverData ? serverData.length : 0
        }, origin);

    } catch (err) {
        return json(500, { error: err.message }, origin);
    }
}
