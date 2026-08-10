// Path: app/api/engagements/[id]/apply-legal-terms/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) throw new Error("Missing server Supabase service role key.");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getEngagementId(context: any) {
  const params = await context.params;
  return String(params?.id || "");
}

function getBearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function isGlobalAdmin(role: string) {
  return role === "Super Admin" || role === "Admin";
}

export async function POST(request: Request, context: any) {
  const supabase = getSupabaseAdmin();

  try {
    const engagementId = await getEngagementId(context);
    const token = getBearerToken(request);

    if (!engagementId) {
      return NextResponse.json(
        { success: false, error: "Missing engagement id." },
        { status: 400 }
      );
    }

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, email, full_name, role, organisation_id, access_enabled")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile || !profile.access_enabled) {
      return NextResponse.json(
        { success: false, error: "Could not load active user profile." },
        { status: 403 }
      );
    }

    const { data: engagement, error: engagementError } = await supabase
      .from("engagements")
      .select("id, organisation_id, engagement_number, status, locked_at")
      .eq("id", engagementId)
      .single();

    if (engagementError || !engagement) {
      return NextResponse.json(
        { success: false, error: "Engagement not found." },
        { status: 404 }
      );
    }

    const canAccess =
      isGlobalAdmin(profile.role) ||
      profile.organisation_id === engagement.organisation_id;

    if (!canAccess) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this engagement." },
        { status: 403 }
      );
    }

    if (engagement.locked_at) {
      return NextResponse.json(
        { success: false, error: "This engagement is signed and locked." },
        { status: 409 }
      );
    }

    if (engagement.status !== "Draft") {
      return NextResponse.json(
        {
          success: false,
          error: "Legal terms can only be applied while the engagement is Draft.",
        },
        { status: 409 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    const { data: library, error: libraryError } = await supabase
      .from("engagement_clause_library")
      .select(
        "id, organisation_id, clause_key, category, title, body, version, sort_order, is_active, is_mandatory, effective_from, effective_to"
      )
      .eq("is_active", true)
      .or(
        `organisation_id.is.null,organisation_id.eq.${engagement.organisation_id}`
      )
      .order("sort_order", { ascending: true });

    if (libraryError) throw libraryError;

    const effective = (library || []).filter((clause: any) => {
      if (clause.effective_from && clause.effective_from > today) return false;
      if (clause.effective_to && clause.effective_to < today) return false;
      return true;
    });

    const byKey = new Map<string, any>();

    for (const clause of effective) {
      const existing = byKey.get(clause.clause_key);

      if (!existing) {
        byKey.set(clause.clause_key, clause);
        continue;
      }

      const clauseIsOrganisationSpecific =
        clause.organisation_id === engagement.organisation_id;
      const existingIsOrganisationSpecific =
        existing.organisation_id === engagement.organisation_id;

      if (
        (clauseIsOrganisationSpecific && !existingIsOrganisationSpecific) ||
        (clauseIsOrganisationSpecific === existingIsOrganisationSpecific &&
          Number(clause.version || 0) > Number(existing.version || 0))
      ) {
        byKey.set(clause.clause_key, clause);
      }
    }

    const selected = Array.from(byKey.values()).sort(
      (a: any, b: any) =>
        Number(a.sort_order || 0) - Number(b.sort_order || 0)
    );

    if (selected.length === 0) {
      return NextResponse.json(
        { success: false, error: "No active legal clauses were found." },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from("engagement_clauses")
      .delete()
      .eq("engagement_id", engagementId);

    if (deleteError) throw deleteError;

    const rows = selected.map((clause: any) => ({
      engagement_id: engagementId,
      organisation_id: engagement.organisation_id,
      source_clause_id: clause.id,
      clause_key: clause.clause_key,
      category: clause.category,
      title: clause.title,
      body: clause.body,
      clause_version: clause.version,
      sort_order: clause.sort_order,
      is_mandatory: clause.is_mandatory,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("engagement_clauses")
      .insert(rows)
      .select("*")
      .order("sort_order", { ascending: true });

    if (insertError) throw insertError;

    const highestVersion = selected.reduce(
      (max: number, clause: any) =>
        Math.max(max, Number(clause.version || 0)),
      0
    );

    const legalTemplateVersion = `Clause pack v${highestVersion}`;

    const { error: updateError } = await supabase
      .from("engagements")
      .update({ legal_template_version: legalTemplateVersion })
      .eq("id", engagementId);

    if (updateError) throw updateError;

    await supabase.from("engagement_events").insert({
      engagement_id: engagementId,
      organisation_id: engagement.organisation_id,
      event_type: "Legal Terms Applied",
      from_status: "Draft",
      to_status: "Draft",
      event_description: `${selected.length} legal clauses were applied to the engagement.`,
      event_payload: {
        clause_count: selected.length,
        legal_template_version: legalTemplateVersion,
      },
      performed_by: profile.id,
      performed_by_name: profile.full_name || profile.email,
      performed_by_email: profile.email,
    });

    return NextResponse.json({
      success: true,
      clause_count: inserted?.length || selected.length,
      legal_template_version: legalTemplateVersion,
      clauses: inserted || [],
    });
  } catch (error: any) {
    console.error("APPLY LEGAL TERMS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unable to apply legal terms.",
      },
      { status: 500 }
    );
  }
}
