import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function checkCubeChemAccess(email: string) {
  const supabase = getSupabaseAdmin();

  const cleanedEmail = String(email || "").trim().toLowerCase();

  if (!cleanedEmail) {
    return {
      allowed: false,
      accessLevel: null,
    };
  }

  const result = await supabase
    .from("practicepilot_module_access")
    .select("access_level")
    .eq("email", cleanedEmail)
    .eq("module_key", "cubechem")
    .eq("is_active", true)
    .maybeSingle();

  if (result.error) throw result.error;

  return {
    allowed: Boolean(result.data),
    accessLevel: result.data?.access_level || null,
  };
}

export function getRequestEmail(req: Request) {
  return (
    req.headers.get("x-practicepilot-user-email") ||
    req.headers.get("x-user-email") ||
    req.headers.get("x-vercel-user-email") ||
    ""
  );
}