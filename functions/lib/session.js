
const COOKIE_NAME = "__Host-sk_session";

async function hashToken(token) {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getSessionToken(request) {
  const cookieHeader = request.headers.get("Cookie") || "";

  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const name = cookie.slice(0, separator).trim();
    const value = cookie.slice(separator + 1).trim();

    if (name === COOKIE_NAME) {
      return value || null;
    }
  }

  return null;
}

export async function getAuthenticatedAdmin(request, env) {
  const token = getSessionToken(request);

  if (!token || token.length > 100) {
    return null;
  }

  const tokenHash = await hashToken(token);
  const now = Math.floor(Date.now() / 1000);

  const admin = await env.DB.prepare(
    `SELECT
       admins.id,
       admins.username,
       admins.display_name,
       admins.role
     FROM admin_sessions
     INNER JOIN admins
       ON admins.id = admin_sessions.admin_id
     WHERE admin_sessions.token_hash = ?
       AND admin_sessions.expires_at > ?
       AND admins.is_active = 1
     LIMIT 1`
  )
    .bind(tokenHash, now)
    .first();

  return admin || null;
}

export function clearSessionCookie() {
  return [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Max-Age=0"
  ].join("; ");
}
