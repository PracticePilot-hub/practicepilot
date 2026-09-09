import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  "";

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseServiceKey) throw new Error("Missing Supabase service-role key");

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MODULE_KEYS = [
  "crm",
  "accounting",
  "afs",
  "assets",
  "secretarial",
  "projects",
  "management_reports",
  "paia",
  "proposals",
] as const;

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

async function requirePPAdmin(request: Request) {
  const token = bearerToken(request);

  if (!token) throw new Error("Not authenticated.");

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !user) throw new Error("Not authenticated.");

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("id,user_id,organisation_id,role,access_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.access_enabled === false ||
    profile.organisation_id !== null ||
    !["Super Admin", "Admin"].includes(String(profile.role || ""))
  ) {
    throw new Error("Access denied.");
  }

  return profile;
}

export async function GET(request: Request) {
  try {
    await requirePPAdmin(request);

    const [organisationsResult, licencesResult] = await Promise.all([
      admin
        .from("organisations")
        .select("id,name,status,access_enabled")
        .order("name", { ascending: true }),

      admin
        .from("practice_module_licences")
        .select("id,organisation_id,module_key,licence_limit,is_enabled")
        .order("module_key", { ascending: true }),
    ]);

    if (organisationsResult.error) throw organisationsResult.error;
    if (licencesResult.error) throw licencesResult.error;

    return NextResponse.json({
      success: true,
      organisations: organisationsResult.data || [],
      licences: licencesResult.data || [],
    });
  } catch (error: any) {
    const message = error?.message || "Could not load licence manager.";
    return NextResponse.json(
      { error: message },
      { status: message === "Not authenticated." ? 401 : message === "Access denied." ? 403 : 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requirePPAdmin(request);

    const body = await request.json();
    const organisationId = String(body.organisationId || "").trim();
    const moduleKey = String(body.moduleKey || "").trim();
    const licenceLimit = Number(body.licenceLimit ?? 0);
    const isEnabled = body.isEnabled !== false;

    if (!organisationId) {
      return NextResponse.json({ error: "Practice is required." }, { status: 400 });
    }

    if (!MODULE_KEYS.includes(moduleKey as any)) {
      return NextResponse.json({ error: "Invalid module." }, { status: 400 });
    }

    if (!Number.isInteger(licenceLimit) || licenceLimit < 0) {
      return NextResponse.json(
        { error: "Licence limit must be a whole number of 0 or more." },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("practice_module_licences")
      .upsert(
        {
          organisation_id: organisationId,
          module_key: moduleKey,
          licence_limit: licenceLimit,
          is_enabled: isEnabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organisation_id,module_key" }
      )
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, licence: data });
  } catch (error: any) {
    const message = error?.message || "Could not save licence.";
    return NextResponse.json(
      { error: message },
      { status: message === "Not authenticated." ? 401 : message === "Access denied." ? 403 : 500 }
    );
  }
}
