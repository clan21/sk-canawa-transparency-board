import { json, requireAdmin } from "../../../lib/api.js";
import { logActivity } from "../../../lib/activity.js";
import {
  readFields,
  readFile,
  readMultipart
} from "../../../lib/documents.js";

// Admin: list every document that is not deleted (including hidden ones).
export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

    const result = await env.DB.prepare(
      `SELECT id, title, category, description, publication_date,
              original_filename, mime_type, file_size, is_published,
              created_at, updated_at
       FROM documents
       WHERE is_deleted = 0
       ORDER BY publication_date DESC, id DESC`
    ).all();

    return json({ success: true, documents: result.results });
  } catch (error) {
    console.error("Admin listing failed:", error);

    return json(
      { success: false, message: "Unable to load documents right now." },
      500
    );
  }
}

// Admin: upload a new document.
export async function onRequestPost({ request, env }) {
  let fileKey = null;
  let saved = false;

  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;

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

    const upload = await readFile(multipart.form, true);

    if (upload.error) {
      return json({ success: false, message: upload.error }, upload.status);
    }

    const { values } = fields;

    // Random name: the uploaded file name is never used as the storage key.
    fileKey = `documents/${crypto.randomUUID()}.${upload.type.ext}`;

    await env.DOCS_BUCKET.put(fileKey, upload.bytes, {
      httpMetadata: { contentType: upload.type.mime }
    });

    const result = await env.DB.prepare(
      `INSERT INTO documents
         (title, category, description, publication_date, file_key,
          original_filename, mime_type, file_size, uploaded_by, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        values.title,
        values.category,
        values.description,
        values.publicationDate,
        fileKey,
        upload.filename,
        upload.type.mime,
        upload.bytes.length,
        auth.admin.id,
        values.isPublished
      )
      .run();

    saved = true;

    await logActivity(
      env,
      auth.admin,
      "upload",
      result.meta.last_row_id,
      values.title
    );

    return json(
      { success: true, message: "Document uploaded.", id: result.meta.last_row_id },
      201
    );
  } catch (error) {
    console.error("Upload failed:", error);

    // Do not leave an orphan file in storage if saving the record failed.
    if (fileKey && !saved) {
      try {
        await env.DOCS_BUCKET.delete(fileKey);
      } catch {
        // Nothing more to do.
      }
    }

    return json(
      { success: false, message: "Unable to upload the document right now." },
      500
    );
  }
}
