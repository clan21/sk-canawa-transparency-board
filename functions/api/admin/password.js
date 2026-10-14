import { json, readJson, requireAdmin } from "../../lib/api.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { logActivity } from "../../lib/activity.js";
import { clearSessionCookie } from "../../lib/session.js";
import {
  LOCKED_MESSAGE,
  clearFailures,
  connectionCode,
  isLocked,
  recordFailure
} from "../../lib/login-guard.js";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  accountLabel
} from "../../lib/accounts.js";

// Any logged-in admin: change your own password.
// Every session is ended afterwards, so you log in again with the new one.
// Wrong-password answers use status 400 (not 401) so the dashboard does not
// mistake them for an expired session.
export async function onRequestPost({ request, env }) {
  try {
    // Allowed even when the member must still choose a password: this is
    // the very place where they do it.
    const auth = await requireAdmin(request, env, {
      allowPasswordChange: true
    });
    if (auth.response) return auth.response;

    const body = await readJson(request);
    const current =
      body && typeof body.current_password === "string" ? body.current_password : "";
    const next =
      body && typeof body.new_password === "string" ? body.new_password : "";

    if (!current || current.length > MAX_PASSWORD_LENGTH) {
      return json(
        { success: false, message: "Please enter your current password." },
        400
      );
    }

    if (next.length < MIN_PASSWORD_LENGTH || next.length > MAX_PASSWORD_LENGTH) {
      return json(
        {
          success: false,
          message: `The new password must be at least ${MIN_PASSWORD_LENGTH} characters.`
        },
        400
      );
    }

    if (next === current) {
      return json(
        {
          success: false,
          message: "The new password must be different from the current one."
        },
        400
      );
    }

    const row = await env.DB.prepare(
      "SELECT password_hash FROM admins WHERE id = ? LIMIT 1"
    )
      .bind(auth.admin.id)
      .first();

    // Someone holding a stolen session must not be able to guess the current
    // password forever, so wrong guesses here lock too.
    const key = `change:${auth.admin.id}`;
    const code = await connectionCode(request, env);

    if (await isLocked(env, key, code)) {
      return json({ success: false, message: LOCKED_MESSAGE }, 429);
    }

    if (!row || !(await verifyPassword(current, row.password_hash))) {
      await recordFailure(env, key, code);

      return json(
        { success: false, message: "Your current password is incorrect." },
        400
      );
    }

    await clearFailures(env, key, code);

    const passwordHash = await hashPassword(next);

    await env.DB.batch([
      env.DB.prepare(
        "UPDATE admins SET password_hash = ?, must_change_password = 0 WHERE id = ?"
      ).bind(
        passwordHash,
        auth.admin.id
      ),
      env.DB.prepare("DELETE FROM admin_sessions WHERE admin_id = ?").bind(
        auth.admin.id
      )
    ]);

    await logActivity(
      env,
      auth.admin,
      "password_change",
      null,
      accountLabel({
        display_name: auth.admin.display_name,
        username: auth.admin.username
      })
    );

    return json(
      { success: true, message: "Password changed. Please log in again." },
      200,
      { "Set-Cookie": clearSessionCookie() }
    );
  } catch (error) {
    console.error("Changing password failed:", error);
    return json({ success: false, message: "Unable to change the password." }, 500);
  }
}
