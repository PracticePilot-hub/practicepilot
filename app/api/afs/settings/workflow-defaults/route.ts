import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type UserProfile = {
  id: string;
  user_id: string;
  organisation_id: string | null;
  full_name: string | null;
  email: string;
  role: string;
  access_enabled: boolean;
  can_manage_practice_users?: boolean | null;
};

type SignoffDefault = "required" | "optional";

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

function optionalSectionDefaults(): Record<string, SignoffDefault> {
  return SECTION_KEYS.reduce<Record<string, SignoffDefault>>((result, key) => {
    result[key] = "optional";
    return result;
  }, {});
}

function cleanSectionDefaults(value: unknown): Record<string, SignoffDefault> {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return SECTION_KEYS.reduce<Record<string, SignoffDefault>>((result, key) => {
    result[key] = source[key] === "required" ? "required" : "optional";
    return result;
  }, {});
}

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
  return (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

function canManage(profile: UserProfile) {
  return (
    profile.role === "Super Admin" ||
    profile.role === "Admin" ||
    profile.role === "Client Manager" ||
    Boolean(profile.can_manage_practice_users)
  );
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
    .select("id,user_id,organisation_id,full_name,email,role,access_enabled,can_manage_practice_users")
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

export async function GET(request: Request) {
  try {
    const supabase = adminClient();
    const { profile, response } = await currentProfile(request, supabase);
    if (response) return response;

    if (!profile.organisation_id) {
      return NextResponse.json({ error: "Your user is not linked to a practice." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("organisations")
      .select("id,name,afs_workflow_mode,afs_default_workflow_levels,afs_allow_solo,afs_allow_three_level,afs_section_signoff_defaults")
      .eq("id", profile.organisation_id)
      .single();

    if (error) throw error;

    return NextResponse.json({
      organisation: {
        ...data,
        afs_section_signoff_defaults: cleanSectionDefaults(
          data?.afs_section_signoff_defaults || optionalSectionDefaults(),
        ),
      },
      canManage: canManage(profile),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not load AFS workflow defaults." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = adminClient();
    const { profile, response } = await currentProfile(request, supabase);
    if (response) return response;

    if (!profile.organisation_id) {
      return NextResponse.json({ error: "Your user is not linked to a practice." }, { status: 400 });
    }

    if (!canManage(profile)) {
      return NextResponse.json(
        { error: "You do not have permission to manage AFS workflow defaults." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const updatePayload: Record<string, unknown> = {};

    if (body.defaultWorkflowLevels !== undefined) {
      const levels = Number(body.defaultWorkflowLevels);
      if (![1, 2, 3].includes(levels)) {
        return NextResponse.json({ error: "Invalid default workflow level." }, { status: 400 });
      }
      updatePayload.afs_default_workflow_levels = levels;
    }

    if (body.allowSolo !== undefined) {
      updatePayload.afs_allow_solo = Boolean(body.allowSolo);
    }

    if (body.allowThreeLevel !== undefined) {
      updatePayload.afs_allow_three_level = Boolean(body.allowThreeLevel);
    }

    if (body.sectionSignoffDefaults !== undefined) {
      updatePayload.afs_section_signoff_defaults = cleanSectionDefaults(body.sectionSignoffDefaults);
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "No workflow settings were supplied." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("organisations")
      .update(updatePayload)
      .eq("id", profile.organisation_id)
      .select("id,name,afs_default_workflow_levels,afs_allow_solo,afs_allow_three_level,afs_section_signoff_defaults")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      organisation: {
        ...data,
        afs_section_signoff_defaults: cleanSectionDefaults(
          data?.afs_section_signoff_defaults || optionalSectionDefaults(),
        ),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not save AFS workflow defaults." },
      { status: 500 },
    );
  }
}
