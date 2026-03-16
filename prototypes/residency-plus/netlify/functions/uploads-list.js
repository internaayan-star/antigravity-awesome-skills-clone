/**
 * uploads-list.js — List upload metadata for the current signed-in user.
 * Backend-only; not wired to production UI. Used by Labs or future uploads UX.
 * Ownership: RLS + JWT; user sees only their own rows.
 */
import { allowOrigin, json } from "./lib/sc-auth-lib.js";
import { getJwtUser, supabaseRestCall } from "./sc-supabase-lib.js";

const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    const origin = allowOrigin(req.headers.get("origin"));
    return new Response("", {
      status: 204,
      headers: {
        "access-control-allow-origin": origin || "*",
        "access-control-allow-headers": "content-type, authorization",
        "access-control-allow-methods": "GET,OPTIONS",
      },
    });
  }

  const origin = allowOrigin(req.headers.get("origin"));
  if (!origin && req.headers.get("origin")) return json(403, { error: "Origin not permitted." }, origin);
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, origin);

  if (!AUTH_ENABLED) {
    return json(200, { items: [] }, origin);
  }

  const user = getJwtUser(req);
  if (!user) {
    return json(401, { error: "Missing or invalid token" }, origin);
  }

  const limit = Math.min(100, Math.max(1, parseInt(new URL(req.url || "").searchParams.get("limit") || "50", 10) || 50));
  const path = `user_uploads?user_id=eq.${user.uid}&select=id,user_id,title,artist,original_filename,mime_type,duration_ms,artwork_url,storage_url,created_at,updated_at&order=created_at.desc&limit=${limit}`;

  try {
    const data = await supabaseRestCall(path, "GET", null, user.token);
    const items = Array.isArray(data) ? data : [];
    return json(200, { items }, origin);
  } catch (e) {
    console.error("[uploads-list] error", e?.message);
    return json(200, { items: [] }, origin);
  }
}
