import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "../../../lib/supabaseServer";

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

async function currentProfile(
  request: Request,
  supabase: ReturnType<typeof getSupabaseServer>,
) {
  const token = bearerToken(request);

  if (!token) {
    return {
      profile: null as any,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      profile: null as any,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select(
      "id,user_id,organisation_id,full_name,email,role,access_enabled,can_access_afs,afs_authority",
    )
    .eq("user_id", user.id)
    .single();

  if (
    error ||
    !profile ||
    !profile.access_enabled ||
    profile.can_access_afs === false
  ) {
    return {
      profile: null as any,
      response: NextResponse.json({ error: "AFS access denied." }, { status: 403 }),
    };
  }

  if (!profile.organisation_id) {
    return {
      profile: null as any,
      response: NextResponse.json(
        { error: "Your user is not linked to a practice." },
        { status: 400 },
      ),
    };
  }

  return { profile, response: null as NextResponse | null };
}

function canManage(profile: any) {
  return (
    String(profile?.afs_authority || "") === "Captain" ||
    ["Super Admin", "Admin"].includes(String(profile?.role || ""))
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = getSupabaseServer();
    const auth = await currentProfile(request, supabase);

    if (auth.response) return auth.response;
    if (!auth.profile) {
      return NextResponse.json(
        { error: "Profile access denied." },
        { status: 403 },
      );
    }

    const { data: organisation, error } = await supabase
      .from("organisations")
      .select(
        "id,afs_manual_adjustments_enabled,afs_manual_adjustments_updated_at,afs_manual_adjustments_updated_by",
      )
      .eq("id", auth.profile.organisation_id)
      .single();

    if (error || !organisation) {
      throw error || new Error("Could not load AFS controls.");
    }

    return NextResponse.json({
      enabled: Boolean(organisation.afs_manual_adjustments_enabled),
      canManage: canManage(auth.profile),
      authority: auth.profile.afs_authority || null,
      updatedAt: organisation.afs_manual_adjustments_updated_at || null,
      updatedBy: organisation.afs_manual_adjustments_updated_by || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not load manual-adjustment settings." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = getSupabaseServer();
    const auth = await currentProfile(request, supabase);

    if (auth.response) return auth.response;
    if (!auth.profile) {
      return NextResponse.json(
        { error: "Profile access denied." },
        { status: 403 },
      );
    }

    if (!canManage(auth.profile)) {
      return NextResponse.json(
        { error: "Only a Captain can change the manual-adjustment control." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const enabled = Boolean(body.enabled);
    const now = new Date().toISOString();

    const { data: organisation, error } = await supabase
      .from("organisations")
      .update({
        afs_manual_adjustments_enabled: enabled,
        afs_manual_adjustments_updated_at: now,
        afs_manual_adjustments_updated_by: auth.profile.id,
      })
      .eq("id", auth.profile.organisation_id)
      .select(
        "id,afs_manual_adjustments_enabled,afs_manual_adjustments_updated_at,afs_manual_adjustments_updated_by",
      )
      .single();

    if (error || !organisation) {
      throw error || new Error("Could not update AFS controls.");
    }

    return NextResponse.json({
      enabled: Boolean(organisation.afs_manual_adjustments_enabled),
      canManage: true,
      updatedAt: organisation.afs_manual_adjustments_updated_at,
      updatedBy: organisation.afs_manual_adjustments_updated_by,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not update manual-adjustment settings." },
      { status: 500 },
    );
  }
}
