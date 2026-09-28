import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseServiceKey) throw new Error("Missing Supabase service-role key");

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await admin
      .from("user_profiles")
      .select("organisation_id,access_enabled,can_access_crm,role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      !profile.organisation_id ||
      profile.access_enabled === false
    ) {
      return NextResponse.json(
        { error: "CRM access denied." },
        { status: 403 }
      );
    }

    const globalRole = ["Super Admin", "Admin"].includes(
      String(profile.role || "")
    );

    if (!globalRole && profile.can_access_crm === false) {
      return NextResponse.json(
        { error: "CRM access denied." },
        { status: 403 }
      );
    }

    const { data: team, error: teamError } = await admin
      .from("user_profiles")
      .select("id,full_name,email,access_enabled")
      .eq("organisation_id", profile.organisation_id)
      .order("access_enabled", { ascending: false })
      .order("full_name", { ascending: true });

    if (teamError) throw teamError;

    return NextResponse.json({
      success: true,
      team: team || [],
    });
  } catch (error) {
    console.error("CRM TEAM DIRECTORY ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load the practice team.",
      },
      { status: 500 }
    );
  }
}
