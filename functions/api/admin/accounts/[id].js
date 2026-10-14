import { json, readJson, requireSuperadmin } from "../../../lib/api.js";
import { hashPassword } from "../../../lib/password.js";
import { logActivity } from "../../../lib/activity.js";
import {
  accountLabel,
  chooseNewPassword,
  parseAccountId,
  publicAccount
} from "../../../lib/accounts.js";

// Superadmin only. Body is one of:
//   { "action": "reset_password", "password": "optional" }
//                                   -> new password (typed, or generated if empty)
//   { "is_active": 0 | 1 }          -> deactivate or reactivate the account
// Superadmin accounts can never be changed here.
export async function onRequestPatch({ request, env, params }) {
  try {
    const auth = await requireSuperadmin(request, env);
    if (auth.response) return auth.response;

    const id = parseAccountId(params.id);
    const body = await readJson(request);

    if (!id || !body) {
      return json({ success: false, message: "Invalid request." }, 400);
    }

    const target = await env.DB.prepare(
      `SELECT id, username, display_name, role, is_active
       FROM admins WHERE id = ? LIMIT 1`
    )
      .bind(id)
      .first();

    if (!target) {
      return json({ success: false, message: "Account not found." }, 404);
    }

    if (target.role !== "admin") {
      return json(
        {
          success: false,
          message: "Superadmin accounts cannot be changed here."
        },
        403
      );
    }

    // Removing the sessions signs the member out everywhere immediately.
    const endSessions = env.DB.prepare(
      "DELETE FROM admin_sessions WHERE admin_id = ?"
    ).bind(id);

    if (body.action === "reset_password") {
      const chosen = chooseNewPassword(body);

      if (chosen.error) {
        return json({ success: false, message: chosen.error }, 400);
      }

      const password = chosen.password;
      const passwordHash = await hashPassword(password);

      await env.DB.batch([
        env.DB.prepare(
          "UPDATE admins SET password_hash = ?, must_change_password = 1 WHERE id = ?"
        ).bind(
          passwordHash,
          id
        ),
        endSessions
      ]);

      await logActivity(env, auth.admin, "password_reset", null, accountLabel(target));

      return json({
        success: true,
        account: publicAccount(target),
        password
      });
    }

    if (body.is_active === 0 || body.is_active === 1) {
      const statements = [
        env.DB.prepare("UPDATE admins SET is_active = ? WHERE id = ?").bind(
          body.is_active,
          id
        )
      ];

      if (body.is_active === 0) statements.push(endSessions);

      await env.DB.batch(statements);

      await logActivity(
        env,
        auth.admin,
        body.is_active === 1 ? "account_activate" : "account_deactivate",
        null,
        accountLabel(target)
      );

      return json({
        success: true,
        account: publicAccount({ ...target, is_active: body.is_active })
      });
    }

    return json({ success: false, message: "Invalid request." }, 400);
  } catch (error) {
    console.error("Updating account failed:", error);
    return json({ success: false, message: "Unable to update the account." }, 500);
  }
}
