// Temporary lockout after repeated wrong passwords.
//
// Three limits inside a 15 minute window:
//   - 5 failures for the same username from the same connection
//   - 20 failures from one connection (guessing many usernames)
//   - 30 failures for one username from anywhere (spread-out guessing)
// While locked, the password is not even checked, so a correct guess cannot
// slip through. The same rules apply to unknown usernames, so nobody can tell
// from the lock which usernames exist.

export const WINDOW_MINUTES = 15;
export const MAX_PER_PAIR = 5;
export const MAX_PER_IP = 20;
export const MAX_PER_USER = 30;

export const LOCKED_MESSAGE =
  "Too many failed attempts. Please wait about 15 minutes and try again.";

// Same username in different capitals is the same account.
export function cleanKey(username) {
  return String(username ?? "").trim().toLowerCase().slice(0, 100);
}

// A scrambled code for the visitor's connection (never the real address).
export async function connectionCode(request, env) {
  const ip = request.headers.get("CF-Connecting-IP");

  if (!ip) return "";

  const data = new TextEncoder().encode(`login|${ip}|${env.LOGIN_SALT || "sk-canawa"}`);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function isLocked(env, key, code) {
  const row = await env.DB.prepare(
    `SELECT
       COALESCE(SUM(username = ?1 AND ip_hash = ?2), 0) AS pair,
       COALESCE(SUM(ip_hash = ?2), 0) AS by_ip,
       COALESCE(SUM(username = ?1), 0) AS by_user
     FROM login_failures
     WHERE created_at >= datetime('now', '-${WINDOW_MINUTES} minutes')`
  )
    .bind(key, code)
    .first();

  if (!row) return false;

  return (
    row.pair >= MAX_PER_PAIR ||
    row.by_ip >= MAX_PER_IP ||
    row.by_user >= MAX_PER_USER
  );
}

// Saves one failure and returns how many the same username + connection has.
export async function recordFailure(env, key, code) {
  await env.DB.prepare(
    "INSERT INTO login_failures (username, ip_hash) VALUES (?, ?)"
  )
    .bind(key, code)
    .run();

  // Keep the table small.
  await env.DB.prepare(
    "DELETE FROM login_failures WHERE created_at < datetime('now', '-1 day')"
  ).run();

  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS total FROM login_failures
     WHERE username = ? AND ip_hash = ?
       AND created_at >= datetime('now', '-${WINDOW_MINUTES} minutes')`
  )
    .bind(key, code)
    .first();

  return row ? row.total : 1;
}

export async function clearFailures(env, key, code) {
  await env.DB.prepare(
    "DELETE FROM login_failures WHERE username = ? AND ip_hash = ?"
  )
    .bind(key, code)
    .run();
}
