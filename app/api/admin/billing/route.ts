// Path: app/api/admin/billing/route.ts

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

type InvoiceRow = {
  id: string;
  organisation_id: string;
  invoice_number: string | null;
  invoice_date: string;
  due_date: string;
  status: string;
  amount: number | null;
  paid_at: string | null;
  suspension_override_until: string | null;
  source_system: string | null;
  external_invoice_id: string | null;
  external_invoice_url: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
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

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(invoice: InvoiceRow) {
  if (String(invoice.status || "").toLowerCase() !== "issued") {
    return false;
  }

  if (!invoice.due_date) {
    return false;
  }

  if (
    invoice.suspension_override_until &&
    invoice.suspension_override_until >= todayDateOnly()
  ) {
    return false;
  }

  return todayDateOnly() > invoice.due_date;
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

async function reconcileOrganisationSuspension(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  organisationId: string
) {
  const { data: invoices, error: invoicesError } = await supabase
    .from("practicepilot_invoices")
    .select(
      `
        id,
        organisation_id,
        invoice_number,
        invoice_date,
        due_date,
        status,
        amount,
        paid_at,
        suspension_override_until,
        source_system,
        external_invoice_id,
        external_invoice_url,
        last_synced_at,
        created_at,
        updated_at
      `
    )
    .eq("organisation_id", organisationId)
    .neq("status", "cancelled");

  if (invoicesError) {
    throw new Error(invoicesError.message);
  }

  const overdueInvoices = ((invoices ?? []) as InvoiceRow[]).filter(isOverdue);
  const shouldSuspend = overdueInvoices.length > 0;

  const reason = shouldSuspend
    ? `Overdue PracticePilot invoice${overdueInvoices.length > 1 ? "s" : ""}: ${overdueInvoices
        .map((invoice) => invoice.invoice_number || invoice.id)
        .join(", ")}`
    : null;

  const { error: updateError } = await supabase
    .from("organisations")
    .update({
      billing_access_suspended: shouldSuspend,
      billing_suspended_at: shouldSuspend ? new Date().toISOString() : null,
      billing_suspension_reason: reason,
    })
    .eq("id", organisationId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    suspended: shouldSuspend,
    overdue_count: overdueInvoices.length,
  };
}

async function markInvoicePaid(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  invoiceId: string
) {
  const paidAt = new Date().toISOString();

  const { data: invoice, error: invoiceError } = await supabase
    .from("practicepilot_invoices")
    .update({
      status: "paid",
      paid_at: paidAt,
      updated_at: paidAt,
      last_synced_at: paidAt,
    })
    .eq("id", invoiceId)
    .neq("status", "cancelled")
    .select("id, organisation_id, invoice_number")
    .single();

  if (invoiceError || !invoice) {
    throw new Error(invoiceError?.message || "Could not mark invoice as paid.");
  }

  const { data: lines, error: linesError } = await supabase
    .from("practicepilot_invoice_lines")
    .select("id, source_type, source_id")
    .eq("invoice_id", invoiceId);

  if (linesError) {
    throw new Error(linesError.message);
  }

  for (const line of lines ?? []) {
    if (!line.source_id) continue;

    if (line.source_type === "afs_billing_event") {
      const { error } = await supabase
        .from("afs_billing_events")
        .update({
          billing_status: "paid",
          paid_at: paidAt,
          updated_at: paidAt,
        })
        .eq("id", line.source_id);

      if (error) {
        throw new Error(error.message);
      }
    }

    if (line.source_type === "paia_manual") {
      const { error } = await supabase
        .from("paia_manuals")
        .update({
          billing_status: "paid",
        })
        .eq("id", line.source_id);

      if (error) {
        throw new Error(error.message);
      }
    }
  }

  const access = await reconcileOrganisationSuspension(
    supabase,
    invoice.organisation_id
  );

  return {
    invoice,
    paid_at: paidAt,
    access,
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
    const status = String(url.searchParams.get("status") || "").trim();

    const { data: organisations, error: organisationsError } = await supabase
      .from("organisations")
      .select(
        `
          id,
          name,
          billing_access_suspended,
          billing_suspended_at,
          billing_suspension_reason
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
      .from("practicepilot_invoices")
      .select(
        `
          id,
          organisation_id,
          invoice_number,
          invoice_date,
          due_date,
          status,
          amount,
          paid_at,
          suspension_override_until,
          source_system,
          external_invoice_id,
          external_invoice_url,
          last_synced_at,
          created_at,
          updated_at
        `
      )
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (organisationId) {
      query = query.eq("organisation_id", organisationId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data: invoices, error: invoicesError } = await query;

    if (invoicesError) {
      return NextResponse.json(
        { error: invoicesError.message },
        { status: 500 }
      );
    }

    const organisationMap = new Map(
      (organisations ?? []).map((organisation) => [
        organisation.id,
        organisation,
      ])
    );

    const items = ((invoices ?? []) as InvoiceRow[]).map((invoice) => {
      const organisation = organisationMap.get(invoice.organisation_id);

      return {
        ...invoice,
        organisation_name: organisation?.name || "Unknown organisation",
        is_overdue: isOverdue(invoice),
        billing_access_suspended:
          organisation?.billing_access_suspended || false,
        billing_suspension_reason:
          organisation?.billing_suspension_reason || null,
      };
    });

    const summary = items.reduce(
      (totals, invoice) => {
        const amount = Number(invoice.amount || 0);
        const invoiceStatus = String(invoice.status || "").toLowerCase();

        totals.totalInvoices += 1;
        totals.totalAmount += amount;

        if (invoiceStatus === "issued") {
          totals.outstandingAmount += amount;
          totals.outstandingInvoices += 1;
        }

        if (invoiceStatus === "paid") {
          totals.paidAmount += amount;
          totals.paidInvoices += 1;
        }

        if (invoice.is_overdue) {
          totals.overdueAmount += amount;
          totals.overdueInvoices += 1;
        }

        return totals;
      },
      {
        totalInvoices: 0,
        totalAmount: 0,
        outstandingAmount: 0,
        outstandingInvoices: 0,
        paidAmount: 0,
        paidInvoices: 0,
        overdueAmount: 0,
        overdueInvoices: 0,
      }
    );

    return NextResponse.json({
      organisations: organisations ?? [],
      items,
      summary,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load PracticePilot billing control.";

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
    const action = String(body?.action || "").trim();

    if (action === "mark_paid") {
      const invoiceId = String(body?.invoice_id || "").trim();

      if (!invoiceId) {
        return NextResponse.json(
          { error: "Invoice id is required." },
          { status: 400 }
        );
      }

      const result = await markInvoicePaid(supabase, invoiceId);

      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    if (action === "reconcile_overdue") {
      const { data: organisations, error: organisationsError } = await supabase
        .from("organisations")
        .select("id, name")
        .order("name", { ascending: true });

      if (organisationsError) {
        return NextResponse.json(
          { error: organisationsError.message },
          { status: 500 }
        );
      }

      let suspendedCount = 0;

      for (const organisation of organisations ?? []) {
        const result = await reconcileOrganisationSuspension(
          supabase,
          organisation.id
        );

        if (result.suspended) {
          suspendedCount += 1;
        }
      }

      return NextResponse.json({
        success: true,
        suspended_count: suspendedCount,
      });
    }

    return NextResponse.json(
      { error: "Unsupported billing action." },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update PracticePilot billing control.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
