/**
 * auth-session.js — Validates a given JWT and returns limited user info.
 * This ensures the client knows if their token is still valid on our backend.
 */
import { allowOrigin, json } from "./lib/sc-auth-lib.js";
import { getJwtUser, supabaseRestCall } from "./sc-supabase-lib.js";

const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";

export default async function handler(req) {
    if (!AUTH_ENABLED) {
        const origin = allowOrigin(req.headers.get("origin"));
        return json(200, { auth_enabled: false }, origin);
    }
    if (req.method === "OPTIONS") {
        const origin = allowOrigin(req.headers.get("origin"));
        return new Response("", { status: 204, headers: { "access-control-allow-origin": origin || "*", "access-control-allow-headers": "content-type, authorization", "access-control-allow-methods": "GET,OPTIONS" } });
    }

    const origin = allowOrigin(req.headers.get("origin"));
    if (!origin && req.headers.get("origin")) return json(403, { error: "Origin not permitted." });

    try {
        const user = getJwtUser(req);
        if (!user) return json(401, { error: "Missing or invalid token" }, origin);

        // Fetch user profile from public.users to get plan limits if we wanted
        // For slice 2, just verify the JWT is alive.
        let profile = { plan: "free" };
        try {
            const data = await supabaseRestCall(`users?id=eq.${user.uid}&select=plan`, "GET", null, user.token);
            if (data && data.length > 0) profile = data[0];
        } catch (e) {
            // It's possible the trigger hasn't fired yet or RLS blocked. Safe default.
        }

        return json(200, {
            authenticated: true,
            uid: user.uid,
            email: user.email,
            plan: profile.plan
        }, origin);

    } catch (err) {
        return json(500, { error: err.message }, origin);
    }
}
