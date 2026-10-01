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

    const email = String(user.email || "")
      .trim()
      .toLowerCase();

    const { data: portalUser, error: portalUserError } =
      await admin
        .from("crm_client_portal_users")
        .select(
          "id,client_id,organisation_id,is_active,invitation_status"
        )
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

    if (portalUserError) throw portalUserError;

    if (!portalUser) {
      return NextResponse.json(
        { error: "No active client portal access is linked to this login." },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();

    const { error: updateError } = await admin
      .from("crm_client_portal_users")
      .update({
        invitation_status: "active",
        accepted_at: portalUser.invitation_status === "active"
          ? undefined
          : now,
        last_login_at: now,
        updated_at: now,
      })
      .eq("id", portalUser.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      client_id: portalUser.client_id,
      email,
    });
  } catch (error) {
    console.error("CLIENT PORTAL ACTIVATE ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not activate the client portal.",
      },
      { status: 500 }
    );
  }
}
