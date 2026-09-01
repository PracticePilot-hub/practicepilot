// Path: app/api/cron/afs-billing-run/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Organisation = {
  id: string;
  name: string;
  afs_billing_enabled: boolean;
  afs_plan: string | null;
  afs_pricing_tier: string | null;
  afs_flex_monthly_fee: number | null;
  afs_unlimited_user_price: number | null;
  afs_plan_activated_at: string | null;
};

type BillingEvent = {
  id: string;
  organisation_id: string;
  billing_plan: string | null;
  pricing_tier: string | null;
  charge_type: string | null;
  billing_amount: number | null;
  billing_status: string | null;
  triggered_at: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  billing_run_id: string | null;
  billing_batch_id: string | null;
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
      "Missing server Supabase key. Add SUPABASE_SERVICE_ROLE_KEY in Vercel."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDayUtc(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function endOfDayUtc(date: Date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function verifyCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;

  // If CRON_SECRET is configured in Vercel, require it.
  // Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
  if (!secret) return true;

  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

async function generateRun(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorised cron request." }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  /*
   * Vercel Cron is UTC.
   * The schedule is set for 02:00 UTC on the 26th, which is 04:00 South Africa time.
   *
   * Billing rule:
   * - Cut-off: 25th inclusive.
   * - Run: 26th.
   * - Usage/free/covered events up to the 25th are swept into the run.
   * - The new monthly subscription charge for the period 26th -> 25th is generated
   *   and included in the same organisation batch.
   * - One batch per organisation.
   * - One QuickBooks invoice number will later be linked to the whole batch.
   */

  const now = new Date();
  const runDate = startOfDayUtc(now);

  // The normal automatic run must only happen on the 26th.
  // Manual browser/API testing is allowed with ?force=1.
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";

  if (!force && runDate.getUTCDate() !== 26) {
    return NextResponse.json({
      success: true,
      skipped: true,
      message: "AFS billing run only executes automatically on the 26th.",
      run_date: toDateOnly(runDate),
    });
  }

  const cutoffDate = addDays(runDate, -1); // 25th
  const usagePeriodStart = new Date(
    Date.UTC(cutoffDate.getUTCFullYear(), cutoffDate.getUTCMonth() - 1, 26)
  );
  const usagePeriodEnd = cutoffDate;

  const subscriptionPeriodStart = runDate;
  const subscriptionPeriodEnd = new Date(
    Date.UTC(runDate.getUTCFullYear(), runDate.getUTCMonth() + 1, 25)
  );

  // Use the run month as the unique billing-run month.
  const billingMonth = monthStart(runDate);

  const { data: existingRun, error: existingRunError } = await supabase
    .from("afs_billing_runs")
    .select("id,status,billing_month")
    .eq("billing_month", toDateOnly(billingMonth))
    .maybeSingle();

  if (existingRunError) throw existingRunError;

  if (existingRun) {
    return NextResponse.json({
      success: true,
      already_exists: true,
      billing_run_id: existingRun.id,
      status: existingRun.status,
      billing_month: existingRun.billing_month,
      message: "This month's AFS billing run already exists.",
    });
  }

  const { data: run, error: runError } = await supabase
    .from("afs_billing_runs")
    .insert({
      billing_month: toDateOnly(billingMonth),
      cutoff_date: toDateOnly(cutoffDate),
      run_date: toDateOnly(runDate),
      status: "draft",
      generated_by: force ? "manual_force" : "vercel_cron",
    })
    .select("id,billing_month,cutoff_date,run_date,status")
    .single();

  if (runError || !run) {
    throw runError || new Error("Could not create AFS billing run.");
  }

  try {
    const { data: organisations, error: organisationsError } = await supabase
      .from("organisations")
      .select(
        "id,name,afs_billing_enabled,afs_plan,afs_pricing_tier,afs_flex_monthly_fee,afs_unlimited_user_price,afs_plan_activated_at"
      )
      .eq("afs_billing_enabled", true)
      .in("afs_plan", ["flex", "unlimited"])
      .order("name", { ascending: true });

    if (organisationsError) throw organisationsError;

    const activeOrganisations = (organisations ?? []) as Organisation[];

    const { data: afsUsers, error: afsUsersError } = await supabase
      .from("user_profiles")
      .select("id,organisation_id")
      .eq("access_enabled", true)
      .eq("can_access_afs", true);

    if (afsUsersError) throw afsUsersError;

    const userCountByOrganisation = new Map<string, number>();

    for (const user of afsUsers ?? []) {
      if (!user.organisation_id) continue;
      userCountByOrganisation.set(
        user.organisation_id,
        (userCountByOrganisation.get(user.organisation_id) ?? 0) + 1
      );
    }

    const results: Array<{
      organisation_id: string;
      organisation_name: string;
      batch_id: string | null;
      subtotal: number;
      chargeable_items: number;
      free_items: number;
      covered_items: number;
      status: string;
    }> = [];

    for (const organisation of activeOrganisations) {
      const plan = String(organisation.afs_plan || "").toLowerCase();

      if (!organisation.afs_plan_activated_at) {
        results.push({
          organisation_id: organisation.id,
          organisation_name: organisation.name,
          batch_id: null,
          subtotal: 0,
          chargeable_items: 0,
          free_items: 0,
          covered_items: 0,
          status: "skipped_missing_activation_date",
        });
        continue;
      }

      const activationDate = startOfDayUtc(
        new Date(organisation.afs_plan_activated_at)
      );

      // Do not charge a subscription for a future activation.
      if (activationDate > subscriptionPeriodEnd) {
        continue;
      }

      const activeAfsUsers = userCountByOrganisation.get(organisation.id) ?? 0;

      /*
       * Generate the monthly subscription event for the NEW cycle.
       * Unlimited quantity is the actual number of active AFS users.
       */
      const subscriptionChargeType =
        plan === "flex" ? "flex_subscription" : "unlimited_subscription";

      const subscriptionIdentityKey = [
        "afs-subscription",
        organisation.id,
        subscriptionChargeType,
        toDateOnly(subscriptionPeriodStart),
        toDateOnly(subscriptionPeriodEnd),
      ].join(":");

      const unitPrice =
        plan === "flex"
          ? Number(organisation.afs_flex_monthly_fee ?? 199)
          : Number(organisation.afs_unlimited_user_price ?? 499);

      const subscriptionAmount =
        plan === "flex" ? unitPrice : unitPrice * activeAfsUsers;

      const { data: existingSubscription, error: existingSubscriptionError } =
        await supabase
          .from("afs_billing_events")
          .select("id")
          .eq("billing_identity_key", subscriptionIdentityKey)
          .maybeSingle();

      if (existingSubscriptionError) throw existingSubscriptionError;

      if (!existingSubscription) {
        const { error: subscriptionInsertError } = await supabase
          .from("afs_billing_events")
          .insert({
            organisation_id: organisation.id,
            engagement_id: null,
            client_id: null,
            client_name: organisation.name,
            financial_year_end: null,
            billing_identity_key: subscriptionIdentityKey,
            billing_plan: plan,
            pricing_tier: organisation.afs_pricing_tier || "launch",
            charge_type: subscriptionChargeType,
            billing_amount: subscriptionAmount,
            billing_status: "uninvoiced",
            triggered_at: now.toISOString(),
            triggered_by: null,
            billing_period_start: toDateOnly(subscriptionPeriodStart),
            billing_period_end: toDateOnly(subscriptionPeriodEnd),
            metadata: {
              source: "monthly_billing_run",
              billing_run_id: run.id,
              billing_month: run.billing_month,
              licence_count: plan === "unlimited" ? activeAfsUsers : null,
              unit_price: unitPrice,
            },
          });

        if (subscriptionInsertError && subscriptionInsertError.code !== "23505") {
          throw subscriptionInsertError;
        }
      }

      /*
       * Pull all unbatched events for this organisation.
       * We then decide in JS which events belong in this run.
       */
      const { data: rawEvents, error: eventsError } = await supabase
        .from("afs_billing_events")
        .select(
          "id,organisation_id,billing_plan,pricing_tier,charge_type,billing_amount,billing_status,triggered_at,billing_period_start,billing_period_end,billing_run_id,billing_batch_id"
        )
        .eq("organisation_id", organisation.id)
        .is("billing_batch_id", null)
        .order("triggered_at", { ascending: true });

      if (eventsError) throw eventsError;

      const events = (rawEvents ?? []) as BillingEvent[];

      const selectedEvents = events.filter((event) => {
        const amount = Number(event.billing_amount || 0);
        const status = String(event.billing_status || "").toLowerCase();
        const triggeredAt = event.triggered_at
          ? new Date(event.triggered_at)
          : null;

        const isCurrentSubscription =
          event.charge_type === subscriptionChargeType &&
          event.billing_period_start === toDateOnly(subscriptionPeriodStart) &&
          event.billing_period_end === toDateOnly(subscriptionPeriodEnd);

        if (isCurrentSubscription) return true;

        if (!triggeredAt) return false;

        const inUsageWindow =
          triggeredAt >= usagePeriodStart &&
          triggeredAt <= endOfDayUtc(usagePeriodEnd);

        // Keep R0/free/covered events in the audit trail for this cycle.
        if (
          inUsageWindow &&
          (status === "free" || status === "covered" || amount === 0)
        ) {
          return true;
        }

        // Sweep all old uninvoiced positive charges up to the cut-off.
        if (
          amount > 0 &&
          status === "uninvoiced" &&
          triggeredAt <= endOfDayUtc(usagePeriodEnd)
        ) {
          return true;
        }

        return false;
      });

      if (selectedEvents.length === 0) {
        continue;
      }

      const chargeableItems = selectedEvents.filter(
        (event) =>
          Number(event.billing_amount || 0) > 0 &&
          String(event.billing_status || "").toLowerCase() === "uninvoiced"
      );

      const freeItems = selectedEvents.filter(
        (event) =>
          String(event.billing_status || "").toLowerCase() === "free"
      );

      const coveredItems = selectedEvents.filter(
        (event) =>
          String(event.billing_status || "").toLowerCase() === "covered"
      );

      const subtotal = chargeableItems.reduce(
        (total, event) => total + Number(event.billing_amount || 0),
        0
      );

      const { data: batch, error: batchError } = await supabase
        .from("afs_billing_run_batches")
        .insert({
          billing_run_id: run.id,
          organisation_id: organisation.id,
          organisation_name: organisation.name,
          billing_plan: plan,
          pricing_tier: organisation.afs_pricing_tier || "launch",
          free_items_count: freeItems.length,
          covered_items_count: coveredItems.length,
          chargeable_items_count: chargeableItems.length,
          subtotal,
          status: "ready",
        })
        .select("id")
        .single();

      if (batchError || !batch) {
        throw batchError || new Error(`Could not create batch for ${organisation.name}.`);
      }

      const eventIds = selectedEvents.map((event) => event.id);

      const { error: attachError } = await supabase
        .from("afs_billing_events")
        .update({
          billing_run_id: run.id,
          billing_batch_id: batch.id,
          updated_at: now.toISOString(),
        })
        .in("id", eventIds)
        .is("billing_batch_id", null);

      if (attachError) throw attachError;

      results.push({
        organisation_id: organisation.id,
        organisation_name: organisation.name,
        batch_id: batch.id,
        subtotal,
        chargeable_items: chargeableItems.length,
        free_items: freeItems.length,
        covered_items: coveredItems.length,
        status: "ready",
      });
    }

    const totalInvoiceValue = results.reduce(
      (total, item) => total + Number(item.subtotal || 0),
      0
    );

    const invoiceBatchCount = results.filter(
      (item) => item.batch_id && item.subtotal > 0
    ).length;

    const { error: finaliseRunError } = await supabase
      .from("afs_billing_runs")
      .update({
        status: "ready",
        updated_at: now.toISOString(),
        notes: `${invoiceBatchCount} invoice batch(es), total R${totalInvoiceValue.toFixed(
          2
        )}.`,
      })
      .eq("id", run.id);

    if (finaliseRunError) throw finaliseRunError;

    return NextResponse.json({
      success: true,
      billing_run_id: run.id,
      billing_month: run.billing_month,
      cutoff_date: run.cutoff_date,
      run_date: run.run_date,
      usage_period: {
        start: toDateOnly(usagePeriodStart),
        end: toDateOnly(usagePeriodEnd),
      },
      subscription_period: {
        start: toDateOnly(subscriptionPeriodStart),
        end: toDateOnly(subscriptionPeriodEnd),
      },
      organisation_batches: results.length,
      invoice_batches: invoiceBatchCount,
      invoice_total: totalInvoiceValue,
      results,
    });
  } catch (error: any) {
    // If generation fails, leave a visible failed/draft run rather than silently losing it.
    try {
      await supabase
        .from("afs_billing_runs")
        .update({
          status: "draft",
          notes: `Generation failed: ${error?.message || "Unknown error"}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", run.id);
    } catch {
      // Ignore secondary logging failure.
    }

    throw error;
  }
}

export async function GET(request: Request) {
  try {
    return await generateRun(request);
  } catch (error: any) {
    console.error("AFS monthly billing run failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "AFS monthly billing run failed.",
      },
      { status: 500 }
    );
  }
}
