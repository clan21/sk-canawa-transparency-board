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

import { json, readJson } from "../lib/api.js";
import {
  MAX_PENDING,
  MAX_PER_DAY,
  MAX_PER_HOUR,
  hashIp,
  parsePage,
  validateSuggestion
} from "../lib/suggestions.js";

const PAGE_SIZE = 5;

// Public: approved suggestions only, newest first.
export async function onRequestGet({ request, env }) {
  try {
    const page = parsePage(new URL(request.url));
    const offset = (page - 1) * PAGE_SIZE;

    const [rows, count] = await Promise.all([
      env.DB.prepare(
        `SELECT id, name, message, created_at
         FROM suggestions
         WHERE status = 'approved'
         ORDER BY id DESC
         LIMIT ? OFFSET ?`
      )
        .bind(PAGE_SIZE, offset)
        .all(),
      env.DB.prepare(
        "SELECT COUNT(*) AS total FROM suggestions WHERE status = 'approved'"
      ).first()
    ]);

    return json({
      success: true,
      suggestions: rows.results,
      total: count ? count.total : 0,
      page,
      pageSize: PAGE_SIZE
    });
  } catch (error) {
    console.error("Loading suggestions failed:", error);
    return json(
      { success: false, message: "Unable to load suggestions right now." },
      500
    );
  }
}

// Public: send a new suggestion. It is saved as 'pending' and is not shown
// until an admin approves it. No account or login is needed.
export async function onRequestPost({ request, env }) {
  try {
    // The request must come from this same website.
    const origin = request.headers.get("Origin");

    if (origin && origin !== new URL(request.url).origin) {
      return json({ success: false, message: "Forbidden." }, 403);
    }

    const body = await readJson(request);

    if (!body) {
      return json({ success: false, message: "Invalid request." }, 400);
    }

    // Hidden "website" box: people never see it, spam robots fill it in.
    // Pretend it worked so the robot moves on, but save nothing.
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return json({ success: true }, 201);
    }

    const checked = validateSuggestion(body);

    if (checked.error) {
      return json({ success: false, message: checked.error }, 400);
    }

    // Slow down repeated sending from the same connection.
    const ip = request.headers.get("CF-Connecting-IP");
    const ipHash = ip ? await hashIp(ip, env.SUGGESTION_SALT) : null;

    if (ipHash) {
      const recent = await env.DB.prepare(
        `SELECT
           SUM(created_at >= datetime('now', '-1 hour')) AS last_hour,
           COUNT(*) AS last_day
         FROM suggestions
         WHERE ip_hash = ? AND created_at >= datetime('now', '-1 day')`
      )
        .bind(ipHash)
        .first();

      if (
        recent &&
        ((recent.last_hour || 0) >= MAX_PER_HOUR ||
          (recent.last_day || 0) >= MAX_PER_DAY)
      ) {
        return json(
          {
            success: false,
            message:
              "You have sent several suggestions already. Please try again later."
          },
          429
        );
      }
    }

    // If a lot are waiting for review, stop taking more for now.
    const waiting = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM suggestions WHERE status = 'pending'"
    ).first();

    if (waiting && waiting.total >= MAX_PENDING) {
      return json(
        {
          success: false,
          message:
            "We cannot take new suggestions right now. Please try again in a few days."
        },
        503
      );
    }

    await env.DB.prepare(
      `INSERT INTO suggestions (name, message, status, ip_hash)
       VALUES (?, ?, 'pending', ?)`
    )
      .bind(checked.name, checked.message, ipHash)
      .run();

    return json({ success: true }, 201);
  } catch (error) {
    console.error("Saving suggestion failed:", error);
    return json(
      { success: false, message: "Unable to send your suggestion right now." },
      500
    );
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
