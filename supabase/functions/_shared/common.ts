import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

let cachedSecret: string | null = null;

/** The scheduler secret lives in public.app_config (RLS on, no policies: service role only). */
async function cronSecret(admin: SupabaseClient): Promise<string | null> {
  if (cachedSecret) return cachedSecret;
  const fromEnv = Deno.env.get("CRON_SECRET");
  if (fromEnv) return (cachedSecret = fromEnv);
  const { data } = await admin.from("app_config").select("value").eq("key", "cron_secret").maybeSingle();
  cachedSecret = data?.value ?? null;
  return cachedSecret;
}

/** Constant-time comparison of the cron secret header. */
export async function isCron(req: Request, admin: SupabaseClient): Promise<boolean> {
  const expected = await cronSecret(admin);
  const got = req.headers.get("x-cron-secret");
  if (!expected || !got || expected.length !== got.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

/** Resolve the signed-in user from the Authorization header, or null. */
export async function userFromRequest(req: Request, admin: SupabaseClient) {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
