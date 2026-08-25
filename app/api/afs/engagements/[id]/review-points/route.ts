import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Authority = "Pilot" | "First Officer" | "Captain";

type Profile = {
  id: string;
  user_id: string;
  organisation_id: string | null;
  full_name: string | null;
  email: string;
  role: string;
  access_enabled: boolean;
  afs_authority?: Authority | null;
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
    .select(
      "id,user_id,organisation_id,full_name,email,role,access_enabled,afs_authority",
    )
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

function clean(value: unknown) {
  return String(value || "").trim();
}

function includesUser(ids: unknown, userId: string) {
  return Array.isArray(ids) && ids.map(String).includes(userId);
}

async function invalidateSectionSignoff(
  supabase: ReturnType<typeof adminClient>,
  engagementId: string,
  organisationId: string,
  sectionKey: string,
  profileId: string,
  reason: string,
) {
  const { data: existing, error: existingError } = await supabase
    .from("afs_section_signoffs")
    .select("id,prepared_at,reviewed_at,captain_cleared_at")
    .eq("engagement_id", engagementId)
    .eq("organisation_id", organisationId)
    .eq("section_key", sectionKey)
    .maybeSingle();

  if (existingError) throw existingError;

  if (
    !existing?.id ||
    (!existing.prepared_at &&
      !existing.reviewed_at &&
      !existing.captain_cleared_at)
  ) {
    return;
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("afs_section_signoffs")
    .update({
      prepared_by: null,
      prepared_at: null,
      reviewed_by: null,
      reviewed_at: null,
      captain_cleared_by: null,
      captain_cleared_at: null,
      reopened_by: profileId,
      reopened_at: now,
      reopen_reason: reason,
      updated_at: now,
    })
    .eq("id", existing.id);

  if (error) throw error;
}

export async function GET(request: Request, context: any) {
  try {
    const engagementId = await engagementIdFrom(context);
    const supabase = adminClient();
    const { profile, response } = await currentProfile(request, supabase);

    if (response) return response;

    if (!profile) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 },
      );
    }

    if (!profile.organisation_id) {
      return NextResponse.json(
        { error: "Your user is not linked to a practice." },
        { status: 400 },
      );
    }

    const url = new URL(request.url);
    const sectionKey = clean(url.searchParams.get("section"));

    let query = supabase
      .from("afs_review_points")
      .select("*")
      .eq("engagement_id", engagementId)
      .eq("organisation_id", profile.organisation_id)
      .order("raised_at", { ascending: false });

    if (sectionKey) {
      query = query.eq("section_key", sectionKey);
    }

    const [
      { data: points, error: pointsError },
      { data: workflow, error: workflowError },
      { data: users, error: usersError },
    ] = await Promise.all([
      query,
      supabase
        .from("afs_engagement_workflow")
        .select(
          "workflow_levels,pilot_user_ids,first_officer_user_ids,captain_user_ids,is_started",
        )
        .eq("engagement_id", engagementId)
        .eq("organisation_id", profile.organisation_id)
        .maybeSingle(),
      supabase
        .from("user_profiles")
        .select("id,full_name,email")
        .eq("organisation_id", profile.organisation_id),
    ]);

    if (pointsError) throw pointsError;
    if (workflowError) throw workflowError;
    if (usersError) throw usersError;

    const names = Object.fromEntries(
      (users || []).map((user: any) => [
        user.id,
        user.full_name?.trim() || user.email,
      ]),
    );

    return NextResponse.json({
      points: points || [],
      workflow,
      currentUserId: profile.id,
      names,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not load review points." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: any) {
  try {
    const engagementId = await engagementIdFrom(context);
    const supabase = adminClient();
    const { profile, response } = await currentProfile(request, supabase);

    if (response) return response;

    if (!profile) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 },
      );
    }

    if (!profile.organisation_id) {
      return NextResponse.json(
        { error: "Your user is not linked to a practice." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const sectionKey = clean(body.sectionKey);
    const title = clean(body.title);
    const detail = clean(body.detail);

    if (!sectionKey || !title) {
      return NextResponse.json(
        { error: "Section and review point are required." },
        { status: 400 },
      );
    }

    const { data: workflow, error: workflowError } = await supabase
      .from("afs_engagement_workflow")
      .select(
        "workflow_levels,pilot_user_ids,first_officer_user_ids,captain_user_ids,is_started",
      )
      .eq("engagement_id", engagementId)
      .eq("organisation_id", profile.organisation_id)
      .single();

    if (workflowError || !workflow?.is_started) {
      return NextResponse.json(
        { error: "Start the AFS flight before raising review points." },
        { status: 400 },
      );
    }

    const levels = Number(workflow.workflow_levels || 2);
    const isFirstOfficer = includesUser(workflow.first_officer_user_ids, profile.id);
    const isCaptain = includesUser(workflow.captain_user_ids, profile.id);

    const canRaise =
      levels === 2 ? isCaptain : levels === 3 ? isFirstOfficer || isCaptain : false;

    if (!canRaise) {
      return NextResponse.json(
        { error: "Only the assigned reviewer can raise a review point." },
        { status: 403 },
      );
    }

    const { data, error } = await supabase
      .from("afs_review_points")
      .insert({
        engagement_id: engagementId,
        organisation_id: profile.organisation_id,
        section_key: sectionKey,
        title,
        detail: detail || null,
        status: "open",
        raised_by: profile.id,
        raised_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) throw error;

    // Raising a fresh OPEN review point means the previous sign-off is stale.
    // Resolving the point later does NOT restore those old stamps; the work
    // must be signed off again after the correction has been dealt with.
    await invalidateSectionSignoff(
      supabase,
      engagementId,
      profile.organisation_id,
      sectionKey,
      profile.id,
      `Review point raised after sign-off: ${title}`,
    );

    return NextResponse.json({ success: true, point: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not create review point." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: any) {
  try {
    const engagementId = await engagementIdFrom(context);
    const supabase = adminClient();
    const { profile, response } = await currentProfile(request, supabase);

    if (response) return response;

    if (!profile) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 },
      );
    }

    if (!profile.organisation_id) {
      return NextResponse.json(
        { error: "Your user is not linked to a practice." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const pointId = clean(body.pointId);
    const action = clean(body.action);
    const resolutionNote = clean(body.resolutionNote);

    if (!pointId) {
      return NextResponse.json(
        { error: "Review point is required." },
        { status: 400 },
      );
    }

    const [
      { data: workflow, error: workflowError },
      { data: point, error: pointError },
    ] = await Promise.all([
      supabase
        .from("afs_engagement_workflow")
        .select(
          "workflow_levels,pilot_user_ids,first_officer_user_ids,captain_user_ids,is_started",
        )
        .eq("engagement_id", engagementId)
        .eq("organisation_id", profile.organisation_id)
        .single(),
      supabase
        .from("afs_review_points")
        .select("*")
        .eq("id", pointId)
        .eq("engagement_id", engagementId)
        .eq("organisation_id", profile.organisation_id)
        .single(),
    ]);

    if (workflowError) throw workflowError;
    if (pointError || !point) {
      return NextResponse.json(
        { error: "Review point not found." },
        { status: 404 },
      );
    }

    const levels = Number(workflow.workflow_levels || 2);
    const isPilot = includesUser(workflow.pilot_user_ids, profile.id);
    const isFirstOfficer = includesUser(workflow.first_officer_user_ids, profile.id);
    const isCaptain = includesUser(workflow.captain_user_ids, profile.id);

    const reviewer =
      levels === 2 ? isCaptain : levels === 3 ? isFirstOfficer || isCaptain : false;

    const now = new Date().toISOString();
    let patch: Record<string, any> = { updated_at: now };

    if (action === "resolve") {
      if (!isPilot && !isCaptain) {
        return NextResponse.json(
          { error: "Only an assigned Pilot can resolve this review point." },
          { status: 403 },
        );
      }

      if (point.status !== "open") {
        return NextResponse.json(
          { error: "Only open review points can be resolved." },
          { status: 400 },
        );
      }

      patch = {
        ...patch,
        status: "resolved",
        resolved_by: profile.id,
        resolved_at: now,
        resolution_note: resolutionNote || null,
        cleared_by: null,
        cleared_at: null,
      };
    } else if (action === "clear") {
      if (!reviewer) {
        return NextResponse.json(
          { error: "Only the assigned reviewer can clear this review point." },
          { status: 403 },
        );
      }

      if (point.status !== "resolved") {
        return NextResponse.json(
          { error: "The Pilot must resolve this point before it can be cleared." },
          { status: 400 },
        );
      }

      patch = {
        ...patch,
        status: "cleared",
        cleared_by: profile.id,
        cleared_at: now,
      };
    } else if (action === "reopen") {
      if (!reviewer) {
        return NextResponse.json(
          { error: "Only the assigned reviewer can reopen this review point." },
          { status: 403 },
        );
      }

      patch = {
        ...patch,
        status: "open",
        resolved_by: null,
        resolved_at: null,
        resolution_note: null,
        cleared_by: null,
        cleared_at: null,
      };

      // Reopening a previously resolved/cleared review point also makes the
      // current sign-off stale.
      await invalidateSectionSignoff(
        supabase,
        engagementId,
        profile.organisation_id,
        String(point.section_key),
        profile.id,
        `Review point reopened: ${String(point.title || "Review point")}`,
      );
    } else {
      return NextResponse.json(
        { error: "Unknown review-point action." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("afs_review_points")
      .update(patch)
      .eq("id", point.id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, point: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not update review point." },
      { status: 500 },
    );
  }
}
