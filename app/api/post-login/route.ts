// Path: app/api/post-login/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!serviceKey) throw new Error("Missing Supabase service-role key");

const admin = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function isPracticeRole(role: string | null | undefined) {
  return (
    role === "Super Admin" ||
    role === "Admin" ||
    role === "Client Manager" ||
    role === "Staff"
  );
}

export async function POST(request: Request) {
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

    const email = String(user.email || "").trim().toLowerCase();

    // Practice/staff users take priority.
    const { data: profile, error: profileError } = await admin
      .from("user_profiles")
      .select("id,user_id,role,access_enabled,email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (
      profile?.id &&
      profile.access_enabled !== false &&
      isPracticeRole(profile.role)
    ) {
      if (email === "christo.botha@cubechem.co.za") {
        return NextResponse.json({
          success: true,
          account_type: "practice",
          redirect_to: "/cubechem",
        });
      }

      return NextResponse.json({
        success: true,
        account_type: "practice",
        redirect_to: "/dashboard",
      });
    }

    // Client Portal users.
    let { data: portalRows, error: portalError } = await admin
      .from("crm_client_portal_users")
      .select(
        "id,client_id,organisation_id,email,is_active,invitation_status,auth_user_id"
      )
      .eq("auth_user_id", user.id)
      .eq("is_active", true);

    if (portalError) throw portalError;

    // Repair older portal records by authenticated email where auth_user_id
    // was never correctly linked.
    if ((!portalRows || portalRows.length === 0) && email) {
      const { data: emailRows, error: emailError } = await admin
        .from("crm_client_portal_users")
        .select(
          "id,client_id,organisation_id,email,is_active,invitation_status,auth_user_id"
        )
        .ilike("email", email)
        .eq("is_active", true);

      if (emailError) throw emailError;

      portalRows = emailRows || [];
    }

    if (portalRows?.length) {
      const now = new Date().toISOString();

      const { error: updateError } = await admin
        .from("crm_client_portal_users")
        .update({
          auth_user_id: user.id,
          invitation_status: "active",
          accepted_at: now,
          last_login_at: now,
          updated_at: now,
        })
        .in(
          "id",
          portalRows.map((row) => row.id)
        );

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        account_type: "client_portal",
        redirect_to: "/client-portal",
      });
    }

    if (profile?.id && profile.access_enabled === false) {
      return NextResponse.json(
        { error: "Your PracticePilot access has been disabled." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error:
          "This login is valid, but no PracticePilot workspace or Client Portal access is linked to it.",
      },
      { status: 403 }
    );
  } catch (error) {
    console.error("POST LOGIN ROUTER ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not route this PracticePilot login.",
      },
      { status: 500 }
    );
  }
}
