/* SUGGESTIONS-DISABLED --------------------------------------------------------------
   The "Let your voice be heard" suggestions feature is switched off.
   The original code is kept below inside this comment.

   To switch it back on:
     1. Delete the stub at the bottom of this file (the `onRequest` function).
     2. Remove the opening comment marker (slash-star) just under this note and
        the closing marker (star-slash) at the end of the code.
     3. See the SUGGESTIONS notes at the top of src/main.js and
        src/dashboard.js for the other places to switch on.
   ---------------------------------------------------------------------------

import { json, readJson, requireAdmin } from "../../../lib/api.js";
import { logActivity } from "../../../lib/activity.js";
import { summarize } from "../../../lib/suggestions.js";

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function findSuggestion(env, id) {
  return env.DB.prepare(
    "SELECT id, name, message, status FROM suggestions WHERE id = ? LIMIT 1"
  )
    .bind(id)
    .first();
}

// Any admin: approve (shows on the public page) or reject (hides it).
// Body: { "status": "approved" | "rejected" }
export async function onRequestPatch({ request, env, params }) {
  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const id = parseId(params.id);
    const body = await readJson(request);

    if (!id || !body || !["approved", "rejected"].includes(body.status)) {
      return json({ success: false, message: "Invalid request." }, 400);
    }

    const suggestion = await findSuggestion(env, id);

    if (!suggestion) {
      return json({ success: false, message: "Suggestion not found." }, 404);
    }

    if (suggestion.status === body.status) {
      return json({ success: true, status: suggestion.status });
    }

    await env.DB.prepare(
      `UPDATE suggestions
       SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
           ip_hash = CASE WHEN ? = 'approved' THEN NULL ELSE ip_hash END
       WHERE id = ?`
    )
      .bind(body.status, auth.admin.id, body.status, id)
      .run();

    await logActivity(
      env,
      auth.admin,
      body.status === "approved" ? "suggestion_approve" : "suggestion_reject",
      null,
      summarize(suggestion)
    );

    return json({ success: true, status: body.status });
  } catch (error) {
    console.error("Reviewing suggestion failed:", error);
    return json({ success: false, message: "Unable to update the suggestion." }, 500);
  }
}

// Any admin: permanently delete a REJECTED suggestion (for spam clean-up).
export async function onRequestDelete({ request, env, params }) {
  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const id = parseId(params.id);

    if (!id) {
      return json({ success: false, message: "Invalid request." }, 400);
    }

    const suggestion = await findSuggestion(env, id);

    if (!suggestion) {
      return json({ success: false, message: "Suggestion not found." }, 404);
    }

    if (suggestion.status !== "rejected") {
      return json(
        {
          success: false,
          message: "Only rejected suggestions can be deleted. Reject it first."
        },
        409
      );
    }

    await env.DB.prepare("DELETE FROM suggestions WHERE id = ?").bind(id).run();

    await logActivity(env, auth.admin, "suggestion_delete", null, summarize(suggestion));

    return json({ success: true });
  } catch (error) {
    console.error("Deleting suggestion failed:", error);
    return json({ success: false, message: "Unable to delete the suggestion." }, 500);
  }
}

*/

// While the feature is off, this address simply answers "not found".
export function onRequest() {
  return new Response(JSON.stringify({ success: false, message: "Not found." }), {
    status: 404,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
