import { hashPassword, verifyPassword } from "../lib/password.js";
import { logActivity } from "../lib/activity.js";
import {
  LOCKED_MESSAGE,
  MAX_PER_PAIR,
  WINDOW_MINUTES,
  cleanKey,
  clearFailures,
  connectionCode,
  isLocked,
  recordFailure
} from "../lib/login-guard.js";

const SESSION_DURATION_SECONDS = 8 * 60 * 60;
const COOKIE_NAME = "__Host-sk_session";

function bytesToBase64Url(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function hashToken(token) {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function jsonResponse(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

// A real-looking hash to check against when the username does not exist, so
// an unknown username takes as long to answer as a wrong password.
let dummyHash = null;

function getDummyHash() {
  if (!dummyHash) dummyHash = hashPassword("dummy-password-for-timing");
  return dummyHash;
}

export async function onRequestPost({ request, env }) {
  try {
    const contentType = request.headers.get("Content-Type") || "";

    if (!contentType.toLowerCase().includes("application/json")) {
      return jsonResponse(
        { success: false, message: "Invalid request." },
        415
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        { success: false, message: "Invalid request." },
        400
      );
    }

    const username =
      typeof body?.username === "string"
        ? body.username.trim()
        : "";

    const password =
      typeof body?.password === "string"
        ? body.password
        : "";

    if (
      username.length < 1 ||
      username.length > 100 ||
      password.length < 1 ||
      password.length > 1024
    ) {
      return jsonResponse(
        { success: false, message: "Invalid username or password." },
        400
      );
    }

    // Too many wrong passwords recently? Do not even check this one.
    const key = cleanKey(username);
    const code = await connectionCode(request, env);

    if (await isLocked(env, key, code)) {
      return jsonResponse(
        { success: false, message: LOCKED_MESSAGE },
        429,
        { "Retry-After": String(WINDOW_MINUTES * 60) }
      );
    }

    // Capital letters do not matter in the username (phones add them).
    const admin = await env.DB.prepare(
      `SELECT id, username, display_name, password_hash, role, is_active,
              must_change_password
       FROM admins
       WHERE lower(username) = ?
       LIMIT 1`
    )
      .bind(key)
      .first();

    const passwordIsRight = await verifyPassword(
      password,
      admin ? admin.password_hash : await getDummyHash()
    );

    if (!admin || admin.is_active !== 1 || !passwordIsRight) {
      const failures = await recordFailure(env, key, code);

      // Known accounts get the attempt written in Recent Activity.
      if (admin) {
        const locked = failures >= MAX_PER_PAIR;

        await logActivity(
          env,
          admin,
          locked ? "login_locked" : "login_failed",
          null,
          admin.is_active !== 1
            ? "Tried to log in to a deactivated account"
            : locked
              ? `Locked for about ${WINDOW_MINUTES} minutes after ${MAX_PER_PAIR} wrong passwords`
              : `Wrong password (attempt ${failures} of ${MAX_PER_PAIR})`
        );
      }

      return jsonResponse(
        { success: false, message: "Invalid username or password." },
        401
      );
    }

    // Generate a fresh, unpredictable session token.
    const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const token = bytesToBase64Url(tokenBytes);
    const tokenHash = await hashToken(token);

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + SESSION_DURATION_SECONDS;

    // Remove expired sessions before creating the new one.
    await env.DB.prepare(
      "DELETE FROM admin_sessions WHERE expires_at <= ?"
    )
      .bind(now)
      .run();

    await env.DB.prepare(
      `INSERT INTO admin_sessions (admin_id, token_hash, expires_at)
       VALUES (?, ?, ?)`
    )
      .bind(admin.id, tokenHash, expiresAt)
      .run();

    await clearFailures(env, key, code);
    await logActivity(env, admin, "login", null, "");

    const cookie = [
      `${COOKIE_NAME}=${token}`,
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=Strict",
      `Max-Age=${SESSION_DURATION_SECONDS}`
    ].join("; ");

    return jsonResponse(
      {
        success: true,
        message: "Login successful.",
        admin: {
          id: admin.id,
          username: admin.username,
          displayName: admin.display_name,
          role: admin.role
        }
      },
      200,
      { "Set-Cookie": cookie }
    );
  } catch (error) {
    console.error("Login request failed:", error);

    return jsonResponse(
      {
        success: false,
        message: "Unable to process login right now."
      },
      500
    );
  }
}
