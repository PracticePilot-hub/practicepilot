// Path: app/api/afs/engagements/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "../lib/supabaseServer";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

async function getFallbackOrganisation(
  supabase: ReturnType<typeof getSupabaseServer>
) {
  const { data } = await supabase
    .from("organisations")
    .select("id, name")
    .ilike("name", "Bizzacc Menlyn%")
    .limit(1)
    .maybeSingle();

  return data || null;
}

function getMonthWindow(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export async function GET() {
  try {
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from("afs_engagements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ engagements: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load AFS engagements." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let createdEngagementId: string | null = null;

  try {
    const body = await req.json();

    const clientName = cleanText(body.clientName);
    const entityType = cleanText(body.entityType);
    const financialYearEnd = cleanText(body.financialYearEnd);
    const preparedBy = cleanText(body.preparedBy);
    const reviewedBy = cleanText(body.reviewedBy);
    const notes = cleanText(body.notes);

    const clientId = cleanText(body.clientId ?? body.crmClientId);

    const organisationId = cleanText(
      body.organisationId ?? body.firmClientId ?? body.clientOrganisationId
    );

    const firmClientName = cleanText(
      body.firmClientName ??
        body.organisationName ??
        body.clientOrganisationName
    );

    if (!clientName) {
      return NextResponse.json(
        { error: "Client name is required." },
        { status: 400 }
      );
    }

    if (!financialYearEnd) {
      return NextResponse.json(
        { error: "Financial year end is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    let finalOrganisationId = organisationId || null;
    let finalFirmClientName = firmClientName || null;

    if (!finalOrganisationId) {
      const fallbackOrganisation = await getFallbackOrganisation(supabase);

      if (fallbackOrganisation?.id) {
        finalOrganisationId = fallbackOrganisation.id;
        finalFirmClientName =
          finalFirmClientName || fallbackOrganisation.name;
      }
    }

    if (finalOrganisationId && !finalFirmClientName) {
      const { data: organisation } = await supabase
        .from("organisations")
        .select("id, name")
        .eq("id", finalOrganisationId)
        .maybeSingle();

      if (organisation?.name) {
        finalFirmClientName = organisation.name;
      }
    }

    if (!finalOrganisationId) {
      return NextResponse.json(
        {
          error:
            "This AFS engagement is not linked to a PracticePilot organisation.",
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------------------
     * AFS BILLING PRE-CHECK
     * ------------------------------------------------------------
     * We decide the billing treatment BEFORE creating the engagement.
     *
     * Rules:
     * 1. First free credits are always used first.
     * 2. Once free credits are exhausted, a plan must already be selected.
     * 3. Flex:
     *    - first chargeable AFS in each calendar month is included
     *    - additional AFS are billed at the organisation's Flex extra price
     * 4. Unlimited:
     *    - every AFS is covered by the monthly licence plan
     * 5. One billing event is created per engagement.
     */

    const { data: billingOrganisation, error: billingOrganisationError } =
      await supabase
        .from("organisations")
        .select(
          `
            id,
            afs_billing_enabled,
            afs_plan,
            afs_pricing_tier,
            afs_flex_monthly_fee,
            afs_flex_included_per_month,
            afs_flex_extra_price,
            afs_unlimited_user_price,
            afs_unlimited_licence_count,
            afs_free_credits_total
          `
        )
        .eq("id", finalOrganisationId)
        .single();

    if (billingOrganisationError || !billingOrganisation) {
      return NextResponse.json(
        { error: "Could not load AFS billing settings for this firm." },
        { status: 500 }
      );
    }

    const freeCreditLimit = Math.max(
      Number(billingOrganisation.afs_free_credits_total || 2),
      0
    );

    const { count: freeCreditsUsed, error: freeCreditsError } = await supabase
      .from("afs_billing_events")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", finalOrganisationId)
      .eq("charge_type", "free_credit")
      .neq("billing_status", "cancelled");

    if (freeCreditsError) {
      return NextResponse.json(
        { error: freeCreditsError.message },
        { status: 500 }
      );
    }

    const freeCreditsRemainingBefore = Math.max(
      freeCreditLimit - Number(freeCreditsUsed || 0),
      0
    );

    const selectedPlan = billingOrganisation.afs_plan as
      | "flex"
      | "unlimited"
      | null;

    if (freeCreditsRemainingBefore === 0 && !selectedPlan) {
      return NextResponse.json(
        {
          error:
            "Your free AFS have been used. Choose an AFS billing plan before creating another engagement.",
          code: "AFS_PLAN_REQUIRED",
        },
        { status: 409 }
      );
    }

    let chargeType:
      | "free_credit"
      | "flex_included"
      | "flex_extra"
      | "unlimited_covered";

    let billingAmount = 0;
    let billingStatus: "free" | "covered" | "uninvoiced";

    if (freeCreditsRemainingBefore > 0) {
      chargeType = "free_credit";
      billingAmount = 0;
      billingStatus = "free";
    } else if (selectedPlan === "flex") {
      const { start, end } = getMonthWindow();

      const { count: flexUsageThisMonth, error: flexUsageError } =
        await supabase
          .from("afs_billing_events")
          .select("id", { count: "exact", head: true })
          .eq("organisation_id", finalOrganisationId)
          .eq("billing_plan", "flex")
          .in("charge_type", ["flex_included", "flex_extra"])
          .neq("billing_status", "cancelled")
          .gte("triggered_at", start)
          .lt("triggered_at", end);

      if (flexUsageError) {
        return NextResponse.json(
          { error: flexUsageError.message },
          { status: 500 }
        );
      }

      const includedPerMonth = Math.max(
        Number(billingOrganisation.afs_flex_included_per_month || 1),
        0
      );

      if (Number(flexUsageThisMonth || 0) < includedPerMonth) {
        chargeType = "flex_included";
        billingAmount = 0;
        billingStatus = "covered";
      } else {
        chargeType = "flex_extra";
        billingAmount = Number(
          billingOrganisation.afs_flex_extra_price || 0
        );
        billingStatus = "uninvoiced";
      }
    } else {
      chargeType = "unlimited_covered";
      billingAmount = 0;
      billingStatus = "covered";
    }

    const { data, error } = await supabase
      .from("afs_engagements")
      .insert({
        client_name: clientName,
        entity_type: entityType || null,
        financial_year_end: financialYearEnd,
        status: "Draft",
        prepared_by: preparedBy || null,
        reviewed_by: reviewedBy || null,
        notes: notes || null,
        organisation_id: finalOrganisationId,
        firm_client_name: finalFirmClientName,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    createdEngagementId = data.id;

    /*
     * ------------------------------------------------------------
     * CREATE THE BILLING EVENT
     * ------------------------------------------------------------
     */

    const { error: billingEventError } = await supabase
      .from("afs_billing_events")
      .insert({
        billing_identity_key: `afs-engagement:${data.id}`,
        organisation_id: finalOrganisationId,
        engagement_id: data.id,
        client_id: clientId || null,
        client_name: clientName,
        financial_year_end: financialYearEnd,
        billing_plan: selectedPlan,
        pricing_tier: billingOrganisation.afs_pricing_tier || "launch",
        charge_type: chargeType,
        billing_amount: billingAmount,
        billing_status: billingStatus,
        invoice_number: null,
        triggered_at: new Date().toISOString(),
      });

    if (billingEventError) {
      // Do not leave behind an engagement that was never registered for billing.
      await supabase
        .from("afs_engagements")
        .delete()
        .eq("id", data.id);

      createdEngagementId = null;

      throw new Error(
        `AFS engagement was not created because billing registration failed: ${billingEventError.message}`
      );
    }

    /*
     * If this engagement used the LAST free credit and a plan has already
     * been selected, switch the paid plan on for the NEXT engagement.
     */
    const freeCreditsRemainingAfter =
      chargeType === "free_credit"
        ? Math.max(freeCreditsRemainingBefore - 1, 0)
        : freeCreditsRemainingBefore;

    if (
      chargeType === "free_credit" &&
      freeCreditsRemainingAfter === 0 &&
      selectedPlan
    ) {
      const { error: activatePlanError } = await supabase
        .from("organisations")
        .update({ afs_billing_enabled: true })
        .eq("id", finalOrganisationId);

      if (activatePlanError) {
        console.error(
          "AFS plan activation failed after final free credit:",
          activatePlanError
        );
      }
    }

    return NextResponse.json({
      engagement: data,
      billing: {
        chargeType,
        amount: billingAmount,
        status: billingStatus,
        freeCreditsRemaining: freeCreditsRemainingAfter,
        plan: selectedPlan,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to create AFS engagement.",
        engagementId: createdEngagementId,
      },
      { status: 500 }
    );
  }
}
