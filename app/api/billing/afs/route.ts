// Path: app/api/billing/afs/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type UserProfile = {
  id: string;
  user_id: string;
  email: string;
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

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) throw new Error("Missing server Supabase key.");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isGlobalAdmin(role: string) {
  return role === "Super Admin" || role === "Admin";
}

function getBearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

async function getCurrentProfile(
  request: Request,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id,user_id,email,role,organisation_id,access_enabled")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json(
        { error: "Could not load user profile." },
        { status: 403 }
      ),
    };
  }

  const userProfile = profile as UserProfile;

  if (!userProfile.access_enabled) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json(
        { error: "User access is blocked." },
        { status: 403 }
      ),
    };
  }

  if (isGlobalAdmin(userProfile.role)) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json(
        { error: "PracticePilot administrators must use the AFS Billing Admin page." },
        { status: 403 }
      ),
    };
  }

  if (!userProfile.organisation_id) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json(
        { error: "Your user is not linked to an organisation." },
        { status: 403 }
      ),
    };
  }

  return { profile: userProfile, response: null as NextResponse | null };
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { profile, response } = await getCurrentProfile(request, supabase);

    if (response) return response;
    if (!profile?.organisation_id) {
      return NextResponse.json(
        { error: "Could not determine your organisation." },
        { status: 403 }
      );
    }

    const organisationId = profile.organisation_id;

    const { data: organisation, error: organisationError } = await supabase
      .from("organisations")
      .select(`
        id,
        name,
        afs_billing_enabled,
        afs_plan,
        afs_pricing_tier,
        afs_flex_monthly_fee,
        afs_flex_included_per_month,
        afs_flex_extra_price,
        afs_unlimited_user_price,
        afs_unlimited_licence_count,
        afs_free_credits_total
      `)
      .eq("id", organisationId)
      .single();

    if (organisationError || !organisation) {
      return NextResponse.json(
        { error: "Could not load your organisation." },
        { status: 404 }
      );
    }

    const { data: summaryData, error: summaryError } = await supabase
      .from("afs_billing_summary")
      .select("*")
      .eq("organisation_id", organisationId)
      .single();

    if (summaryError) {
      return NextResponse.json({ error: summaryError.message }, { status: 500 });
    }

    const { data: items, error: itemsError } = await supabase
      .from("afs_billing_events")
      .select(`
        id,
        engagement_id,
        client_id,
        client_name,
        financial_year_end,
        billing_plan,
        pricing_tier,
        charge_type,
        billing_amount,
        billing_status,
        invoice_number,
        triggered_at
      `)
      .eq("organisation_id", organisationId)
      .order("triggered_at", { ascending: false });

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    return NextResponse.json({
      organisation,
      summary: summaryData,
      items: items ?? [],
      canManagePlan: profile.role === "Client Manager",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load AFS billing.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { profile, response } = await getCurrentProfile(request, supabase);

    if (response) return response;
    if (!profile?.organisation_id) {
      return NextResponse.json(
        { error: "Could not determine your organisation." },
        { status: 403 }
      );
    }

    if (profile.role !== "Client Manager") {
      return NextResponse.json(
        { error: "Only the Client Manager can choose the AFS billing plan." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const plan = body?.plan;
    const licenceCount = Number(body?.licence_count || 0);

    if (plan !== "flex" && plan !== "unlimited") {
      return NextResponse.json(
        { error: "Choose either AFS Flex or AFS Unlimited." },
        { status: 400 }
      );
    }

    if (
      plan === "unlimited" &&
      (!Number.isInteger(licenceCount) || licenceCount < 1)
    ) {
      return NextResponse.json(
        { error: "Choose at least 1 Unlimited AFS licence." },
        { status: 400 }
      );
    }

    const organisationId = profile.organisation_id;

    const { data: organisation, error: organisationError } = await supabase
      .from("organisations")
      .select("id,afs_plan,afs_free_credits_total")
      .eq("id", organisationId)
      .single();

    if (organisationError || !organisation) {
      return NextResponse.json(
        { error: "Could not load your organisation." },
        { status: 404 }
      );
    }

    if (organisation.afs_plan) {
      return NextResponse.json(
        {
          error:
            "An AFS plan has already been selected. Contact PracticePilot to change plans.",
        },
        { status: 409 }
      );
    }

    const { count: freeCreditsUsed, error: freeCountError } = await supabase
      .from("afs_billing_events")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId)
      .eq("charge_type", "free_credit")
      .neq("billing_status", "cancelled");

    if (freeCountError) {
      return NextResponse.json(
        { error: freeCountError.message },
        { status: 500 }
      );
    }

    const freeRemaining = Math.max(
      Number(organisation.afs_free_credits_total || 2) -
        Number(freeCreditsUsed || 0),
      0
    );

    const activateNow = freeRemaining === 0;

    const { error: updateOrganisationError } = await supabase
      .from("organisations")
      .update({
        afs_plan: plan,
        afs_billing_enabled: activateNow,
        afs_unlimited_licence_count: plan === "unlimited" ? licenceCount : 0,
      })
      .eq("id", organisationId);

    if (updateOrganisationError) {
      return NextResponse.json(
        { error: updateOrganisationError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      plan,
      licenceCount: plan === "unlimited" ? licenceCount : 0,
      freeCreditsRemaining: freeRemaining,
      billingStartsNow: activateNow,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save AFS plan.",
      },
      { status: 500 }
    );
  }
}
