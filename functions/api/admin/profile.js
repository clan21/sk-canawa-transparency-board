import { json, requireAdmin } from "../../lib/api.js";

// Any logged-in admin: who am I, and do I still have to choose my own
// password? (The dashboard asks this right after it opens.)
export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireAdmin(request, env, {
      allowPasswordChange: true
    });

    if (auth.response) return auth.response;

    return json({
      success: true,
      profile: {
        username: auth.admin.username,
        display_name: auth.admin.display_name,
        role: auth.admin.role,
        must_change_password: auth.admin.must_change_password === 1 ? 1 : 0
      }
    });
  } catch (error) {
    console.error("Loading profile failed:", error);
    return json({ success: false, message: "Unable to load your profile." }, 500);
  }
}
