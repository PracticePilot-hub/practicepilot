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

const moduleFields: Record<string, string> = {
  crm: "can_access_crm",
  accounting: "can_access_accounting",
  afs: "can_access_afs",
  assets: "can_access_assets",
  secretarial: "can_access_secretarial",
  projects: "can_access_projects",
  management_reports: "can_access_management_reports",
  paia: "can_access_paia",
  proposals: "can_access_proposals",
  trusts: "can_access_trusts",
};

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

async function requireGlobalAdmin(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return {
      profile: null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !user) {
    return {
      profile: null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("id,user_id,role,access_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.access_enabled === false ||
    !["Super Admin", "Admin"].includes(String(profile.role || ""))
  ) {
    return {
      profile: null,
      response: NextResponse.json({ error: "Admin access required." }, { status: 403 }),
    };
  }

  return { profile, response: null };
}

async function organisationId(context: any) {
  const params = await context.params;
  return String(params.id || "").trim();
}

async function moduleRows(orgId: string) {
  const { data: rows, error } = await admin
    .from("practice_module_licences")
    .select("module_key,licence_limit,is_enabled")
    .eq("organisation_id", orgId)
    .order("module_key", { ascending: true });

  if (error) throw error;

  const { data: users, error: usersError } = await admin
    .from("user_profiles")
    .select(
      "id,access_enabled,can_access_crm,can_access_accounting,can_access_afs,can_access_assets,can_access_secretarial,can_access_projects,can_access_management_reports,can_access_paia,can_access_proposals,can_access_trusts"
    )
    .eq("organisation_id", orgId);

  if (usersError) throw usersError;

  return (rows || []).map((row: any) => {
    const field = moduleFields[row.module_key];
    const used = field
      ? (users || []).filter(
          (user: any) => user.access_enabled !== false && user[field] === true
        ).length
      : 0;

    return {
      module_key: row.module_key,
      licence_limit: Number(row.licence_limit || 0),
      is_enabled: row.is_enabled !== false,
      used,
      available: Math.max(Number(row.licence_limit || 0) - used, 0),
    };
  });
}

export async function GET(request: Request, context: any) {
  try {
    const { response } = await requireGlobalAdmin(request);
    if (response) return response;

    const orgId = await organisationId(context);
    if (!orgId) {
      return NextResponse.json({ error: "Organisation is required." }, { status: 400 });
    }

    const rows = await moduleRows(orgId);
    return NextResponse.json({ success: true, modules: rows });
  } catch (error: any) {
    console.error("ADMIN ORGANISATION MODULES GET ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Could not load modules." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: any) {
  try {
    const { response } = await requireGlobalAdmin(request);
    if (response) return response;

    const orgId = await organisationId(context);
    const body = await request.json();
    const moduleKey = String(body.moduleKey || "").trim();
    const isEnabled = body.isEnabled === true;
    const licenceLimit = Number(body.licenceLimit ?? 0);
    const field = moduleFields[moduleKey];

    if (!orgId) {
      return NextResponse.json({ error: "Organisation is required." }, { status: 400 });
    }

    if (!field) {
      return NextResponse.json({ error: "Invalid module." }, { status: 400 });
    }

    if (!Number.isInteger(licenceLimit) || licenceLimit < 0) {
      return NextResponse.json(
        { error: "Licence quantity must be a whole number of 0 or more." },
        { status: 400 }
      );
    }

    const { count, error: countError } = await admin
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", orgId)
      .eq("access_enabled", true)
      .eq(field, true);

    if (countError) throw countError;

    const used = Number(count || 0);

    if (!isEnabled && used > 0) {
      return NextResponse.json(
        {
          error: `This module is still allocated to ${used} active user(s). Remove their module access first.`,
        },
        { status: 400 }
      );
    }

    if (isEnabled && licenceLimit < Math.max(used, 1)) {
      return NextResponse.json(
        {
          error:
            used > 0
              ? `This module is allocated to ${used} active user(s). The licence quantity cannot be lower than ${used}.`
              : "An enabled module must have at least 1 licence.",
        },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } = await admin
      .from("practice_module_licences")
      .select("module_key")
      .eq("organisation_id", orgId)
      .eq("module_key", moduleKey)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      const { error } = await admin
        .from("practice_module_licences")
        .update({
          is_enabled: isEnabled,
          licence_limit: isEnabled ? Math.max(licenceLimit, 1) : 0,
          updated_at: new Date().toISOString(),
        })
        .eq("organisation_id", orgId)
        .eq("module_key", moduleKey);

      if (error) throw error;
    } else {
      const { error } = await admin.from("practice_module_licences").insert({
        organisation_id: orgId,
        module_key: moduleKey,
        is_enabled: isEnabled,
        licence_limit: isEnabled ? Math.max(licenceLimit, 1) : 0,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
    }

    const rows = await moduleRows(orgId);
    return NextResponse.json({ success: true, modules: rows });
  } catch (error: any) {
    console.error("ADMIN ORGANISATION MODULES PATCH ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Could not update module subscription." },
      { status: 500 }
    );
  }
}
