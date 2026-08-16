// Path: app/api/admin/afs-billing/route.ts

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

type AfsBillingEvent = {
  id: string;
  organisation_id: string;
  engagement_id: string | null;
  client_id: string | null;
  client_name: string | null;
  financial_year_end: string | null;
  billing_plan: string | null;
  pricing_tier: string | null;
  charge_type: string | null;
  billing_amount: number | null;
  billing_status: string | null;
  invoice_number: string | null;
  invoiced_at: string | null;
  paid_at: string | null;
  triggered_at: string | null;
  invoice_line_id: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
};

type CreatedInvoiceLine = {
  id: string;
  source_id: string | null;
};

type OrganisationForSubscriptions = {
  id: string;
  name: string;
  afs_billing_enabled: boolean;
  afs_plan: string | null;
  afs_pricing_tier: string | null;
  afs_flex_monthly_fee: number | null;
  afs_unlimited_user_price: number | null;
  afs_unlimited_licence_count: number | null;
  afs_plan_activated_at: string | null;
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

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDayUtc(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function billingCycleStartFor(date: Date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();

  return d >= 26
    ? new Date(Date.UTC(y, m, 26))
    : new Date(Date.UTC(y, m - 1, 26));
}

function billingCycleEndFor(date: Date) {
  const start = billingCycleStartFor(date);
  return new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 25)
  );
}

function firstSubscriptionPeriodEnd(activation: Date) {
  const y = activation.getUTCFullYear();
  const m = activation.getUTCMonth();
  const d = activation.getUTCDate();

  return d <= 25
    ? new Date(Date.UTC(y, m, 25))
    : new Date(Date.UTC(y, m + 1, 25));
}

function daysInclusive(start: Date, end: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

async function generateSubscriptionCharges(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  profile: UserProfile
) {
  const today = startOfDayUtc(new Date());

  const { data: organisations, error: organisationsError } = await supabase
    .from("organisations")
    .select(
      "id,name,afs_billing_enabled,afs_plan,afs_pricing_tier,afs_flex_monthly_fee,afs_unlimited_user_price,afs_unlimited_licence_count,afs_plan_activated_at"
    )
    .eq("afs_billing_enabled", true)
    .in("afs_plan", ["flex", "unlimited"]);

  if (organisationsError) {
    return NextResponse.json(
      { error: organisationsError.message },
      { status: 500 }
    );
  }

  const activeOrganisations =
    (organisations ?? []) as OrganisationForSubscriptions[];

  const created: Array<{
    organisation_name: string;
    charge_type: string;
    billing_period_start: string;
    billing_period_end: string;
    amount: number;
  }> = [];

  const skipped: Array<{ organisation_name: string; reason: string }> = [];

  for (const organisation of activeOrganisations) {
    if (!organisation.afs_plan_activated_at) {
      skipped.push({
        organisation_name: organisation.name,
        reason: "Missing AFS plan activation date.",
      });
      continue;
    }

    const activationDate = startOfDayUtc(organisation.afs_plan_activated_at);

    if (activationDate > today) {
      skipped.push({
        organisation_name: organisation.name,
        reason: "AFS plan activation date is in the future.",
      });
      continue;
    }

    const plan = String(organisation.afs_plan || "").toLowerCase();
    const chargeType =
      plan === "flex" ? "flex_subscription" : "unlimited_subscription";

    const flexMonthly = Number(organisation.afs_flex_monthly_fee ?? 199);
    const unlimitedUnitPrice = Number(
      organisation.afs_unlimited_user_price ?? 499
    );
    const unlimitedLicences = Math.max(
      1,
      Number(organisation.afs_unlimited_licence_count || 1)
    );

    let periodStart = activationDate;
    let periodEnd = firstSubscriptionPeriodEnd(activationDate);
    let firstPeriod = true;

    while (periodStart <= today) {
      const periodStartText = toDateOnly(periodStart);
      const periodEndText = toDateOnly(periodEnd);

      const { data: existingEvent, error: existingError } = await supabase
        .from("afs_billing_events")
        .select("id")
        .eq("organisation_id", organisation.id)
        .eq("charge_type", chargeType)
        .eq("billing_period_start", periodStartText)
        .eq("billing_period_end", periodEndText)
        .maybeSingle();

      if (existingError) {
        return NextResponse.json(
          { error: existingError.message },
          { status: 500 }
        );
      }

      if (!existingEvent) {
        let amount: number;

        if (plan === "flex") {
          amount = flexMonthly;
        } else {
          const fullMonthlyAmount = unlimitedUnitPrice * unlimitedLicences;

          if (firstPeriod) {
            const normalCycleStart = billingCycleStartFor(activationDate);
            const normalCycleEnd = billingCycleEndFor(activationDate);
            const totalCycleDays = daysInclusive(
              normalCycleStart,
              normalCycleEnd
            );
            const billableDays = daysInclusive(
              activationDate,
              firstSubscriptionPeriodEnd(activationDate)
            );

            amount = roundMoney(
              fullMonthlyAmount * (billableDays / totalCycleDays)
            );
          } else {
            amount = fullMonthlyAmount;
          }
        }

        const billingIdentityKey = [
          "afs-subscription",
          organisation.id,
          chargeType,
          periodStartText,
          periodEndText,
        ].join(":");

        const { error: insertError } = await supabase
          .from("afs_billing_events")
          .insert({
            organisation_id: organisation.id,
            engagement_id: null,
            client_id: null,
            client_name: organisation.name,
            financial_year_end: null,
            billing_identity_key: billingIdentityKey,
            billing_plan: plan,
            pricing_tier: organisation.afs_pricing_tier || "launch",
            charge_type: chargeType,
            billing_amount: amount,
            billing_status: "uninvoiced",
            triggered_at: new Date().toISOString(),
            triggered_by: profile.user_id,
            billing_period_start: periodStartText,
            billing_period_end: periodEndText,
            metadata: {
              source: "admin_subscription_generator",
              first_period: firstPeriod,
              plan,
              licence_count: plan === "unlimited" ? unlimitedLicences : null,
              unit_price:
                plan === "unlimited" ? unlimitedUnitPrice : flexMonthly,
            },
          });

        if (insertError && insertError.code !== "23505") {
          return NextResponse.json(
            { error: insertError.message },
            { status: 500 }
          );
        }

        if (!insertError) {
          created.push({
            organisation_name: organisation.name,
            charge_type: chargeType,
            billing_period_start: periodStartText,
            billing_period_end: periodEndText,
            amount,
          });
        }
      }

      firstPeriod = false;
      periodStart = addDays(periodEnd, 1);
      periodEnd = billingCycleEndFor(periodStart);
    }
  }

  return NextResponse.json({
    success: true,
    created_count: created.length,
    created,
    skipped,
  });
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { response } = await getCurrentProfile(request, supabase);

    if (response) return response;

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
        "id,name,status,access_enabled,afs_billing_enabled,afs_plan,afs_pricing_tier,afs_flex_monthly_fee,afs_flex_extra_price,afs_unlimited_user_price,afs_unlimited_licence_count,afs_plan_activated_at"
      )
      .order("name", { ascending: true });

    if (organisationsError) {
      return NextResponse.json(
        { error: organisationsError.message },
        { status: 500 }
      );
    }

    let query = supabase
      .from("afs_billing_events")
      .select(
        "id,organisation_id,engagement_id,client_id,client_name,financial_year_end,billing_plan,pricing_tier,charge_type,billing_amount,billing_status,invoice_number,invoiced_at,paid_at,triggered_at,invoice_line_id,billing_period_start,billing_period_end"
      )
      .order("triggered_at", { ascending: false });

    if (organisationId) query = query.eq("organisation_id", organisationId);
    if (billingStatus) query = query.eq("billing_status", billingStatus);
    if (dateFrom) {
      query = query.gte("triggered_at", `${dateFrom}T00:00:00.000Z`);
    }
    if (dateTo) {
      query = query.lte("triggered_at", `${dateTo}T23:59:59.999Z`);
    }

    const { data: events, error: eventsError } = await query;

    if (eventsError) {
      return NextResponse.json({ error: eventsError.message }, { status: 500 });
    }

    const organisationMap = new Map(
      (organisations ?? []).map((organisation) => [
        organisation.id,
        organisation.name,
      ])
    );

    const items = ((events ?? []) as AfsBillingEvent[]).map((event) => ({
      ...event,
      organisation_name:
        organisationMap.get(event.organisation_id) || "Unknown organisation",
    }));

    const summary = items.reduce(
      (totals, item) => {
        const amount = Number(item.billing_amount || 0);
        const status = String(item.billing_status || "").toLowerCase();

        totals.totalEvents += 1;
        totals.totalCharges += amount;

        if (status === "free") totals.freeEvents += 1;
        if (status === "covered") totals.coveredEvents += 1;

        if (status === "uninvoiced") {
          totals.uninvoicedAmount += amount;
          totals.uninvoicedEvents += 1;
        }

        if (status === "invoiced") {
          totals.invoicedAmount += amount;
          totals.invoicedEvents += 1;
        }

        if (status === "paid") {
          totals.paidAmount += amount;
          totals.paidEvents += 1;
        }

        return totals;
      },
      {
        totalEvents: 0,
        freeEvents: 0,
        coveredEvents: 0,
        totalCharges: 0,
        uninvoicedAmount: 0,
        uninvoicedEvents: 0,
        invoicedAmount: 0,
        invoicedEvents: 0,
        paidAmount: 0,
        paidEvents: 0,
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
        : "Failed to load AFS billing administration.";

    return NextResponse.json({ error: message }, { status: 500 });
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

    if (body?.action === "generate_subscription_charges") {
      return generateSubscriptionCharges(supabase, profile);
    }

    const eventIds = Array.isArray(body.event_ids)
      ? body.event_ids
          .map((value: unknown) => String(value || "").trim())
          .filter(Boolean)
      : [];

    const invoiceNumber = String(body.invoice_number || "").trim();
    const invoiceDate = String(body.invoice_date || "").trim();

    if (!eventIds.length) {
      return NextResponse.json(
        { error: "Select at least one uninvoiced AFS charge." },
        { status: 400 }
      );
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

    const invoiceDateTime = new Date(
      `${invoiceDate}T12:00:00.000Z`
    ).toISOString();

    const { data: eligibleEvents, error: eligibleError } = await supabase
      .from("afs_billing_events")
      .select(
        "id,organisation_id,engagement_id,client_name,financial_year_end,billing_plan,charge_type,billing_amount,billing_status,invoice_line_id,billing_period_start,billing_period_end"
      )
      .in("id", eventIds);

    if (eligibleError) {
      return NextResponse.json({ error: eligibleError.message }, { status: 500 });
    }

    const selectedEvents = eligibleEvents ?? [];

    if (selectedEvents.length !== eventIds.length) {
      return NextResponse.json(
        { error: "One or more selected AFS charges could not be found." },
        { status: 400 }
      );
    }

    const organisationIds = new Set(
      selectedEvents.map((event) => event.organisation_id)
    );

    if (organisationIds.size !== 1) {
      return NextResponse.json(
        {
          error:
            "A QuickBooks invoice may only contain AFS charges from one organisation.",
        },
        { status: 400 }
      );
    }

    const invalidEvent = selectedEvents.find(
      (event) =>
        String(event.billing_status || "").toLowerCase() !== "uninvoiced" ||
        Boolean(event.invoice_line_id)
    );

    if (invalidEvent) {
      return NextResponse.json(
        {
          error:
            "Only uninvoiced AFS charges that are not already linked to an invoice may be selected.",
        },
        { status: 400 }
      );
    }

    const organisationId = selectedEvents[0].organisation_id;
    const invoiceTotal = selectedEvents.reduce(
      (total, event) => total + Number(event.billing_amount || 0),
      0
    );

    const { data: existingInvoice, error: existingInvoiceError } =
      await supabase
        .from("practicepilot_invoices")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("invoice_number", invoiceNumber)
        .neq("status", "cancelled")
        .maybeSingle();

    if (existingInvoiceError) {
      return NextResponse.json(
        { error: existingInvoiceError.message },
        { status: 500 }
      );
    }

    if (existingInvoice) {
      return NextResponse.json(
        {
          error:
            "That QuickBooks invoice number is already recorded for this organisation.",
        },
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
      .select(
        "id,organisation_id,invoice_number,invoice_date,due_date,status,amount,source_system"
      )
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        {
          error:
            invoiceError?.message ||
            "Could not record the QuickBooks invoice in PracticePilot.",
        },
        { status: 500 }
      );
    }

    const linePayload = selectedEvents.map((event) => {
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

    const { data: createdLines, error: lineError } = await supabase
      .from("practicepilot_invoice_lines")
      .insert(linePayload)
      .select("id, source_id");

    if (lineError || !createdLines) {
      await supabase
        .from("practicepilot_invoices")
        .delete()
        .eq("id", invoice.id);

      return NextResponse.json(
        {
          error:
            lineError?.message ||
            "Could not create PracticePilot invoice reference lines.",
        },
        { status: 500 }
      );
    }

    const lineByEventId = new Map(
      (createdLines as CreatedInvoiceLine[])
        .filter((line) => line.source_id)
        .map((line) => [String(line.source_id), line.id])
    );

    const updatedEventIds: string[] = [];

    for (const event of selectedEvents) {
      const invoiceLineId = lineByEventId.get(event.id);

      if (!invoiceLineId) {
        for (const updatedEventId of updatedEventIds) {
          await supabase
            .from("afs_billing_events")
            .update({
              billing_status: "uninvoiced",
              invoice_number: null,
              invoiced_at: null,
              invoice_line_id: null,
            })
            .eq("id", updatedEventId);
        }

        await supabase
          .from("practicepilot_invoices")
          .delete()
          .eq("id", invoice.id);

        return NextResponse.json(
          { error: "Could not link one or more AFS charges to the QuickBooks invoice." },
          { status: 500 }
        );
      }

      const { data: updatedEvent, error: updateError } = await supabase
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

      if (updateError || !updatedEvent) {
        for (const updatedEventId of updatedEventIds) {
          await supabase
            .from("afs_billing_events")
            .update({
              billing_status: "uninvoiced",
              invoice_number: null,
              invoiced_at: null,
              invoice_line_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", updatedEventId);
        }

        await supabase
          .from("practicepilot_invoices")
          .delete()
          .eq("id", invoice.id);

        return NextResponse.json(
          {
            error:
              updateError?.message ||
              "The AFS invoice reference was not fully recorded. Refresh and try again.",
          },
          { status: 409 }
        );
      }

      updatedEventIds.push(event.id);
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
      event_count: selectedEvents.length,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to process AFS billing administration.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
