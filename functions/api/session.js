
import { getAuthenticatedAdmin } from "../lib/session.js";

export async function onRequestGet({ request, env }) {
  try {
    const admin = await getAuthenticatedAdmin(request, env);

    if (!admin) {
      return Response.json(
        {
          success: false,
          message: "Not authenticated."
        },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" }
        }
      );
    }

    return Response.json(
      {
        success: true,
        admin: {
          id: admin.id,
          username: admin.username,
          displayName: admin.display_name,
          role: admin.role
        }
      },
      {
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch (error) {
    console.error("Session check failed:", error);

    return Response.json(
      {
        success: false,
        message: "Unable to check the session."
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }
}
