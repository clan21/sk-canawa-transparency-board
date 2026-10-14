import { json, readJson, requireSuperadmin } from "../../../lib/api.js";
import { hashPassword } from "../../../lib/password.js";
import { logActivity } from "../../../lib/activity.js";
import {
  DISPLAY_NAME_PATTERN,
  USERNAME_PATTERN,
  accountLabel,
  chooseNewPassword,
  publicAccount
} from "../../../lib/accounts.js";

// Superadmin only: list every account (never includes password hashes).
export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireSuperadmin(request, env);
    if (auth.response) return auth.response;

    const result = await env.DB.prepare(
      `SELECT id, username, display_name, role, is_active
       FROM admins
       ORDER BY CASE WHEN role = 'superadmin' THEN 0 ELSE 1 END, id`
    ).all();

    return json({
      success: true,
      accounts: result.results.map(publicAccount)
    });
  } catch (error) {
    console.error("Loading accounts failed:", error);
    return json({ success: false, message: "Unable to load accounts." }, 500);
  }
}

// Superadmin only: create a member account. The superadmin can type the
// password; if it is left empty one is generated. Only a hash is stored.
export async function onRequestPost({ request, env }) {
  try {
    const auth = await requireSuperadmin(request, env);
    if (auth.response) return auth.response;

    const body = await readJson(request);

    if (!body) {
      return json({ success: false, message: "Invalid request." }, 400);
    }

    const username =
      typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const displayName =
      typeof body.display_name === "string"
        ? body.display_name.trim().replace(/\s+/g, " ")
        : "";

    if (!USERNAME_PATTERN.test(username)) {
      return json(
        {
          success: false,
          message:
            "Username must be 3 to 30 lowercase letters, numbers, dots, dashes or underscores (no spaces)."
        },
        400
      );
    }

    if (!DISPLAY_NAME_PATTERN.test(displayName)) {
      return json(
        {
          success: false,
          message: "Name must use letters, spaces and . ' - only (1 to 60 characters)."
        },
        400
      );
    }

    const chosen = chooseNewPassword(body);

    if (chosen.error) {
      return json({ success: false, message: chosen.error }, 400);
    }

    const password = chosen.password;
    const passwordHash = await hashPassword(password);

    // The WHERE NOT EXISTS part makes sure a username is never added twice.
    const insert = await env.DB.prepare(
      `INSERT INTO admins
         (username, display_name, password_hash, role, is_active, must_change_password)
       SELECT ?, ?, ?, 'admin', 1, 1
       WHERE NOT EXISTS (SELECT 1 FROM admins WHERE lower(username) = ?)`
    )
      .bind(username, displayName, passwordHash, username)
      .run();

    if (!insert.meta || insert.meta.changes !== 1) {
      return json(
        { success: false, message: "That username is already taken." },
        409
      );
    }

    const account = {
      id: insert.meta.last_row_id,
      username,
      display_name: displayName,
      role: "admin",
      is_active: 1
    };

    await logActivity(env, auth.admin, "account_create", null, accountLabel(account));

    return json({ success: true, account, password }, 201);
  } catch (error) {
    console.error("Creating account failed:", error);
    return json({ success: false, message: "Unable to create the account." }, 500);
  }
}
