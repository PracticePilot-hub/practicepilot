import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Applicability = "required" | "conditional" | "not_applicable" | "optional";

const SECTIONS = [
  { key: "client-setup", number: "01", title: "Client Setup", defaultApplicability: "required" },
  { key: "trial-balance", number: "02", title: "Trial Balance", defaultApplicability: "required" },
  { key: "adjusting-journals", number: "03", title: "Adjusting Journals", defaultApplicability: "conditional" },
  { key: "mapping", number: "04", title: "Mapping", defaultApplicability: "required" },
  { key: "lead-schedules", number: "05", title: "Lead Schedules", defaultApplicability: "conditional" },
  { key: "tax-calculator", number: "06", title: "Tax Calculator", defaultApplicability: "required" },
  { key: "financial-statements", number: "07", title: "Financial Statements", defaultApplicability: "required" },
  { key: "minutes", number: "08", title: "Minutes / Resolutions", defaultApplicability: "conditional" },
  { key: "export-print", number: "09", title: "Export / Print", defaultApplicability: "optional" },
] as const;

type Profile = {
  id: string;
  organisation_id: string | null;
  access_enabled: boolean;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!key) throw new Error("Missing Supabase service-role key.");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

async function currentProfile(
  request: Request,
  supabase: ReturnType<typeof adminClient>,
) {
  const token = bearerToken(request);

  if (!token) {
    return {
      profile: null as Profile | null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      profile: null as Profile | null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,organisation_id,access_enabled")
    .eq("user_id", user.id)
    .single();

  if (error || !data || !data.access_enabled) {
    return {
      profile: null as Profile | null,
      response: NextResponse.json({ error: "Profile access denied." }, { status: 403 }),
    };
  }

  return {
    profile: data as Profile,
    response: null as NextResponse | null,
  };
}

async function engagementIdFrom(context: any) {
  const params = await context?.params;
  return String(params?.id || "").trim();
}

async function verifyEngagement(
  supabase: ReturnType<typeof adminClient>,
  engagementId: string,
  organisationId: string,
) {
  const { data, error } = await supabase
    .from("afs_engagements")
    .select("id")
    .eq("id", engagementId)
    .eq("organisation_id", organisationId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
}

export async function GET(request: Request, context: any) {
  try {
    const engagementId = await engagementIdFrom(context);
    const supabase = adminClient();
    const { profile, response } = await currentProfile(request, supabase);
    if (response || !profile) return response;

    if (!profile.organisation_id) {
      return NextResponse.json(
        { error: "Your user is not linked to a practice." },
        { status: 400 },
      );
    }

    const allowed = await verifyEngagement(
      supabase,
      engagementId,
      profile.organisation_id,
    );

    if (!allowed) {
      return NextResponse.json({ error: "AFS engagement not found." }, { status: 404 });
    }

    const [
      { data: workflow, error: workflowError },
      { data: signoffs, error: signoffError },
      { data: reviewPoints, error: reviewError },
      { data: users, error: usersError },
      { data: applicabilityRows, error: applicabilityError },
    ] = await Promise.all([
      supabase
        .from("afs_engagement_workflow")
        .select(
          "workflow_levels,pilot_user_ids,first_officer_user_ids,captain_user_ids,is_started",
        )
        .eq("engagement_id", engagementId)
        .eq("organisation_id", profile.organisation_id)
        .maybeSingle(),

      supabase
        .from("afs_section_signoffs")
        .select(
          "section_key,prepared_by,prepared_at,reviewed_by,reviewed_at,captain_cleared_by,captain_cleared_at",
        )
        .eq("engagement_id", engagementId)
        .eq("organisation_id", profile.organisation_id),

      supabase
        .from("afs_review_points")
        .select("id,section_key,status")
        .eq("engagement_id", engagementId)
        .eq("organisation_id", profile.organisation_id),

      supabase
        .from("user_profiles")
        .select("id,full_name,email")
        .eq("organisation_id", profile.organisation_id),

      supabase
        .from("afs_section_applicability")
        .select("section_key,applicability,reason,set_by,set_at")
        .eq("engagement_id", engagementId)
        .eq("organisation_id", profile.organisation_id),
    ]);

    if (workflowError) throw workflowError;
    if (signoffError) throw signoffError;
    if (reviewError) throw reviewError;
    if (usersError) throw usersError;
    if (applicabilityError) throw applicabilityError;

    const names = Object.fromEntries(
      (users || []).map((user: any) => [
        user.id,
        user.full_name?.trim() || user.email,
      ]),
    );

    const signoffBySection = new Map(
      (signoffs || []).map((row: any) => [row.section_key, row]),
    );

    const applicabilityBySection = new Map(
      (applicabilityRows || []).map((row: any) => [row.section_key, row]),
    );

    const pointsBySection = new Map<
      string,
      { open: number; resolved: number; cleared: number }
    >();

    for (const point of reviewPoints || []) {
      const current = pointsBySection.get(point.section_key) || {
        open: 0,
        resolved: 0,
        cleared: 0,
      };

      if (point.status === "open") current.open += 1;
      if (point.status === "resolved") current.resolved += 1;
      if (point.status === "cleared") current.cleared += 1;

      pointsBySection.set(point.section_key, current);
    }

    const levels = Number(workflow?.workflow_levels || 2);

    const sections = SECTIONS.map((section) => {
      const signoff: any = signoffBySection.get(section.key) || null;
      const applicabilityRow: any = applicabilityBySection.get(section.key) || null;
      const applicability = (
        applicabilityRow?.applicability || section.defaultApplicability
      ) as Applicability;

      const points = pointsBySection.get(section.key) || {
        open: 0,
        resolved: 0,
        cleared: 0,
      };

      const prepared = Boolean(signoff?.prepared_at);
      const reviewed = Boolean(signoff?.reviewed_at);
      const captainCleared = Boolean(signoff?.captain_cleared_at);

      const complete =
        levels === 1
          ? captainCleared
          : prepared && reviewed && captainCleared;

      return {
        ...section,
        applicability,
        applicabilityReason: applicabilityRow?.reason || null,
        prepared,
        reviewed,
        captainCleared,
        complete,
        preparedBy: signoff?.prepared_by ? names[signoff.prepared_by] || null : null,
        reviewedBy: signoff?.reviewed_by ? names[signoff.reviewed_by] || null : null,
        captainBy: signoff?.captain_cleared_by
          ? names[signoff.captain_cleared_by] || null
          : null,
        reviewPoints: points,
      };
    });

    const requiredSections = sections.filter(
      (section) => section.applicability === "required",
    );

    const openReviewPoints = sections.reduce(
      (sum, section) => sum + section.reviewPoints.open,
      0,
    );

    const resolvedReviewPoints = sections.reduce(
      (sum, section) => sum + section.reviewPoints.resolved,
      0,
    );

    const preparedCount = requiredSections.filter((section) => section.prepared).length;
    const reviewedCount = requiredSections.filter((section) => section.reviewed).length;
    const captainCount = requiredSections.filter(
      (section) => section.captainCleared,
    ).length;
    const completeCount = requiredSections.filter((section) => section.complete).length;
    const notApplicableCount = sections.filter(
      (section) => section.applicability === "not_applicable",
    ).length;

    const readyForReview =
      Boolean(workflow?.is_started) &&
      requiredSections.length > 0 &&
      preparedCount === requiredSections.length;

    const readyForFinalisation =
      Boolean(workflow?.is_started) &&
      requiredSections.length > 0 &&
      completeCount === requiredSections.length &&
      openReviewPoints === 0;

    return NextResponse.json({
      workflow,
      sections,
      summary: {
        total: sections.length,
        requiredTotal: requiredSections.length,
        preparedCount,
        reviewedCount,
        captainCount,
        completeCount,
        notApplicableCount,
        openReviewPoints,
        resolvedReviewPoints,
        readyForReview,
        readyForFinalisation,
      },
    });
  } catch (error: any) {
    console.error("AFS FLIGHT CONTROL ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Could not load Flight Control." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: any) {
  try {
    const engagementId = await engagementIdFrom(context);
    const supabase = adminClient();
    const { profile, response } = await currentProfile(request, supabase);
    if (response || !profile) return response;

    if (!profile.organisation_id) {
      return NextResponse.json(
        { error: "Your user is not linked to a practice." },
        { status: 400 },
      );
    }

    const allowed = await verifyEngagement(
      supabase,
      engagementId,
      profile.organisation_id,
    );

    if (!allowed) {
      return NextResponse.json({ error: "AFS engagement not found." }, { status: 404 });
    }

    const body = await request.json();
    const sectionKey = String(body.sectionKey || "").trim();
    const applicability = String(body.applicability || "").trim() as Applicability;
    const reason = String(body.reason || "").trim() || null;

    const section = SECTIONS.find((item) => item.key === sectionKey);

    if (!section) {
      return NextResponse.json({ error: "Unknown AFS section." }, { status: 400 });
    }

    if (
      !["required", "conditional", "not_applicable", "optional"].includes(
        applicability,
      )
    ) {
      return NextResponse.json(
        { error: "Invalid applicability setting." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("afs_section_applicability")
      .upsert(
        {
          engagement_id: engagementId,
          organisation_id: profile.organisation_id,
          section_key: sectionKey,
          applicability,
          reason,
          set_by: profile.id,
          set_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "engagement_id,section_key" },
      )
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, applicability: data });
  } catch (error: any) {
    console.error("AFS FLIGHT CONTROL PATCH ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Could not update section applicability." },
      { status: 500 },
    );
  }
}
