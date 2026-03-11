/**
 * sync-history.js — Cloud continuity for playback history.
 * Method: POST
 * Body: { tracks: [...] }
 */
import { allowOrigin, json } from "./sc-auth-lib.js";
import { getJwtUser, supabaseRestCall } from "./sc-supabase-lib.js";

export default async function handler(req) {
    if (req.method === "OPTIONS") {
        const origin = allowOrigin(req.headers.get("origin"));
<<<<<<< HEAD
        return new Response("", { status: 204, headers: { "access-control-allow-origin": origin || "*", "access-control-allow-headers": "content-type, authorization", "access-control-allow-methods": "POST,OPTIONS" } });
=======
        return new Response("", { status: 204, headers: { "access-control-allow-origin": origin || "*", "access-control-allow-headers": "content-type, authorization", "access-control-allow-methods": "GET,POST,OPTIONS" } });
>>>>>>> main
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
            const data = await supabaseRestCall(`history?select=soundcloud_url,title,artist,bucket,played_at&order=played_at.desc&limit=50`, "GET", null, user.token);
            if (!data) return json(200, { hasData: false, items: [] }, origin);

            const mapped = data.map(r => ({
                url: r.soundcloud_url,
                title: r.title,
                artist: r.artist,
                bucket: r.bucket,
                playedAt: r.played_at
            }));
            return json(200, { hasData: mapped.length > 0, items: mapped }, origin);
        }

>>>>>>> main
        const body = await req.json();
        const tracks = body.tracks || [];
        if (!Array.isArray(tracks)) return json(400, { error: "Invalid payload format" }, origin);

        // Limit payload size to prevent abuse
        const SLICE_2_LIMIT = 50;

        const payload = tracks.slice(0, SLICE_2_LIMIT).map(t => ({
            user_id: user.uid,
            soundcloud_url: t.url,
            title: t.title,
            artist: t.artist,
            bucket: t.bucket,
            played_at: t.playedAt || new Date().toISOString()
        }));

        if (payload.length > 0) {
            // Append only. Deduplication handles naturally by UI
            await supabaseRestCall(`history`, "POST", payload, user.token);
        }

        return json(200, { synced: payload.length }, origin);

    } catch (err) {
        return json(500, { error: err.message }, origin);
    }
}
