import { getAuthenticatedAdmin } from "./session.js";

export function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

// Every admin-only endpoint calls this first.
// Returns { admin } on success or { response } to send back immediately.
export async function requireAdmin(request, env) {
  // Extra protection for requests that change data: the request must
  // come from this same website (on top of the SameSite=Strict cookie).
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("Origin");

    if (origin && origin !== new URL(request.url).origin) {
      return {
        response: json({ success: false, message: "Forbidden." }, 403)
      };
    }
  }

  const admin = await getAuthenticatedAdmin(request, env);

  if (!admin) {
    return {
      response: json({ success: false, message: "Not authenticated." }, 401)
    };
  }

  return { admin };
}

// Same as requireAdmin, but only the superadmin gets through.
// Role checks always happen here on the server; hiding a tab in the
// dashboard is only for convenience, never for security.
export async function requireSuperadmin(request, env) {
  const auth = await requireAdmin(request, env);

  if (auth.response) return auth;

  if (auth.admin.role !== "superadmin") {
    return {
      response: json({ success: false, message: "Forbidden." }, 403)
    };
  }

  return auth;
}
