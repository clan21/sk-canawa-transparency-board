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

import { json, requireAdmin } from "../../../lib/api.js";
import { STATUSES, parsePage } from "../../../lib/suggestions.js";

const PAGE_SIZE = 10;

// Any admin: suggestions by status (pending, approved or rejected), newest
// first, plus how many there are in each status.
export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const url = new URL(request.url);
    const requested = url.searchParams.get("status") || "pending";
    const status = STATUSES.includes(requested) ? requested : "pending";
    const page = parsePage(url);
    const offset = (page - 1) * PAGE_SIZE;

    const [rows, counts] = await Promise.all([
      env.DB.prepare(
        `SELECT s.id, s.name, s.message, s.status, s.created_at, s.reviewed_at,
                admins.display_name AS reviewed_by_name
         FROM suggestions AS s
         LEFT JOIN admins ON admins.id = s.reviewed_by
         WHERE s.status = ?
         ORDER BY s.id DESC
         LIMIT ? OFFSET ?`
      )
        .bind(status, PAGE_SIZE, offset)
        .all(),
      env.DB.prepare(
        `SELECT status, COUNT(*) AS total FROM suggestions GROUP BY status`
      ).all()
    ]);

    const totals = { pending: 0, approved: 0, rejected: 0 };

    for (const row of counts.results) {
      if (row.status in totals) totals[row.status] = row.total;
    }

    return json({
      success: true,
      suggestions: rows.results,
      counts: totals,
      status,
      total: totals[status],
      page,
      pageSize: PAGE_SIZE
    });
  } catch (error) {
    console.error("Loading suggestions for admin failed:", error);
    return json({ success: false, message: "Unable to load suggestions." }, 500);
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
