import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type UserProfile = {
  id: string;
  user_id: string;
  role: string;
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
  if (!key) throw new Error("Missing Supabase service role key.");

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

function isGlobalAdmin(role: string) {
  return role === "Super Admin" || role === "Admin";
}

async function getId(context: any) {
  const params = await context.params;
  return String(params?.id || "");
}

async function currentProfile(
  request: Request,
  supabase: ReturnType<typeof adminClient>
) {
  const token = bearerToken(request);

  if (!token) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      ),
    };
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,user_id,role,organisation_id,access_enabled")
    .eq("user_id", user.id)
    .single();

  if (error || !data || !data.access_enabled) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json(
        { success: false, error: "Profile access denied." },
        { status: 403 }
      ),
    };
  }

  return {
    profile: data as UserProfile,
    response: null as NextResponse | null,
  };
}

async function loadEngagement(
  engagementId: string,
  supabase: ReturnType<typeof adminClient>
) {
  const { data, error } = await supabase
    .from("engagements")
    .select("id,organisation_id,contract_start_date")
    .eq("id", engagementId)
    .single();

  if (error || !data) {
    throw new Error("Engagement not found.");
  }

  return data;
}

function canAccessEngagement(profile: UserProfile, organisationId: string) {
  return (
    isGlobalAdmin(profile.role) ||
    Boolean(profile.organisation_id && profile.organisation_id === organisationId)
  );
}

export async function GET(request: Request, context: any) {
  try {
    const engagementId = await getId(context);
    const supabase = adminClient();

    const { profile, response } = await currentProfile(request, supabase);
    if (response) return response;
    if (!profile) throw new Error("Profile not found.");

    const engagement = await loadEngagement(engagementId, supabase);

    if (!canAccessEngagement(profile, engagement.organisation_id)) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this engagement." },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from("engagement_handover_letters")
      .select("*")
      .eq("engagement_id", engagementId)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      handover: data || null,
    });
  } catch (error: any) {
    console.error("LOAD HANDOVER LETTER ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unable to load handover letter.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: any) {
  try {
    const engagementId = await getId(context);
    const supabase = adminClient();

    const { profile, response } = await currentProfile(request, supabase);
    if (response) return response;
    if (!profile) throw new Error("Profile not found.");

    const engagement = await loadEngagement(engagementId, supabase);

    if (!canAccessEngagement(profile, engagement.organisation_id)) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this engagement." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const previousPractice = String(body?.previousPractice || "").trim();

    if (!previousPractice) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter the previous accountant or practice name.",
        },
        { status: 400 }
      );
    }

    const payload = {
      engagement_id: engagementId,
      organisation_id: engagement.organisation_id,
      previous_practice: previousPractice,
      previous_accountant_name:
        String(body?.previousAccountantName || "").trim() || null,
      previous_accountant_email:
        String(body?.previousAccountantEmail || "").trim() || null,
      takeover_date:
        String(body?.takeoverDate || engagement.contract_start_date || "").trim() ||
        null,
      document_date:
        String(body?.documentDate || "").trim() || null,
      notes: String(body?.notes || "").trim() || null,
      status: "Draft",
      created_by: profile.id,
    };

    const { data, error } = await supabase
      .from("engagement_handover_letters")
      .upsert(payload, { onConflict: "engagement_id" })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      handover: data,
    });
  } catch (error: any) {
    console.error("SAVE HANDOVER LETTER ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unable to save handover letter.",
      },
      { status: 500 }
    );
  }
}
