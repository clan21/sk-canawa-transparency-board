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

// Reads a JSON request body. Returns an object, or null if the request is
// not valid JSON (so the endpoint can answer "Invalid request").
export async function readJson(request) {
  const type = request.headers.get("Content-Type") || "";

  if (!type.toLowerCase().includes("application/json")) return null;

  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? body
      : null;
  } catch {
    return null;
  }
}

// Every admin-only endpoint calls this first.
// Returns { admin } on success or { response } to send back immediately.
//
// A member who still has a temporary password (must_change_password = 1) can
// only reach the endpoints that pass { allowPasswordChange: true }, so the
// "choose your own password" step cannot be skipped by calling the API.
export async function requireAdmin(request, env, options = {}) {
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

  if (admin.must_change_password === 1 && !options.allowPasswordChange) {
    return {
      response: json(
        {
          success: false,
          code: "password_change_required",
          message: "Please choose a new password first."
        },
        403
      )
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
