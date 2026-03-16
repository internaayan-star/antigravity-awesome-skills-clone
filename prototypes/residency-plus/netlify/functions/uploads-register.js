/**
 * uploads-register.js — Stub: register upload metadata (e.g. after file is in storage).
 * Backend-only; not wired to production UI. Caller must set user_id from JWT; we do not trust client.
 * Ownership: INSERT with user_id from auth only; RLS enforces.
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
        "access-control-allow-methods": "POST,OPTIONS",
      },
    });
  }

  const origin = allowOrigin(req.headers.get("origin"));
  if (!origin && req.headers.get("origin")) return json(403, { error: "Origin not permitted." }, origin);
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, origin);

  if (!AUTH_ENABLED) {
    return json(401, { error: "Auth disabled" }, origin);
  }

  const user = getJwtUser(req);
  if (!user) {
    return json(401, { error: "Missing or invalid token" }, origin);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" }, origin);
  }

  const title = typeof body.title === "string" ? body.title.trim() || "Untitled" : "Untitled";
  const artist = typeof body.artist === "string" ? body.artist.trim() : "";
  const storage_url = typeof body.storage_url === "string" ? body.storage_url.trim() : null;
  if (!storage_url) {
    return json(400, { error: "storage_url required" }, origin);
  }

  const payload = {
    user_id: user.uid,
    title,
    artist,
    storage_url,
    original_filename: typeof body.original_filename === "string" ? body.original_filename.trim() : null,
    mime_type: typeof body.mime_type === "string" ? body.mime_type.trim() : null,
    duration_ms: typeof body.duration_ms === "number" && Number.isFinite(body.duration_ms) ? body.duration_ms : null,
    artwork_url: typeof body.artwork_url === "string" ? body.artwork_url.trim() : null,
  };

  try {
    await supabaseRestCall("user_uploads", "POST", payload, user.token);
    return json(202, { ok: true, message: "Registered (stub); use list to fetch created row" }, origin);
  } catch (e) {
    console.error("[uploads-register] error", e?.message);
    return json(500, { error: "Server error" }, origin);
  }
}
