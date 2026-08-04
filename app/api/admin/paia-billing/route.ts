// Path: app/api/admin/paia-billing/route.ts

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
        access_enabled
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

  if (!isGlobalAdmin(userProfile.role)) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json(
        { error: "PracticePilot administrator access is required." },
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

    const { response } = await getCurrentProfile(request, supabase);

    if (response) {
      return response;
    }

    const url = new URL(request.url);
    const organisationId = String(
      url.searchParams.get("organisationId") || ""
    ).trim();
    const billingStatus = String(
      url.searchParams.get("status") || ""
    ).trim();
    const dateFrom = String(url.searchParams.get("dateFrom") || "").trim();
    const dateTo = String(url.searchParams.get("dateTo") || "").trim();

    const { data: organisations, error: organisationsError } = await supabase
      .from("organisations")
      .select(
        `
          id,
          name,
          status,
          access_enabled,
          paia_manual_price,
          paia_billing_enabled
        `
      )
      .order("name", { ascending: true });

    if (organisationsError) {
      return NextResponse.json(
        { error: organisationsError.message },
        { status: 500 }
      );
    }

    let query = supabase
      .from("paia_manuals")
      .select(
        `
          id,
          client_id,
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
      .order("created_at", { ascending: false });

    if (organisationId) {
      query = query.eq("client_id", organisationId);
    }

    if (billingStatus) {
      if (billingStatus === "free") {
        query = query.eq("is_free_manual", true);
      } else {
        query = query.eq("billing_status", billingStatus);
      }
    }

    if (dateFrom) {
      query = query.gte("created_at", `${dateFrom}T00:00:00.000Z`);
    }

    if (dateTo) {
      query = query.lte("created_at", `${dateTo}T23:59:59.999Z`);
    }

    const { data: items, error: itemsError } = await query;

    if (itemsError) {
      return NextResponse.json(
        { error: itemsError.message },
        { status: 500 }
      );
    }

    const organisationMap = new Map(
      (organisations ?? []).map((organisation) => [
        organisation.id,
        organisation.name,
      ])
    );

    const billingItems = (items ?? []).map((item) => ({
      ...item,
      organisation_name:
        organisationMap.get(item.client_id) || "Unknown organisation",
    }));

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
      organisations: organisations ?? [],
      items: billingItems,
      summary,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load PAIA billing administration.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();

    const { response } = await getCurrentProfile(request, supabase);

    if (response) {
      return response;
    }

    const body = await request.json();

    const manualIds = Array.isArray(body.manual_ids)
      ? body.manual_ids
          .map((value: unknown) => String(value || "").trim())
          .filter(Boolean)
      : [];

    const invoiceNumber = String(body.invoice_number || "").trim();
    const invoicedAt = String(body.invoiced_at || "").trim();

    if (!manualIds.length) {
      return NextResponse.json(
        { error: "Select at least one PAIA manual." },
        { status: 400 }
      );
    }

    if (!invoiceNumber) {
      return NextResponse.json(
        { error: "Invoice number is required." },
        { status: 400 }
      );
    }

    const invoiceDateTime = invoicedAt
      ? new Date(`${invoicedAt}T12:00:00.000Z`).toISOString()
      : new Date().toISOString();

    const { data: eligibleItems, error: eligibleError } = await supabase
      .from("paia_manuals")
      .select("id, client_id, billing_status, is_free_manual")
      .in("id", manualIds);

    if (eligibleError) {
      return NextResponse.json(
        { error: eligibleError.message },
        { status: 500 }
      );
    }

    const selectedItems = eligibleItems ?? [];

    if (selectedItems.length !== manualIds.length) {
      return NextResponse.json(
        { error: "One or more selected manuals could not be found." },
        { status: 400 }
      );
    }

    const organisationIds = new Set(
      selectedItems.map((item) => item.client_id)
    );

    if (organisationIds.size !== 1) {
      return NextResponse.json(
        {
          error:
            "An invoice batch may only contain manuals from one organisation.",
        },
        { status: 400 }
      );
    }

    const invalidItem = selectedItems.find(
      (item) =>
        item.is_free_manual ||
        String(item.billing_status || "").toLowerCase() !== "uninvoiced"
    );

    if (invalidItem) {
      return NextResponse.json(
        {
          error:
            "Only uninvoiced, billable PAIA manuals may be added to an invoice batch.",
        },
        { status: 400 }
      );
    }

    const { data: updatedItems, error: updateError } = await supabase
      .from("paia_manuals")
      .update({
        billing_status: "invoiced",
        invoice_number: invoiceNumber,
        invoiced_at: invoiceDateTime,
      })
      .in("id", manualIds)
      .eq("billing_status", "uninvoiced")
      .eq("is_free_manual", false)
      .select(
        `
          id,
          client_id,
          entity_name,
          billing_amount,
          billing_status,
          invoice_number,
          invoiced_at
        `
      );

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    if ((updatedItems ?? []).length !== manualIds.length) {
      return NextResponse.json(
        {
          error:
            "The invoice batch was not fully updated. Refresh the page and try again.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      invoice_number: invoiceNumber,
      invoiced_at: invoiceDateTime,
      items: updatedItems ?? [],
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create the PAIA invoice batch.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
