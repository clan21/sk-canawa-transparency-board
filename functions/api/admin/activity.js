import { json, requireSuperadmin } from "../../lib/api.js";

const PAGE_SIZE = 20;

// Superadmin only: the admin activity log, newest first, 20 per page.
export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireSuperadmin(request, env);
    if (auth.response) return auth.response;

    const requested = Number.parseInt(
      new URL(request.url).searchParams.get("page") || "1",
      10
    );
    const page = Number.isInteger(requested) && requested > 0 ? requested : 1;
    const offset = (page - 1) * PAGE_SIZE;

    const [rows, count] = await Promise.all([
      env.DB.prepare(
        // Hide, publish and delete are logged without a title, so fall back to
        // the document's own title (deleted documents keep theirs).
        `SELECT a.id, a.action, a.document_id, a.created_at,
                COALESCE(NULLIF(a.details, ''), d.title, '') AS details,
                admins.display_name, admins.username
         FROM admin_activity AS a
         LEFT JOIN admins ON admins.id = a.admin_id
         LEFT JOIN documents AS d ON d.id = a.document_id
         ORDER BY a.id DESC
         LIMIT ? OFFSET ?`
      )
        .bind(PAGE_SIZE, offset)
        .all(),
      env.DB.prepare("SELECT COUNT(*) AS total FROM admin_activity").first()
    ]);

    return json({
      success: true,
      activity: rows.results,
      total: count ? count.total : 0,
      page,
      pageSize: PAGE_SIZE
    });
  } catch (error) {
    console.error("Loading activity failed:", error);

    return json(
      { success: false, message: "Unable to load the activity log." },
      500
    );
  }
}
