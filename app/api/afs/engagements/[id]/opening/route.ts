import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Authority = "Pilot" | "First Officer" | "Captain";

type UserProfile = {
  id: string;
  user_id: string;
  organisation_id: string | null;
  full_name: string | null;
  email: string;
  role: string;
  access_enabled: boolean;
  can_access_afs?: boolean;
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

type CurrentProfileResult =
  | { profile: UserProfile; response: null }
  | { profile: null; response: NextResponse };

async function currentProfile(
  request: Request,
  supabase: ReturnType<typeof adminClient>,
): Promise<CurrentProfileResult> {
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
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      profile: null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "id,user_id,organisation_id,full_name,email,role,access_enabled,can_access_afs,afs_authority",
    )
    .eq("user_id", user.id)
    .single();

  if (error || !data || !data.access_enabled) {
    return {
      profile: null,
      response: NextResponse.json({ error: "Profile access denied." }, { status: 403 }),
    };
  }

  return { profile: data as UserProfile, response: null };
}

async function getEngagementId(context: any) {
  const params = await context?.params;
  return String(params?.id || "").trim();
}

function cleanIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
}

function rank(authority: Authority | null | undefined) {
  if (authority === "Captain") return 3;
  if (authority === "First Officer") return 2;
  return 1;
}

type SectionApplicability =
  | "required"
  | "conditional"
  | "not_applicable"
  | "optional";

const SECTION_KEYS = [
  "client-setup",
  "trial-balance",
  "adjusting-journals",
  "mapping",
  "lead-schedules",
  "tax-calculator",
  "financial-statements",
  "minutes",
  "export-print",
] as const;

function cleanPracticeSectionDefaults(
  value: unknown,
): Record<string, SectionApplicability> {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return SECTION_KEYS.reduce<Record<string, SectionApplicability>>(
    (result, key) => {
      result[key] = source[key] === "required" ? "required" : "optional";
      return result;
    },
    {},
  );
}

export async function GET(request: Request, context: any) {
  try {
    const engagementId = await getEngagementId(context);
    const supabase = adminClient();
    const { profile, response } = await currentProfile(request, supabase);
    if (response) return response;

    if (!profile.organisation_id) {
      return NextResponse.json(
        { error: "Your user is not linked to a practice." },
        { status: 400 },
      );
    }

    const [
      { data: organisation, error: orgError },
      { data: users, error: usersError },
      { data: workflow, error: workflowError },
    ] = await Promise.all([
      supabase
        .from("organisations")
        .select(
          "id,name,afs_default_workflow_levels,afs_allow_solo,afs_allow_three_level,afs_section_signoff_defaults",
        )
        .eq("id", profile.organisation_id)
        .single(),
      supabase
        .from("user_profiles")
        .select(
          "id,full_name,email,role,afs_authority,access_enabled,can_access_afs",
        )
        .eq("organisation_id", profile.organisation_id)
        .eq("access_enabled", true)
        .order("full_name", { ascending: true }),
      supabase
        .from("afs_engagement_workflow")
        .select("*")
        .eq("engagement_id", engagementId)
        .eq("organisation_id", profile.organisation_id)
        .maybeSingle(),
    ]);

    if (orgError) throw orgError;
    if (usersError) throw usersError;
    if (workflowError) throw workflowError;

    const afsUsers = (users || []).filter((user: any) => user.can_access_afs !== false);

    return NextResponse.json({
      currentUser: profile,
      organisation,
      users: afsUsers,
      workflow: workflow || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not load flight opening setup." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: any) {
  try {
    const engagementId = await getEngagementId(context);
    const supabase = adminClient();
    const { profile, response } = await currentProfile(request, supabase);
    if (response) return response;

    if (!profile.organisation_id) {
      return NextResponse.json(
        { error: "Your user is not linked to a practice." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const levels = Number(body.workflowLevels);
    const pilotUserIds = cleanIds(body.pilotUserIds);
    const firstOfficerUserIds = cleanIds(body.firstOfficerUserIds);
    const captainUserIds = cleanIds(body.captainUserIds);

    const { data: organisation, error: orgError } = await supabase
      .from("organisations")
      .select("afs_allow_solo,afs_allow_three_level,afs_section_signoff_defaults")
      .eq("id", profile.organisation_id)
      .single();

    if (orgError) throw orgError;

    if (![1, 2, 3].includes(levels)) {
      return NextResponse.json({ error: "Invalid workflow level." }, { status: 400 });
    }

    if (levels === 1 && !organisation.afs_allow_solo) {
      return NextResponse.json({ error: "Solo flights are disabled for this practice." }, { status: 400 });
    }

    if (levels === 3 && !organisation.afs_allow_three_level) {
      return NextResponse.json({ error: "Three-level flights are disabled for this practice." }, { status: 400 });
    }

    const { data: selectedUsers, error: usersError } = await supabase
      .from("user_profiles")
      .select("id,organisation_id,access_enabled,can_access_afs,afs_authority")
      .in(
        "id",
        [...new Set([...pilotUserIds, ...firstOfficerUserIds, ...captainUserIds])],
      );

    if (usersError) throw usersError;

    const byId = new Map((selectedUsers || []).map((user: any) => [user.id, user]));

    for (const id of [...pilotUserIds, ...firstOfficerUserIds, ...captainUserIds]) {
      const user = byId.get(id);
      if (
        !user ||
        user.organisation_id !== profile.organisation_id ||
        !user.access_enabled ||
        user.can_access_afs === false
      ) {
        return NextResponse.json(
          { error: "One or more selected crew members are not available to this practice." },
          { status: 400 },
        );
      }
    }

    for (const id of firstOfficerUserIds) {
      const user = byId.get(id);
      if (rank(user?.afs_authority) < 2) {
        return NextResponse.json(
          { error: "A First Officer must have First Officer or Captain authority." },
          { status: 400 },
        );
      }
    }

    for (const id of captainUserIds) {
      const user = byId.get(id);
      if (rank(user?.afs_authority) < 3) {
        return NextResponse.json(
          { error: "A Captain must have Captain authority." },
          { status: 400 },
        );
      }
    }

    const openerRank = rank(profile.afs_authority);

    if (levels === 1) {
      if (openerRank < 3) {
        return NextResponse.json(
          { error: "Only a Captain can start a Solo flight." },
          { status: 403 },
        );
      }

      if (!pilotUserIds.includes(profile.id) || !captainUserIds.includes(profile.id)) {
        return NextResponse.json(
          { error: "A Solo flight must assign the opener as both Pilot and Captain." },
          { status: 400 },
        );
      }
    }

    if (levels === 2) {
      if (pilotUserIds.length === 0 || captainUserIds.length === 0) {
        return NextResponse.json(
          { error: "A 2-level flight requires at least one Pilot and one Captain." },
          { status: 400 },
        );
      }

      if (openerRank === 1 && captainUserIds.length === 0) {
        return NextResponse.json(
          { error: "A Pilot opening a flight must assign a Captain." },
          { status: 400 },
        );
      }
    }

    if (levels === 3) {
      if (
        pilotUserIds.length === 0 ||
        firstOfficerUserIds.length === 0 ||
        captainUserIds.length === 0
      ) {
        return NextResponse.json(
          { error: "A 3-level flight requires a Pilot, First Officer and Captain." },
          { status: 400 },
        );
      }

      if (openerRank === 1 && (firstOfficerUserIds.length === 0 || captainUserIds.length === 0)) {
        return NextResponse.json(
          { error: "A Pilot opening a 3-level flight must assign both a First Officer and Captain." },
          { status: 400 },
        );
      }

      if (openerRank === 2 && captainUserIds.length === 0) {
        return NextResponse.json(
          { error: "A First Officer opening a 3-level flight must assign a Captain." },
          { status: 400 },
        );
      }
    }

    const payload = {
      engagement_id: engagementId,
      organisation_id: profile.organisation_id,
      workflow_levels: levels,
      pilot_user_ids: pilotUserIds,
      first_officer_user_ids: levels === 3 ? firstOfficerUserIds : [],
      captain_user_ids: captainUserIds,
      opened_by: profile.id,
      opened_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      is_started: true,
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: existingError } = await supabase
      .from("afs_engagement_workflow")
      .select("id,is_started")
      .eq("engagement_id", engagementId)
      .eq("organisation_id", profile.organisation_id)
      .maybeSingle();

    if (existingError) throw existingError;

    let saved;

    const isFirstStart = !existing?.id || existing.is_started !== true;

    if (existing?.id) {
      const { data, error } = await supabase
        .from("afs_engagement_workflow")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();

      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await supabase
        .from("afs_engagement_workflow")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw error;
      saved = data;
    }

    if (isFirstStart) {
      const practiceDefaults = cleanPracticeSectionDefaults(
        organisation.afs_section_signoff_defaults,
      );

      const applicabilityRows = SECTION_KEYS.map((sectionKey) => ({
        engagement_id: engagementId,
        organisation_id: profile.organisation_id,
        section_key: sectionKey,
        applicability: practiceDefaults[sectionKey],
        reason: "Practice default at flight start",
        set_by: profile.id,
        set_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error: applicabilityError } = await supabase
        .from("afs_section_applicability")
        .upsert(applicabilityRows, {
          onConflict: "engagement_id,section_key",
          ignoreDuplicates: true,
        });

      if (applicabilityError) throw applicabilityError;
    }

    return NextResponse.json({
      success: true,
      workflow: saved,
      practiceStandardsApplied: isFirstStart,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not start the flight." },
      { status: 500 },
    );
  }
}
