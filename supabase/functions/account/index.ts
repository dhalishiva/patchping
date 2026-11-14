// Deletes the signed-in user's account and all their data (cascades from auth.users).
import { adminClient, corsHeaders, json, userFromRequest } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const admin = adminClient();
  const user = await userFromRequest(req, admin);
  if (!user) return json({ error: "Unauthorized" }, 401);

  let body: { action?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  if (body.action !== "delete") return json({ error: "Unknown action" }, 400);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: "Could not delete account. Please contact support." }, 500);
  return json({ ok: true });
});
