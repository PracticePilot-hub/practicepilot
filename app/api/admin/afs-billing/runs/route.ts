// Path: app/api/admin/afs-billing/runs/route.ts

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
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isAdminRole(role: string) {
  return role === "Super Admin" || role === "Admin";
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  return authHeader.replace(/^Bearer\s+/i, "").trim();
}

function isValidDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
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

  const typedProfile = profile as UserProfile;

  if (!typedProfile.access_enabled || !isAdminRole(typedProfile.role)) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json(
        { error: "PracticePilot administrator access is required." },
        { status: 403 }
      ),
    };
  }

  return { profile: typedProfile, response: null as NextResponse | null };
}

async function refreshRunStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  runId: string
) {
  const { data: batches, error } = await supabase
    .from("afs_billing_run_batches")
    .select("status,subtotal")
    .eq("billing_run_id", runId);

  if (error) throw error;

  const realBatches = batches ?? [];
  const invoiceBatches = realBatches.filter(
    (batch) => Number(batch.subtotal || 0) > 0
  );

  let status = "ready";

  if (invoiceBatches.length > 0) {
    const invoiced = invoiceBatches.filter(
      (batch) => batch.status === "invoiced" || batch.status === "paid"
    ).length;

    if (invoiced === invoiceBatches.length) status = "invoiced";
    else if (invoiced > 0) status = "partially_invoiced";
  }

  await supabase
    .from("afs_billing_runs")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", runId);

  return status;
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { response } = await getCurrentProfile(request, supabase);
    if (response) return response;

    const url = new URL(request.url);
    const runId = String(url.searchParams.get("runId") || "").trim();

    const { data: runs, error: runsError } = await supabase
      .from("afs_billing_runs")
      .select(
        "id,billing_month,cutoff_date,run_date,status,generated_at,generated_by,notes,created_at,updated_at"
      )
      .order("billing_month", { ascending: false })
      .limit(24);

    if (runsError) throw runsError;

    const selectedRunId = runId || runs?.[0]?.id || "";

    let batches: any[] = [];
    let events: any[] = [];

    if (selectedRunId) {
      const { data: batchData, error: batchError } = await supabase
        .from("afs_billing_run_batches")
        .select(
          "id,billing_run_id,organisation_id,organisation_name,billing_plan,pricing_tier,free_items_count,covered_items_count,chargeable_items_count,subtotal,invoice_number,invoice_date,invoice_id,status,generated_at,invoiced_at,created_at,updated_at"
        )
        .eq("billing_run_id", selectedRunId)
        .order("organisation_name", { ascending: true });

      if (batchError) throw batchError;
      batches = batchData ?? [];

      const batchIds = batches.map((batch) => batch.id);

      if (batchIds.length) {
        const { data: eventData, error: eventError } = await supabase
          .from("afs_billing_events")
          .select(
            "id,organisation_id,engagement_id,client_id,client_name,financial_year_end,billing_plan,pricing_tier,charge_type,billing_amount,billing_status,invoice_number,invoiced_at,paid_at,triggered_at,invoice_line_id,billing_period_start,billing_period_end,billing_run_id,billing_batch_id"
          )
          .in("billing_batch_id", batchIds)
          .order("triggered_at", { ascending: false });

        if (eventError) throw eventError;
        events = eventData ?? [];
      }
    }

    const batchSummary = batches.reduce(
      (total, batch) => {
        const amount = Number(batch.subtotal || 0);
        total.total += amount;
        if (amount > 0) total.invoiceBatches += 1;
        if (batch.status === "invoiced" || batch.status === "paid") {
          total.invoiced += amount;
        } else if (amount > 0) {
          total.uninvoiced += amount;
        }
        return total;
      },
      {
        total: 0,
        uninvoiced: 0,
        invoiced: 0,
        invoiceBatches: 0,
      }
    );

    return NextResponse.json({
      runs: runs ?? [],
      selected_run_id: selectedRunId || null,
      batches,
      events,
      summary: batchSummary,
    });
  } catch (error: any) {
    console.error("Could not load AFS billing runs:", error);

    return NextResponse.json(
      { error: error?.message || "Could not load AFS billing runs." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { profile, response } = await getCurrentProfile(request, supabase);
    if (response) return response;
    if (!profile) {
      return NextResponse.json(
        { error: "PracticePilot administrator access is required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = String(body?.action || "").trim();

    if (action === "manual_run") {
      const billingMonth = String(body?.billing_month || "").trim();

      if (!/^\d{4}-\d{2}$/.test(billingMonth)) {
        return NextResponse.json(
          { error: "Choose a valid billing month." },
          { status: 400 }
        );
      }

      const runDate = `${billingMonth}-26`;
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
      const cronSecret = process.env.CRON_SECRET || "";

      const cronResponse = await fetch(
        `${baseUrl}/api/cron/afs-billing-run?force=1&rebuild=1&runDate=${encodeURIComponent(runDate)}`,
        {
          method: "GET",
          cache: "no-store",
          headers: cronSecret
            ? { Authorization: `Bearer ${cronSecret}` }
            : undefined,
        }
      );

      const cronJson = await cronResponse.json();

      if (!cronResponse.ok) {
        return NextResponse.json(
          { error: cronJson?.error || "Could not generate manual AFS billing run." },
          { status: cronResponse.status }
        );
      }

      return NextResponse.json(cronJson);
    }

    if (action !== "record_batch_invoice") {
      return NextResponse.json({ error: "Unknown billing-run action." }, { status: 400 });
    }

    const batchId = String(body?.billing_batch_id || "").trim();
    const invoiceNumber = String(body?.invoice_number || "").trim();
    const invoiceDate = String(body?.invoice_date || "").trim();

    if (!batchId) {
      return NextResponse.json({ error: "Billing batch is required." }, { status: 400 });
    }

    if (!invoiceNumber) {
      return NextResponse.json(
        { error: "QuickBooks invoice number is required." },
        { status: 400 }
      );
    }

    if (!invoiceDate || !isValidDateOnly(invoiceDate)) {
      return NextResponse.json(
        { error: "A valid QuickBooks invoice date is required." },
        { status: 400 }
      );
    }

    const { data: batch, error: batchError } = await supabase
      .from("afs_billing_run_batches")
      .select(
        "id,billing_run_id,organisation_id,organisation_name,subtotal,invoice_number,invoice_id,status"
      )
      .eq("id", batchId)
      .single();

    if (batchError || !batch) {
      return NextResponse.json({ error: "Billing batch not found." }, { status: 404 });
    }

    if (batch.invoice_id || batch.invoice_number) {
      return NextResponse.json(
        { error: "This organisation batch is already linked to an invoice." },
        { status: 409 }
      );
    }

    if (Number(batch.subtotal || 0) <= 0) {
      return NextResponse.json(
        { error: "This batch has no chargeable amount to invoice." },
        { status: 400 }
      );
    }

    const { data: events, error: eventsError } = await supabase
      .from("afs_billing_events")
      .select(
        "id,organisation_id,client_name,financial_year_end,charge_type,billing_amount,billing_status,invoice_line_id,billing_period_start,billing_period_end"
      )
      .eq("billing_batch_id", batchId);

    if (eventsError) throw eventsError;

    const chargeableEvents = (events ?? []).filter(
      (event) =>
        Number(event.billing_amount || 0) > 0 &&
        String(event.billing_status || "").toLowerCase() === "uninvoiced" &&
        !event.invoice_line_id
    );

    if (!chargeableEvents.length) {
      return NextResponse.json(
        { error: "No uninvoiced chargeable items remain in this batch." },
        { status: 409 }
      );
    }

    const invoiceTotal = chargeableEvents.reduce(
      (sum, event) => sum + Number(event.billing_amount || 0),
      0
    );

    const { data: duplicateInvoice, error: duplicateError } = await supabase
      .from("practicepilot_invoices")
      .select("id")
      .eq("organisation_id", batch.organisation_id)
      .eq("invoice_number", invoiceNumber)
      .neq("status", "cancelled")
      .maybeSingle();

    if (duplicateError) throw duplicateError;

    if (duplicateInvoice) {
      return NextResponse.json(
        { error: "That QuickBooks invoice number is already recorded for this organisation." },
        { status: 409 }
      );
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("practicepilot_invoices")
      .insert({
        organisation_id: batch.organisation_id,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        status: "issued",
        amount: invoiceTotal,
        source_system: "quickbooks",
      })
      .select(
        "id,organisation_id,invoice_number,invoice_date,due_date,status,amount,source_system"
      )
      .single();

    if (invoiceError || !invoice) {
      throw invoiceError || new Error("Could not record PracticePilot invoice.");
    }

    const linePayload = chargeableEvents.map((event) => {
      const amount = Number(event.billing_amount || 0);
      const isSubscription =
        event.charge_type === "flex_subscription" ||
        event.charge_type === "unlimited_subscription";

      const description = isSubscription
        ? `${
            event.charge_type === "flex_subscription"
              ? "AFS Flex subscription"
              : "AFS Unlimited subscription"
          }${
            event.billing_period_start && event.billing_period_end
              ? ` - ${event.billing_period_start} to ${event.billing_period_end}`
              : ""
          }`
        : `AFS - ${event.client_name || "Unnamed client"}${
            event.financial_year_end ? ` - ${event.financial_year_end}` : ""
          }`;

      return {
        invoice_id: invoice.id,
        source_type: "afs_billing_event",
        source_id: event.id,
        description,
        quantity: 1,
        unit_price: amount,
        line_total: amount,
      };
    });

    const { data: createdLines, error: linesError } = await supabase
      .from("practicepilot_invoice_lines")
      .insert(linePayload)
      .select("id,source_id");

    if (linesError || !createdLines) {
      await supabase.from("practicepilot_invoices").delete().eq("id", invoice.id);
      throw linesError || new Error("Could not create invoice lines.");
    }

    const lineMap = new Map(
      createdLines
        .filter((line) => line.source_id)
        .map((line) => [String(line.source_id), line.id])
    );

    const invoiceDateTime = new Date(`${invoiceDate}T12:00:00.000Z`).toISOString();
    const updatedEventIds: string[] = [];

    for (const event of chargeableEvents) {
      const invoiceLineId = lineMap.get(event.id);

      if (!invoiceLineId) {
        throw new Error("Could not link an AFS billing item to the invoice.");
      }

      const { data: updated, error: updateError } = await supabase
        .from("afs_billing_events")
        .update({
          billing_status: "invoiced",
          invoice_number: invoiceNumber,
          invoiced_at: invoiceDateTime,
          invoice_line_id: invoiceLineId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", event.id)
        .eq("billing_status", "uninvoiced")
        .is("invoice_line_id", null)
        .select("id")
        .maybeSingle();

      if (updateError || !updated) {
        for (const id of updatedEventIds) {
          await supabase
            .from("afs_billing_events")
            .update({
              billing_status: "uninvoiced",
              invoice_number: null,
              invoiced_at: null,
              invoice_line_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id);
        }

        await supabase.from("practicepilot_invoices").delete().eq("id", invoice.id);

        throw updateError || new Error("Could not finish linking the billing batch.");
      }

      updatedEventIds.push(event.id);
    }

    const { error: batchUpdateError } = await supabase
      .from("afs_billing_run_batches")
      .update({
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        invoice_id: invoice.id,
        status: "invoiced",
        invoiced_at: invoiceDateTime,
        updated_at: new Date().toISOString(),
      })
      .eq("id", batch.id);

    if (batchUpdateError) throw batchUpdateError;

    const runStatus = await refreshRunStatus(supabase, batch.billing_run_id);

    return NextResponse.json({
      success: true,
      invoice,
      billing_batch_id: batch.id,
      billing_run_id: batch.billing_run_id,
      run_status: runStatus,
      event_count: chargeableEvents.length,
      amount: invoiceTotal,
    });
  } catch (error: any) {
    console.error("Could not record AFS billing batch invoice:", error);

    return NextResponse.json(
      { error: error?.message || "Could not record QuickBooks invoice." },
      { status: 500 }
    );
  }
}
