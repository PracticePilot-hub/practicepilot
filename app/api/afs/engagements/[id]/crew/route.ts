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
  can_manage_practice_users?: boolean | null;
};

type CurrentProfileResult =
  | { profile: UserProfile; response: null }
  | { profile: null; response: NextResponse };

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) throw new Error("Missing Supabase service-role key.");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function canManageCrew(profile: UserProfile) {
  return (
    profile.role === "Super Admin" ||
    profile.role === "Admin" ||
    profile.role === "Client Manager" ||
    profile.afs_authority === "Captain" ||
    Boolean(profile.can_manage_practice_users)
  );
}

async function getCurrentProfile(
  request: Request,
  supabase: ReturnType<typeof getSupabaseAdmin>,
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
      "id,user_id,organisation_id,full_name,email,role,access_enabled,can_access_afs,afs_authority,can_manage_practice_users",
    )
    .eq("user_id", user.id)
    .single();

  if (error || !data || !data.access_enabled) {
    return {
      profile: null,
      response: NextResponse.json({ error: "Profile access denied." }, { status: 403 }),
    };
  }

  return {
    profile: data as UserProfile,
    response: null,
  };
}

async function getEngagementId(context: any) {
  const params = await context?.params;
  return String(params?.id || "").trim();
}

function cleanUserId(value: unknown) {
  const cleaned = String(value || "").trim();
  return cleaned || null;
}

async function validateCrewUser(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  organisationId: string,
  userId: string | null,
  requiredAuthority?: Authority,
) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,organisation_id,access_enabled,can_access_afs,afs_authority")
    .eq("id", userId)
    .single();

  if (error || !data) throw new Error("Selected AFS crew member was not found.");

  if (
    data.organisation_id !== organisationId ||
    !data.access_enabled ||
    data.can_access_afs === false
  ) {
    throw new Error("Selected AFS crew member is not available to this practice.");
  }

  if (requiredAuthority === "First Officer") {
    if (!["First Officer", "Captain"].includes(String(data.afs_authority || ""))) {
      throw new Error("The First Officer must have First Officer or Captain authority.");
    }
  }

  if (requiredAuthority === "Captain") {
    if (String(data.afs_authority || "") !== "Captain") {
      throw new Error("The Captain must have Captain authority.");
    }
  }

  return userId;
}

export async function GET(request: Request, context: any) {
  try {
    const engagementId = await getEngagementId(context);
    if (!engagementId) {
      return NextResponse.json({ error: "Engagement id is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { profile, response } = await getCurrentProfile(request, supabase);
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
      { data: crew, error: crewError },
    ] = await Promise.all([
      supabase
        .from("organisations")
        .select("id,name,afs_workflow_mode")
        .eq("id", profile.organisation_id)
        .single(),
      supabase
        .from("user_profiles")
        .select("id,full_name,email,role,afs_authority,access_enabled,can_access_afs")
        .eq("organisation_id", profile.organisation_id)
        .eq("access_enabled", true)
        .order("full_name", { ascending: true }),
      supabase
        .from("afs_engagement_crew")
        .select("*")
        .eq("engagement_id", engagementId)
        .eq("organisation_id", profile.organisation_id)
        .maybeSingle(),
    ]);

    if (orgError) throw orgError;
    if (usersError) throw usersError;
    if (crewError) throw crewError;

    const afsUsers = (users || []).filter(
      (user: any) => user.can_access_afs !== false,
    );

    const defaultCaptain =
      afsUsers.find((user: any) => user.role === "Client Manager") ||
      afsUsers.find((user: any) => user.afs_authority === "Captain") ||
      null;

    const defaultPilot =
      afsUsers.find((user: any) => user.id === profile.id) || null;

    return NextResponse.json({
      workflowMode:
        organisation?.afs_workflow_mode === "team" ? "team" : "solo",
      canManageCrew: canManageCrew(profile),
      currentUserId: profile.id,
      users: afsUsers,
      crew: crew || {
        pilot_user_id: defaultPilot?.id || null,
        first_officer_user_id: null,
        captain_user_id: defaultCaptain?.id || null,
      },
    });
  } catch (error: any) {
    console.error("AFS CREW GET ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Could not load AFS crew." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: any) {
  try {
    const engagementId = await getEngagementId(context);
    if (!engagementId) {
      return NextResponse.json({ error: "Engagement id is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { profile, response } = await getCurrentProfile(request, supabase);
    if (response) return response;

    if (!profile.organisation_id) {
      return NextResponse.json(
        { error: "Your user is not linked to a practice." },
        { status: 400 },
      );
    }

    if (!canManageCrew(profile)) {
      return NextResponse.json(
        { error: "Only a Captain or authorised practice manager can assign the AFS crew." },
        { status: 403 },
      );
    }

    const body = await request.json();

    const pilotUserId = await validateCrewUser(
      supabase,
      profile.organisation_id,
      cleanUserId(body.pilotUserId),
    );

    const firstOfficerUserId = await validateCrewUser(
      supabase,
      profile.organisation_id,
      cleanUserId(body.firstOfficerUserId),
      "First Officer",
    );

    const captainUserId = await validateCrewUser(
      supabase,
      profile.organisation_id,
      cleanUserId(body.captainUserId),
      "Captain",
    );

    const payload = {
      engagement_id: engagementId,
      organisation_id: profile.organisation_id,
      pilot_user_id: pilotUserId,
      first_officer_user_id: firstOfficerUserId,
      captain_user_id: captainUserId,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: lookupError } = await supabase
      .from("afs_engagement_crew")
      .select("id")
      .eq("engagement_id", engagementId)
      .eq("organisation_id", profile.organisation_id)
      .maybeSingle();

    if (lookupError) throw lookupError;

    let savedCrew: any = null;

    if (existing?.id) {
      const { data, error } = await supabase
        .from("afs_engagement_crew")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();

      if (error) throw error;
      savedCrew = data;
    } else {
      const { data, error } = await supabase
        .from("afs_engagement_crew")
        .insert({
          ...payload,
          created_by: profile.id,
        })
        .select("*")
        .single();

      if (error) throw error;
      savedCrew = data;
    }

    return NextResponse.json({
      success: true,
      crew: savedCrew,
    });
  } catch (error: any) {
    console.error("AFS CREW PATCH ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Could not save AFS crew." },
      { status: 500 },
    );
  }
}
