import { json } from "../../lib/api.js";
import { PUBLIC_COLUMNS } from "../../lib/documents.js";

// Public: list of published documents (nothing hidden or deleted).
export async function onRequestGet({ env }) {
  try {
    const result = await env.DB.prepare(
      `SELECT ${PUBLIC_COLUMNS}
       FROM documents
       WHERE is_deleted = 0 AND is_published = 1
       ORDER BY publication_date DESC, id DESC`
    ).all();

    return json({ success: true, documents: result.results });
  } catch (error) {
    console.error("Listing documents failed:", error);

    return json(
      { success: false, message: "Unable to load documents right now." },
      500
    );
  }
}
