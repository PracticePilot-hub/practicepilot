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

type SelectedPaiaManual = {
  id: string;
  client_id: string;
  entity_name: string;
  billing_amount: number | null;
  billing_status: string | null;
  is_free_manual: boolean;
};

type CreatedInvoiceLine = {
  id: string;
  source_id: string | null;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) {
    throw new Error(
      "Missing server Supabase key. Add SUPABASE_SERVICE_ROLE_KEY in Vercel and redeploy."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isGlobalAdmin(role: string) {
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
    .select(`id,user_id,email,role,organisation_id,access_enabled`)
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json({ error: "Could not load user profile." }, { status: 403 }),
    };
  }

  const userProfile = profile as UserProfile;

  if (!userProfile.access_enabled) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json({ error: "User access is blocked." }, { status: 403 }),
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

  return { profile: userProfile, response: null as NextResponse | null };
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { response } = await getCurrentProfile(request, supabase);
    if (response) return response;

    const url = new URL(request.url);
    const organisationId = String(url.searchParams.get("organisationId") || "").trim();
    const billingStatus = String(url.searchParams.get("status") || "").trim();
    const dateFrom = String(url.searchParams.get("dateFrom") || "").trim();
    const dateTo = String(url.searchParams.get("dateTo") || "").trim();

    const { data: organisations, error: organisationsError } = await supabase
      .from("organisations")
      .select(`id,name,status,access_enabled,paia_manual_price,paia_billing_enabled`)
      .order("name", { ascending: true });

    if (organisationsError) {
      return NextResponse.json({ error: organisationsError.message }, { status: 500 });
    }

    let query = supabase
      .from("paia_manuals")
      .select(`id,client_id,entity_name,entity_registration_number,created_at,is_free_manual,billing_amount,billing_status,invoice_number,invoiced_at`)
      .order("created_at", { ascending: false });

    if (organisationId) query = query.eq("client_id", organisationId);
    if (billingStatus) {
      if (billingStatus === "free") query = query.eq("is_free_manual", true);
      else query = query.eq("billing_status", billingStatus);
    }
    if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00.000Z`);
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59.999Z`);

    const { data: items, error: itemsError } = await query;
    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

    const organisationMap = new Map(
      (organisations ?? []).map((organisation) => [organisation.id, organisation.name])
    );

    const billingItems = (items ?? []).map((item) => ({
      ...item,
      organisation_name: organisationMap.get(item.client_id) || "Unknown organisation",
    }));

    const summary = billingItems.reduce(
      (totals, item) => {
        const amount = Number(item.billing_amount || 0);
        const status = String(item.billing_status || "").toLowerCase();
        totals.totalManuals += 1;
        totals.totalCharges += amount;
        if (item.is_free_manual || status === "free") totals.freeManuals += 1;
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

    return NextResponse.json({ organisations: organisations ?? [], items: billingItems, summary });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load PAIA billing administration.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { response } = await getCurrentProfile(request, supabase);
    if (response) return response;

    const body = await request.json();
    const manualIds = Array.isArray(body.manual_ids)
      ? body.manual_ids.map((value: unknown) => String(value || "").trim()).filter(Boolean)
      : [];
    const invoiceNumber = String(body.invoice_number || "").trim();
    const invoiceDate = String(body.invoiced_at || "").trim();

    if (!manualIds.length) {
      return NextResponse.json({ error: "Select at least one PAIA manual." }, { status: 400 });
    }
    if (!invoiceNumber) {
      return NextResponse.json({ error: "Invoice number is required." }, { status: 400 });
    }
    if (!invoiceDate || !isValidDateOnly(invoiceDate)) {
      return NextResponse.json({ error: "A valid invoice date is required." }, { status: 400 });
    }

    const invoiceDateTime = new Date(`${invoiceDate}T12:00:00.000Z`).toISOString();

    const { data: eligibleItems, error: eligibleError } = await supabase
      .from("paia_manuals")
      .select(`id,client_id,entity_name,billing_amount,billing_status,is_free_manual`)
      .in("id", manualIds);

    if (eligibleError) return NextResponse.json({ error: eligibleError.message }, { status: 500 });

    const selectedItems = (eligibleItems ?? []) as SelectedPaiaManual[];
    if (selectedItems.length !== manualIds.length) {
      return NextResponse.json({ error: "One or more selected manuals could not be found." }, { status: 400 });
    }

    const organisationIds = new Set(selectedItems.map((item) => item.client_id));
    if (organisationIds.size !== 1) {
      return NextResponse.json(
        { error: "An invoice batch may only contain manuals from one organisation." },
        { status: 400 }
      );
    }

    const invalidItem = selectedItems.find(
      (item) => item.is_free_manual || String(item.billing_status || "").toLowerCase() !== "uninvoiced"
    );
    if (invalidItem) {
      return NextResponse.json(
        { error: "Only uninvoiced, billable PAIA manuals may be added to an invoice batch." },
        { status: 400 }
      );
    }

    const organisationId = selectedItems[0].client_id;
    const invoiceTotal = selectedItems.reduce(
      (total, item) => total + Number(item.billing_amount || 0),
      0
    );

    const { data: existingInvoice, error: existingInvoiceError } = await supabase
      .from("practicepilot_invoices")
      .select("id")
      .eq("organisation_id", organisationId)
      .eq("invoice_number", invoiceNumber)
      .neq("status", "cancelled")
      .maybeSingle();

    if (existingInvoiceError) {
      return NextResponse.json({ error: existingInvoiceError.message }, { status: 500 });
    }
    if (existingInvoice) {
      return NextResponse.json(
        { error: "That invoice number already exists for this organisation." },
        { status: 409 }
      );
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("practicepilot_invoices")
      .insert({
        organisation_id: organisationId,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        status: "issued",
        amount: invoiceTotal,
        source_system: "quickbooks",
      })
      .select(`id,organisation_id,invoice_number,invoice_date,due_date,status,amount,source_system,external_invoice_id,external_invoice_url,last_synced_at`)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: invoiceError?.message || "Could not record the QuickBooks invoice in PracticePilot." },
        { status: 500 }
      );
    }

    const invoiceLinePayload = selectedItems.map((item) => {
      const amount = Number(item.billing_amount || 0);
      return {
        invoice_id: invoice.id,
        source_type: "paia_manual",
        source_id: item.id,
        description: `PAIA Manual - ${item.entity_name || "Unnamed entity"}`,
        quantity: 1,
        unit_price: amount,
        line_total: amount,
      };
    });

    const { data: createdLines, error: lineError } = await supabase
      .from("practicepilot_invoice_lines")
      .insert(invoiceLinePayload)
      .select("id, source_id");

    if (lineError || !createdLines) {
      await supabase.from("practicepilot_invoices").delete().eq("id", invoice.id);
      return NextResponse.json(
        { error: lineError?.message || "Could not link the PAIA charges to the QuickBooks invoice." },
        { status: 500 }
      );
    }

    const lineByManualId = new Map(
      (createdLines as CreatedInvoiceLine[])
        .filter((line) => line.source_id)
        .map((line) => [String(line.source_id), line.id])
    );

    const updatedManualIds: string[] = [];

    for (const item of selectedItems) {
      const invoiceLineId = lineByManualId.get(item.id);

      if (!invoiceLineId) {
        for (const updatedManualId of updatedManualIds) {
          await supabase
            .from("paia_manuals")
            .update({ billing_status: "uninvoiced", invoice_number: null, invoiced_at: null, invoice_line_id: null })
            .eq("id", updatedManualId);
        }
        await supabase.from("practicepilot_invoices").delete().eq("id", invoice.id);
        return NextResponse.json(
          { error: "Could not link one or more PAIA manuals to the invoice." },
          { status: 500 }
        );
      }

      const { data: updatedManual, error: updateError } = await supabase
        .from("paia_manuals")
        .update({
          billing_status: "invoiced",
          invoice_number: invoiceNumber,
          invoiced_at: invoiceDateTime,
          invoice_line_id: invoiceLineId,
        })
        .eq("id", item.id)
        .eq("billing_status", "uninvoiced")
        .eq("is_free_manual", false)
        .select("id")
        .maybeSingle();

      if (updateError || !updatedManual) {
        for (const updatedManualId of updatedManualIds) {
          await supabase
            .from("paia_manuals")
            .update({ billing_status: "uninvoiced", invoice_number: null, invoiced_at: null, invoice_line_id: null })
            .eq("id", updatedManualId);
        }
        await supabase.from("practicepilot_invoices").delete().eq("id", invoice.id);
        return NextResponse.json(
          { error: updateError?.message || "The invoice batch was not fully updated. Refresh the page and try again." },
          { status: 409 }
        );
      }

      updatedManualIds.push(item.id);
    }

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        status: invoice.status,
        amount: Number(invoice.amount || 0),
        source_system: invoice.source_system,
      },
      invoiced_at: invoiceDateTime,
      manual_count: selectedItems.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record the QuickBooks invoice batch.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
