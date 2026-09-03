import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "../../lib/supabaseServer";

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function isCaptain(authority: unknown) {
  return String(authority || "").trim().toLowerCase() === "captain";
}

async function currentProfile(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return {
      supabase: getSupabaseServer(),
      profile: null as any,
      response: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 },
      ),
    };
  }

  const supabase = getSupabaseServer();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      supabase,
      profile: null as any,
      response: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 },
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select(
      "id,user_id,organisation_id,role,access_enabled,can_access_afs,afs_authority",
    )
    .eq("user_id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    !profile.access_enabled ||
    profile.can_access_afs === false
  ) {
    return {
      supabase,
      profile: null as any,
      response: NextResponse.json(
        { error: "AFS access denied." },
        { status: 403 },
      ),
    };
  }

  if (!profile.organisation_id) {
    return {
      supabase,
      profile: null as any,
      response: NextResponse.json(
        { error: "Your user is not linked to a practice." },
        { status: 400 },
      ),
    };
  }

  return {
    supabase,
    profile,
    response: null as NextResponse | null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await currentProfile(req);

    if (auth.response) {
      return auth.response;
    }

    const { data: organisation, error } = await auth.supabase
      .from("organisations")
      .select(
        "id,afs_manual_adjustments_enabled,afs_manual_adjustments_acknowledged_by_profile_id,afs_manual_adjustments_acknowledged_at",
      )
      .eq("id", auth.profile.organisation_id)
      .single();

    if (error || !organisation) {
      throw error || new Error("Could not load practice AFS controls.");
    }

    return NextResponse.json({
      enabled: Boolean(organisation.afs_manual_adjustments_enabled),
      canManage: isCaptain(auth.profile.afs_authority),
      acknowledgedAt:
        organisation.afs_manual_adjustments_acknowledged_at || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message || "Could not load manual adjustment settings.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await currentProfile(req);

    if (auth.response) {
      return auth.response;
    }

    if (!isCaptain(auth.profile.afs_authority)) {
      return NextResponse.json(
        {
          error:
            "Only a Captain can change the practice-wide manual adjustment setting.",
        },
        { status: 403 },
      );
    }

    const body = await req.json();
    const enabled = Boolean(body.enabled);
    const acceptedRisk = body.acceptedRisk === true;

    if (enabled && !acceptedRisk) {
      return NextResponse.json(
        {
          error:
            "You must accept the manual-adjustment risk warning before enabling this feature.",
        },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      afs_manual_adjustments_enabled: enabled,
    };

    if (enabled) {
      updatePayload.afs_manual_adjustments_acknowledged_by_profile_id =
        auth.profile.id;
      updatePayload.afs_manual_adjustments_acknowledged_at = now;
    }

    const { data: organisation, error } = await auth.supabase
      .from("organisations")
      .update(updatePayload)
      .eq("id", auth.profile.organisation_id)
      .select(
        "id,afs_manual_adjustments_enabled,afs_manual_adjustments_acknowledged_by_profile_id,afs_manual_adjustments_acknowledged_at",
      )
      .single();

    if (error || !organisation) {
      throw error || new Error("Could not update practice AFS controls.");
    }

    return NextResponse.json({
      success: true,
      enabled: Boolean(organisation.afs_manual_adjustments_enabled),
      canManage: true,
      acknowledgedAt:
        organisation.afs_manual_adjustments_acknowledged_at || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message || "Could not update manual adjustment settings.",
      },
      { status: 500 },
    );
  }
}
