import { json, requireAdmin } from "../../../lib/api.js";
import { logActivity } from "../../../lib/activity.js";
import {
  parseId,
  readFields,
  readFile,
  readMultipart
} from "../../../lib/documents.js";

const NOT_FOUND = { success: false, message: "Document not found." };

// Admin: edit a document. Sending a new file replaces the old one.
export async function onRequestPut({ request, env, params }) {
  let newKey = null;
  let saved = false;

  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const id = parseId(params.id);
    if (!id) return json(NOT_FOUND, 404);

    const existing = await env.DB.prepare(
      "SELECT id, file_key FROM documents WHERE id = ? AND is_deleted = 0"
    )
      .bind(id)
      .first();

    if (!existing) return json(NOT_FOUND, 404);

    const multipart = await readMultipart(request);

    if (multipart.error) {
      return json(
        { success: false, message: multipart.error },
        multipart.status
      );
    }

    const fields = readFields(multipart.form);

    if (fields.error) {
      return json({ success: false, message: fields.error }, 400);
    }

    const upload = await readFile(multipart.form, false);

    if (upload.error) {
      return json({ success: false, message: upload.error }, upload.status);
    }

    const { values } = fields;

    if (upload.bytes) {
      newKey = `documents/${crypto.randomUUID()}.${upload.type.ext}`;

      await env.DOCS_BUCKET.put(newKey, upload.bytes, {
        httpMetadata: { contentType: upload.type.mime }
      });

      await env.DB.prepare(
        `UPDATE documents
         SET title = ?, category = ?, description = ?, publication_date = ?,
             is_published = ?, file_key = ?, original_filename = ?,
             mime_type = ?, file_size = ?, updated_by = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND is_deleted = 0`
      )
        .bind(
          values.title,
          values.category,
          values.description,
          values.publicationDate,
          values.isPublished,
          newKey,
          upload.filename,
          upload.type.mime,
          upload.bytes.length,
          auth.admin.id,
          id
        )
        .run();
    } else {
      await env.DB.prepare(
        `UPDATE documents
         SET title = ?, category = ?, description = ?, publication_date = ?,
             is_published = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND is_deleted = 0`
      )
        .bind(
          values.title,
          values.category,
          values.description,
          values.publicationDate,
          values.isPublished,
          auth.admin.id,
          id
        )
        .run();
    }

    saved = true;

    // The replaced file is no longer needed (and may have been replaced
    // because it should not have been public), so remove it.
    if (newKey) {
      try {
        await env.DOCS_BUCKET.delete(existing.file_key);
      } catch (error) {
        console.error("Could not remove the replaced file:", error);
      }
    }

    await logActivity(
      env,
      auth.admin,
      newKey ? "edit_and_replace_file" : "edit",
      id,
      values.title
    );

    return json({ success: true, message: "Document updated." });
  } catch (error) {
    console.error("Edit failed:", error);

    if (newKey && !saved) {
      try {
        await env.DOCS_BUCKET.delete(newKey);
      } catch {
        // Nothing more to do.
      }
    }

    return json(
      { success: false, message: "Unable to update the document right now." },
      500
    );
  }
}

// Admin: show or hide a document ({ "is_published": 0 or 1 }).
export async function onRequestPatch({ request, env, params }) {
  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const id = parseId(params.id);
    if (!id) return json(NOT_FOUND, 404);

    let body;

    try {
      body = await request.json();
    } catch {
      return json({ success: false, message: "Invalid request." }, 400);
    }

    if (body?.is_published !== 0 && body?.is_published !== 1) {
      return json({ success: false, message: "Invalid request." }, 400);
    }

    const result = await env.DB.prepare(
      `UPDATE documents
       SET is_published = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND is_deleted = 0`
    )
      .bind(body.is_published, auth.admin.id, id)
      .run();

    if (result.meta.changes === 0) return json(NOT_FOUND, 404);

    await logActivity(
      env,
      auth.admin,
      body.is_published === 1 ? "publish" : "hide",
      id
    );

    return json({ success: true, message: "Document updated." });
  } catch (error) {
    console.error("Publish toggle failed:", error);

    return json(
      { success: false, message: "Unable to update the document right now." },
      500
    );
  }
}

// Admin: delete a document. This is a "soft" delete: it disappears from the
// site and the dashboard, but the record is kept so it can be recovered.
export async function onRequestDelete({ request, env, params }) {
  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const id = parseId(params.id);
    if (!id) return json(NOT_FOUND, 404);

    const result = await env.DB.prepare(
      `UPDATE documents
       SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP,
           updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND is_deleted = 0`
    )
      .bind(auth.admin.id, id)
      .run();

    if (result.meta.changes === 0) return json(NOT_FOUND, 404);

    await logActivity(env, auth.admin, "delete", id);

    return json({ success: true, message: "Document deleted." });
  } catch (error) {
    console.error("Delete failed:", error);

    return json(
      { success: false, message: "Unable to delete the document right now." },
      500
    );
  }
}
