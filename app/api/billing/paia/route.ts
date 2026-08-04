// Path: app/api/billing/paia/route.ts

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
  can_access_paia?: boolean;
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

function isGlobalAdmin(role: string) {
  return role === "Super Admin" || role === "Admin";
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  return authHeader.replace(/^Bearer\s+/i, "").trim();
}

async function getCurrentProfile(
  request: Request,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select(
      `
        id,
        user_id,
        email,
        role,
        organisation_id,
        access_enabled,
        can_access_paia
      `
    )
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
        {
          error:
            "PracticePilot administrators must use the PAIA Billing Admin page.",
        },
        { status: 403 }
      ),
    };
  }

  if (!userProfile.can_access_paia) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json(
        { error: "No access to PAIA billing." },
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

  return {
    profile: userProfile,
    response: null as NextResponse | null,
  };
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();

    const { profile, response } = await getCurrentProfile(
      request,
      supabase
    );

    if (response) {
      return response;
    }

    if (!profile?.organisation_id) {
      return NextResponse.json(
        { error: "Could not determine your organisation." },
        { status: 403 }
      );
    }

    const { data: organisation, error: organisationError } = await supabase
      .from("organisations")
      .select(
        `
          id,
          name,
          paia_manual_price,
          paia_billing_enabled
        `
      )
      .eq("id", profile.organisation_id)
      .single();

    if (organisationError || !organisation) {
      return NextResponse.json(
        { error: "Could not load your organisation." },
        { status: 404 }
      );
    }

    const { data: items, error: itemsError } = await supabase
      .from("paia_manuals")
      .select(
        `
          id,
          entity_name,
          entity_registration_number,
          created_at,
          is_free_manual,
          billing_amount,
          billing_status,
          invoice_number,
          invoiced_at
        `
      )
      .eq("client_id", profile.organisation_id)
      .order("created_at", { ascending: false });

    if (itemsError) {
      return NextResponse.json(
        { error: itemsError.message },
        { status: 500 }
      );
    }

    const billingItems = items ?? [];

    const summary = billingItems.reduce(
      (totals, item) => {
        const amount = Number(item.billing_amount || 0);
        const status = String(item.billing_status || "").toLowerCase();

        totals.totalManuals += 1;
        totals.totalCharges += amount;

        if (item.is_free_manual || status === "free") {
          totals.freeManuals += 1;
        }

        if (status === "uninvoiced") {
          totals.uninvoicedAmount += amount;
          totals.uninvoicedManuals += 1;
        }

        if (status === "invoiced") {
          totals.invoicedAmount += amount;
          totals.invoicedManuals += 1;
        }

        if (status === "paid") {
          totals.paidAmount += amount;
          totals.paidManuals += 1;
        }

        return totals;
      },
      {
        totalManuals: 0,
        freeManuals: 0,
        totalCharges: 0,
        uninvoicedAmount: 0,
        uninvoicedManuals: 0,
        invoicedAmount: 0,
        invoicedManuals: 0,
        paidAmount: 0,
        paidManuals: 0,
      }
    );

    return NextResponse.json({
      organisation,
      items: billingItems,
      summary,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load PAIA billing.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
