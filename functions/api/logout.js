
import {
  clearSessionCookie
} from "../lib/session.js";

const COOKIE_NAME = "__Host-sk_session";

function getCookieToken(request) {
  const cookieHeader = request.headers.get("Cookie") || "";

  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");

    if (separator === -1) continue;

    if (cookie.slice(0, separator).trim() === COOKIE_NAME) {
      return cookie.slice(separator + 1).trim();
    }
  }

  return null;
}

async function hashToken(token) {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function onRequestPost({ request, env }) {
  try {
    const token = getCookieToken(request);

    if (token && token.length <= 100) {
      const tokenHash = await hashToken(token);

      await env.DB.prepare(
        "DELETE FROM admin_sessions WHERE token_hash = ?"
      )
        .bind(tokenHash)
        .run();
    }

    return Response.json(
      {
        success: true,
        message: "Logged out successfully."
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "Set-Cookie": clearSessionCookie()
        }
      }
    );
  } catch (error) {
    console.error("Logout failed:", error);

    return Response.json(
      {
        success: false,
        message: "Unable to log out right now."
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }
}
