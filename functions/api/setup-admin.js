
import { hashPassword } from "../lib/password.js";

export async function onRequestPost({ request, env }) {
  // The endpoint stays locked unless a setup secret is configured.
  if (new URL(request.url).protocol !== "https:") {
  return Response.json(
    { success: false, message: "HTTPS is required." },
    { status: 400 }
  );
}
  const setupToken = env.INITIAL_SETUP_TOKEN;
  const authorization = request.headers.get("Authorization");

  if (!setupToken || authorization !== `Bearer ${setupToken}`) {
    return Response.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, message: "Invalid JSON request." },
      { status: 400 }
    );
  }

  const username = body.username?.trim();
  const displayName = body.displayName?.trim();
  const password = body.password;

  if (
    typeof username !== "string" ||
    !/^[a-zA-Z0-9_.-]{3,32}$/.test(username) ||
    typeof displayName !== "string" ||
    displayName.length < 2 ||
    displayName.length > 80 ||
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  ) {
    return Response.json(
      {
        success: false,
        message:
          "Check your username, display name, and password requirements."
      },
      { status: 400 }
    );
  }

  try {
    const existing = await env.DB.prepare(
      "SELECT id FROM admins WHERE role = 'superadmin' LIMIT 1"
    ).first();

    if (existing) {
      return Response.json(
        {
          success: false,
          message: "Initial setup has already been completed."
        },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const result = await env.DB.prepare(`
      INSERT INTO admins (
        username,
        display_name,
        password_hash,
        role,
        is_active
      )
      SELECT ?, ?, ?, 'superadmin', 1
      WHERE NOT EXISTS (
        SELECT 1 FROM admins WHERE role = 'superadmin'
      )
    `)
      .bind(username, displayName, passwordHash)
      .run();

    if (result.meta.changes !== 1) {
      return Response.json(
        {
          success: false,
          message: "Initial setup has already been completed."
        },
        { status: 409 }
      );
    }

    return Response.json(
      {
        success: true,
        message: "Initial superadmin account created."
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Initial admin setup failed:", error);

    return Response.json(
      {
        success: false,
        message: "Unable to create the initial account."
      },
      { status: 500 }
    );
  }
}
