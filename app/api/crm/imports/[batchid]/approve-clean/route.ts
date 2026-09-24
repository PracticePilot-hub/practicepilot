import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) throw new Error("Supabase server credentials are missing.");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getProfile(request: Request) {
  const admin = getAdmin();
  const token = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) return { admin, profile: null };

  const {
    data: { user },
  } = await admin.auth.getUser(token);

  if (!user) return { admin, profile: null };

  const { data: profile } = await admin
    .from("user_profiles")
    .select("user_id,organisation_id,access_enabled,can_access_crm")
    .eq("user_id", user.id)
    .maybeSingle();

  return { admin, profile };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ batchid?: string; batchId?: string }> }
) {
  try {
    const routeParams = await context.params;
    const batchId = String(routeParams.batchid || routeParams.batchId || "");

    if (!batchId) {
      return NextResponse.json(
        { error: "Import batch ID is missing." },
        { status: 400 }
      );
    }
    const { admin, profile } = await getProfile(request);

    if (
      !profile?.organisation_id ||
      profile.access_enabled === false ||
      profile.can_access_crm === false
    ) {
      return NextResponse.json({ error: "CRM access denied." }, { status: 403 });
    }

    const now = new Date().toISOString();

    const { data: approvedRows, error: approveError } = await admin
      .from("crm_import_rows")
      .update({
        approved_for_import: true,
        approved_by_user_id: profile.user_id,
        approved_at: now,
      })
      .eq("batch_id", batchId)
      .eq("organisation_id", profile.organisation_id)
      .in("match_status", ["pending", "create", "update", "skip"])
      .select("id");

    if (approveError) throw approveError;

    await admin.from("crm_import_events").insert({
      organisation_id: profile.organisation_id,
      batch_id: batchId,
      event_type: "clean_rows_approved",
      message: `${approvedRows?.length || 0} clean row(s) approved for a future import step.`,
      details: {
        approved_count: approvedRows?.length || 0,
      },
      created_by_user_id: profile.user_id,
    });

    return NextResponse.json({
      success: true,
      approved_count: approvedRows?.length || 0,
    });
  } catch (error) {
    console.error("CRM IMPORT APPROVE CLEAN ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not approve the clean import rows.",
      },
      { status: 500 }
    );
  }
}
