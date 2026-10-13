import { getAuthenticatedAdmin } from "../../../lib/session.js";
import { json } from "../../../lib/api.js";
import { contentDisposition, parseId } from "../../../lib/documents.js";

// Public: opens a published document in the browser.
// Add ?download=1 to force a download instead.
// Hidden documents are only available to a logged-in admin.
export async function onRequestGet({ request, env, params }) {
  try {
    const id = parseId(params.id);

    if (!id) {
      return json({ success: false, message: "Document not found." }, 404);
    }

    const doc = await env.DB.prepare(
      `SELECT file_key, original_filename, mime_type, is_published, is_deleted
       FROM documents
       WHERE id = ?
       LIMIT 1`
    )
      .bind(id)
      .first();

    if (!doc || doc.is_deleted === 1) {
      return json({ success: false, message: "Document not found." }, 404);
    }

    const isPublic = doc.is_published === 1;

    if (!isPublic) {
      const admin = await getAuthenticatedAdmin(request, env);

      if (!admin) {
        return json({ success: false, message: "Document not found." }, 404);
      }
    }

    const object = await env.DOCS_BUCKET.get(doc.file_key);

    if (!object) {
      return json({ success: false, message: "File not found." }, 404);
    }

    const download =
      new URL(request.url).searchParams.get("download") === "1";

    const headers = new Headers({
      "Content-Type": doc.mime_type,
      "Content-Length": String(object.size),
      "Content-Disposition": contentDisposition(
        download ? "attachment" : "inline",
        doc.original_filename
      ),
      "X-Content-Type-Options": "nosniff",
      // Always re-check, so hidden or deleted files stop working at once.
      "Cache-Control": isPublic ? "no-cache" : "private, no-store"
    });

    if (isPublic && object.httpEtag) {
      headers.set("ETag", object.httpEtag);

      if (request.headers.get("If-None-Match") === object.httpEtag) {
        return new Response(null, { status: 304, headers });
      }
    }

    return new Response(object.body, { headers });
  } catch (error) {
    console.error("Serving document failed:", error);

    return json(
      { success: false, message: "Unable to open this document." },
      500
    );
  }
}
