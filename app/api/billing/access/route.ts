// Path: app/api/billing/access/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type UserProfile = {
  user_id: string;
  role: string;
  organisation_id: string | null;
  access_enabled: boolean;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Missing server Supabase key. Add SUPABASE_SERVICE_ROLE_KEY in Vercel and redeploy."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  return authHeader.replace(/^Bearer\s+/i, "").trim();
}

function isAdminRole(role: string) {
  return role === "Super Admin" || role === "Admin";
}

export async function GET(request: Request) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          authenticated: false,
          billing_access_suspended: false,
          billing_suspension_reason: null,
        },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        {
          authenticated: false,
          billing_access_suspended: false,
          billing_suspension_reason: null,
        },
        { status: 401 }
      );
    }

    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select(
        `
          user_id,
          role,
          organisation_id,
          access_enabled
        `
      )
      .eq("user_id", user.id)
      .single();

    if (profileError || !profileData) {
      return NextResponse.json(
        {
          authenticated: true,
          billing_access_suspended: false,
          billing_suspension_reason: null,
          error: "Could not load user profile.",
        },
        { status: 403 }
      );
    }

    const profile = profileData as UserProfile;

    if (!profile.access_enabled) {
      return NextResponse.json(
        {
          authenticated: true,
          billing_access_suspended: true,
          billing_suspension_reason: "User access is disabled.",
        },
        { status: 403 }
      );
    }

    if (isAdminRole(profile.role)) {
      return NextResponse.json({
        authenticated: true,
        admin_bypass: true,
        billing_access_suspended: false,
        billing_suspension_reason: null,
      });
    }

    if (!profile.organisation_id) {
      return NextResponse.json({
        authenticated: true,
        admin_bypass: false,
        billing_access_suspended: false,
        billing_suspension_reason: null,
      });
    }

    const { data: organisationData, error: organisationError } =
      await supabase
        .from("organisations")
        .select(
          `
            id,
            billing_access_suspended,
            billing_suspension_reason
          `
        )
        .eq("id", profile.organisation_id)
        .single();

    if (organisationError || !organisationData) {
      return NextResponse.json(
        {
          authenticated: true,
          billing_access_suspended: false,
          billing_suspension_reason: null,
          error: "Could not load organisation billing access.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      admin_bypass: false,
      organisation_id: profile.organisation_id,
      billing_access_suspended: Boolean(
        organisationData.billing_access_suspended
      ),
      billing_suspension_reason:
        organisationData.billing_suspension_reason || null,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not check billing access.";

    return NextResponse.json(
      {
        authenticated: true,
        billing_access_suspended: false,
        billing_suspension_reason: null,
        error: message,
      },
      { status: 500 }
    );
  }
}
