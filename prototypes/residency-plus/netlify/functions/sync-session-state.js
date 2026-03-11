/**
 * sync-session-state.js — Cloud continuity for session state.
 * Method: POST
 * Body: { genre, source, dig_range, station_id }
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
            const data = await supabaseRestCall(`session_state?select=genre,source,dig_range,station_id&limit=1`, "GET", null, user.token);
            if (!data || data.length === 0) return json(200, { hasData: false, state: null }, origin);
            return json(200, { hasData: true, state: data[0] }, origin);
        }

>>>>>>> main
        const body = await req.json();

        const payload = {
            user_id: user.uid,
            genre: body.genre,
            source: body.source,
            dig_range: body.dig_range,
            station_id: body.station_id,
            updated_at: new Date().toISOString(),
            // Special flag handled by our supabaseRestCall helper to properly format the REST request
            _upsert: true
        };

        // Note: the helper strips _upsert and adds Prefer: return=representation,resolution=merge-duplicates
        await supabaseRestCall(`session_state?on_conflict=user_id`, "POST", payload, user.token);

        return json(200, { synced: true }, origin);

    } catch (err) {
        return json(500, { error: err.message }, origin);
    }
}
