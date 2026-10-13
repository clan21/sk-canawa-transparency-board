// Records admin actions (upload, edit, publish/hide, delete) in the
// admin_activity table: admin_id, action, document_id, details.
//
// A problem while logging must never undo or block the action itself
// (the document change has already been saved), so errors are only
// written to the server log.
export async function logActivity(env, admin, action, documentId, details = "") {
  try {
    await env.DB.prepare(
      `INSERT INTO admin_activity (admin_id, action, document_id, details)
       VALUES (?, ?, ?, ?)`
    )
      .bind(
        admin.id,
        action,
        documentId ?? null,
        String(details ?? "").slice(0, 300)
      )
      .run();
  } catch (error) {
    console.error("Could not record admin activity:", error);
  }
}
