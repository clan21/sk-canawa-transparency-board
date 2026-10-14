// View and download counting for documents.
//
// A "view" is opening the file in the browser, a "download" is the Download
// button. The same visitor opening the same document again on the same day is
// counted once. Search-engine robots, link-preview robots, admins previewing
// from the dashboard and partial (Range) requests are not counted.

const ROBOTS =
  /bot|crawl|spider|slurp|facebookexternalhit|facebot|preview|headless|lighthouse|monitor|uptime|curl|wget|python-requests|go-http|java\//i;

export function isCountable(request) {
  if (request.method !== "GET") return false;

  const agent = request.headers.get("User-Agent") || "";

  if (!agent || ROBOTS.test(agent)) return false;

  // A browser asking for the middle of a file is not a new view.
  const range = request.headers.get("Range");

  if (range && !/^bytes=0-/.test(range)) return false;

  return true;
}

// The Philippines is UTC+8, so "today" changes at midnight local time.
function localDay(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function scramble(text) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// kind is "view" or "download". Problems are only logged: counting must never
// get in the way of opening a document.
export async function recordHit(env, request, documentId, kind) {
  try {
    const column = kind === "download" ? "download_count" : "view_count";
    const ip = request.headers.get("CF-Connecting-IP") || "";
    const agent = request.headers.get("User-Agent") || "";
    const visitor = await scramble(`${ip}|${agent}|${env.HIT_SALT || "sk-canawa"}`);

    const inserted = await env.DB.prepare(
      `INSERT OR IGNORE INTO document_hits (document_id, kind, visitor_hash, day)
       VALUES (?, ?, ?, ?)`
    )
      .bind(documentId, kind, visitor, localDay())
      .run();

    if (inserted.meta && inserted.meta.changes === 1) {
      await env.DB.prepare(
        `UPDATE documents SET ${column} = ${column} + 1 WHERE id = ?`
      )
        .bind(documentId)
        .run();
    }

    // Now and then, forget visitor rows older than 60 days (the totals stay).
    if (Math.random() < 0.02) {
      await env.DB.prepare("DELETE FROM document_hits WHERE day < ?")
        .bind(localDay(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)))
        .run();
    }
  } catch (error) {
    console.error("Could not record document hit:", error);
  }
}
