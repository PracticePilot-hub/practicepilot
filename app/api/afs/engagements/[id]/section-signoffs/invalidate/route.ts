import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type UserProfile = {
  id: string;
  user_id: string;
  organisation_id: string | null;
  role: string;
  access_enabled: boolean;
};

type CurrentProfileResult =
  | { profile: UserProfile; response: null }
  | { profile: null; response: NextResponse };

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!key) throw new Error("Missing Supabase service-role key.");

  return createClient(url, key, {
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
    .select("id,user_id,organisation_id,role,access_enabled")
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

async function engagementIdFrom(context: any) {
  const params = await context?.params;
  return String(params?.id || "").trim();
}

function cleanSectionKeys(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  ).slice(0, 100);
}

export async function POST(request: Request, context: any) {
  try {
    const engagementId = await engagementIdFrom(context);

    if (!engagementId) {
      return NextResponse.json(
        { error: "Engagement id is required." },
        { status: 400 },
      );
    }

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
    const sectionKeys = cleanSectionKeys(body.sectionKeys);
    const reason =
      String(body.reason || "").trim() ||
      "Automatically reopened because underlying work changed.";

    if (sectionKeys.length === 0) {
      return NextResponse.json(
        { error: "At least one section key is required." },
        { status: 400 },
      );
    }

    const { data: engagement, error: engagementError } = await supabase
      .from("afs_engagements")
      .select("id,status")
      .eq("id", engagementId)
      .single();

    if (engagementError || !engagement) {
      return NextResponse.json(
        { error: "AFS engagement not found." },
        { status: 404 },
      );
    }

    const engagementStatus = String(engagement.status || "")
      .trim()
      .toLowerCase();

    if (engagementStatus === "archived") {
      return NextResponse.json(
        { error: "Archived flights cannot be changed." },
        { status: 409 },
      );
    }

    if (engagementStatus === "final") {
      return NextResponse.json(
        { error: "Final flights must be reopened before changes are made." },
        { status: 409 },
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("afs_section_signoffs")
      .select(
        "id,section_key,prepared_at,reviewed_at,captain_cleared_at",
      )
      .eq("engagement_id", engagementId)
      .eq("organisation_id", profile.organisation_id)
      .in("section_key", sectionKeys);

    if (existingError) throw existingError;

    const signedRows = (existing || []).filter(
      (row: any) =>
        row.prepared_at ||
        row.reviewed_at ||
        row.captain_cleared_at,
    );

    if (signedRows.length === 0) {
      return NextResponse.json({
        success: true,
        invalidated: [],
        message: "No completed sign-offs required reopening.",
      });
    }

    const now = new Date().toISOString();
    const invalidated: string[] = [];

    for (const row of signedRows) {
      const { error } = await supabase
        .from("afs_section_signoffs")
        .update({
          prepared_by: null,
          prepared_at: null,
          reviewed_by: null,
          reviewed_at: null,
          captain_cleared_by: null,
          captain_cleared_at: null,
          reopened_by: profile.id,
          reopened_at: now,
          reopen_reason: reason,
          updated_at: now,
        })
        .eq("id", row.id);

      if (error) throw error;
      invalidated.push(String(row.section_key));
    }

    return NextResponse.json({
      success: true,
      invalidated,
      reopenedAt: now,
      reason,
    });
  } catch (error: any) {
    console.error("AFS SIGN-OFF INVALIDATE ERROR:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Could not reopen stale AFS sign-offs.",
      },
      { status: 500 },
    );
  }
}
