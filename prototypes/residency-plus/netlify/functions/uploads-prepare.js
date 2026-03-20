const crypto = require("crypto");
const { allowOrigin, json } = require("./lib/sc-auth-lib.js");
const { getJwtUser } = require("./lib/sc-supabase-cjs.js");

function sanitizeFilename(name) {
  return String(name || "")
    .trim()
    .replace(/[^\w.\-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

exports.handler = async function (event) {
  const headers = event.headers || {};
  const origin = headers.origin || headers.Origin || "";

  if (event.httpMethod === "OPTIONS") {
    const allowed = allowOrigin(origin) || "*";
    return {
      statusCode: 204,
      headers: {
        "access-control-allow-origin": allowed,
        "access-control-allow-headers": "content-type, authorization",
        "access-control-allow-methods": "POST, OPTIONS",
        vary: "Origin"
      }
    };
  }

  if (event.httpMethod !== "POST") {
    return json(
      405,
      { error: "method_not_allowed", message: "Use POST." },
      allowOrigin(origin) || "*"
    );
  }

  try {
    const user = await getJwtUser(event);
    if (!user || !user.id) {
      return json(
        401,
        { error: "unauthorized", message: "Sign in required." },
        allowOrigin(origin) || "*"
      );
    }

    const body = JSON.parse(event.body || "{}");
    const filename = sanitizeFilename(body.filename);
    if (!filename) {
      return json(
        400,
        { error: "invalid_filename", message: "Filename is required." },
        allowOrigin(origin) || "*"
      );
    }

    const uploadId = crypto.randomUUID();
    const path = `${user.id}/${uploadId}/${filename}`;

    console.log("[uploads-prepare] ok", {
      uid: user.id,
      filename,
      path
    });

    return json(
      200,
      {
        uploadId,
        path,
        bucket: "uploads"
      },
      allowOrigin(origin) || "*"
    );
  } catch (err) {
    console.error("[uploads-prepare] fatal", err);
    return json(
      500,
      {
        error: "prepare_failed",
        message: err && err.message ? err.message : "Unknown prepare error"
      },
      allowOrigin(origin) || "*"
    );
  }
};
