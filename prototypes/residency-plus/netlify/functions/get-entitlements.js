/**
 * get-entitlements.js — Returns current user's plan + entitlement limits.
 *
 * This is a thin wrapper over the entitlements-lib mapping and Supabase
 * `public.users.plan` column. When AUTH_ENABLED is false or Supabase is
 * unavailable, it safely falls back to free-tier entitlements.
 */

const { allowOrigin, json, logTelemetry } = require("./lib/sc-auth-lib.js");
const { getJwtUser, supabaseRestCall } = require("./lib/sc-supabase-cjs.js");
const { getEntitlementsForPlan } = require("./lib/entitlements-lib.js");

const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";

function buildReqFromEvent(event) {
  const headers = event.headers || {};
  return {
    headers: {
      get: (name) => {
        const k = Object.keys(headers).find(x => x.toLowerCase() === name.toLowerCase());
        return k ? headers[k] : null;
      }
    }
  };
}

exports.handler = async function (event) {
  const method = event.httpMethod;
  const headers = event.headers || {};
  const origin = headers.origin || headers.Origin || "";
  const allowed = allowOrigin(origin) || null;

  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "access-control-allow-origin": allowed || "*",
        "access-control-allow-headers": "content-type, authorization",
        "access-control-allow-methods": "GET,OPTIONS",
        vary: "Origin"
      }
    };
  }

  if (method !== "GET") {
    return json(405, { error: "Method not allowed" }, allowed || "*");
  }

  if (!allowed && origin) {
    return json(403, { error: "Origin not permitted." }, "*");
  }

  try {
    if (!AUTH_ENABLED) {
      const ent = getEntitlementsForPlan("free");
      logTelemetry("entitlements_fetched", { endpoint: "get-entitlements", origin, plan: ent.plan, authenticated: false, auth_enabled: false });
      return json(200, { auth_enabled: false, plan: ent.plan, entitlements: ent }, allowed || "*");
    }

    const user = getJwtUser(buildReqFromEvent(event));
    if (!user) {
      const ent = getEntitlementsForPlan("free");
      logTelemetry("entitlements_fetched", { endpoint: "get-entitlements", origin, plan: ent.plan, authenticated: false, auth_enabled: true });
      return json(200, { authenticated: false, plan: ent.plan, entitlements: ent }, allowed || "*");
    }

    let plan = "free";
    try {
      const data = await supabaseRestCall(`users?id=eq.${user.uid}&select=plan`, "GET", null, user.token);
      if (data && data.length > 0 && data[0].plan) {
        plan = data[0].plan;
      }
    } catch {
      // default to free if lookup fails
    }

    const ent = getEntitlementsForPlan(plan);
    logTelemetry("entitlements_fetched", { endpoint: "get-entitlements", origin, plan: ent.plan, authenticated: true, auth_enabled: true });
    return json(200, {
      authenticated: true,
      plan: ent.plan,
      entitlements: ent,
    }, allowed || "*");
  } catch (err) {
    logTelemetry("entitlements_error", { endpoint: "get-entitlements", origin, error: err.message });
    return json(500, { error: err.message }, allowed || "*");
  }
};
