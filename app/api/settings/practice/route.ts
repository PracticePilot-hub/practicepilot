import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type UserProfile = {
  id: string;
  user_id: string;
  organisation_id: string | null;
  role: string;
  access_enabled: boolean;
  can_manage_practice_users?: boolean | null;
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

function canManage(profile: UserProfile) {
  return (
    profile.role === "Super Admin" ||
    profile.role === "Admin" ||
    profile.role === "Client Manager" ||
    Boolean(profile.can_manage_practice_users)
  );
}

async function currentProfile(
  request: Request,
  supabase: ReturnType<typeof adminClient>,
) {
  const token = bearerToken(request);

  if (!token) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,user_id,organisation_id,role,access_enabled,can_manage_practice_users")
    .eq("user_id", user.id)
    .single();

  if (error || !data || !data.access_enabled) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json({ error: "Profile access denied." }, { status: 403 }),
    };
  }

  return {
    profile: data as UserProfile,
    response: null as NextResponse | null,
  };
}

export async function GET(request: Request) {
  try {
    const supabase = adminClient();
    const { profile, response } = await currentProfile(request, supabase);
    if (response) return response;

    if (!profile?.organisation_id) {
      return NextResponse.json(
        { error: "Your user is not linked to a practice." },
        { status: 400 },
      );
    }

    const [{ data: organisation, error: orgError }, { data: settings, error: settingsError }] =
      await Promise.all([
        supabase
          .from("organisations")
          .select("id,name")
          .eq("id", profile.organisation_id)
          .single(),
        supabase
          .from("practice_settings")
          .select("*")
          .eq("organisation_id", profile.organisation_id)
          .maybeSingle(),
      ]);

    if (orgError) throw orgError;
    if (settingsError) throw settingsError;

    return NextResponse.json({
      organisation,
      settings: settings || { organisation_id: profile.organisation_id },
      canManage: canManage(profile),
    });
  } catch (error: any) {
    console.error("PRACTICE SETTINGS GET ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Could not load practice settings." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = adminClient();
    const { profile, response } = await currentProfile(request, supabase);
    if (response) return response;

    if (!profile?.organisation_id) {
      return NextResponse.json(
        { error: "Your user is not linked to a practice." },
        { status: 400 },
      );
    }

    if (!canManage(profile)) {
      return NextResponse.json(
        { error: "You do not have permission to manage practice settings." },
        { status: 403 },
      );
    }

    const body = await request.json();

    const payload = {
      organisation_id: profile.organisation_id,
      firm_name: String(body.firm_name || "").trim() || null,
      trading_name: String(body.trading_name || "").trim() || null,
      logo_url: String(body.logo_url || "").trim() || null,
      address_lines: String(body.address_lines || "").trim() || null,
      telephone: String(body.telephone || "").trim() || null,
      email: String(body.email || "").trim() || null,
      website: String(body.website || "").trim() || null,
      authorised_signatory_name:
        String(body.authorised_signatory_name || "").trim() || null,
      authorised_signatory_professional_designation:
        String(body.authorised_signatory_professional_designation || "").trim() || null,
      authorised_signatory_registration_number:
        String(body.authorised_signatory_registration_number || "").trim() || null,
      authorised_signatory_position:
        String(body.authorised_signatory_position || "").trim() || null,
      authorised_signatory_signature_url:
        String(body.authorised_signatory_signature_url || "").trim() || null,
      governing_body_name:
        String(body.governing_body_name || "").trim() || null,
      governing_body_registration_number:
        String(body.governing_body_registration_number || "").trim() || null,
      governing_body_logo_url:
        String(body.governing_body_logo_url || "").trim() || null,
      second_governing_body_name:
        String(body.second_governing_body_name || "").trim() || null,
      second_governing_body_registration_number:
        String(body.second_governing_body_registration_number || "").trim() || null,
      second_governing_body_logo_url:
        String(body.second_governing_body_logo_url || "").trim() || null,
      footer_text: String(body.footer_text || "").trim() || null,
      footer_logo_url: String(body.footer_logo_url || "").trim() || null,
    };

    const { data, error } = await supabase
      .from("practice_settings")
      .upsert(payload, { onConflict: "organisation_id" })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, settings: data });
  } catch (error: any) {
    console.error("PRACTICE SETTINGS PATCH ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Could not save practice settings." },
      { status: 500 },
    );
  }
}
