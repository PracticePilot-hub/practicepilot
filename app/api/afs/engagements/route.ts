// Path: app/api/afs/engagements/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "../lib/supabaseServer";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

const AFS_METHODOLOGY_VERSION = "afs-2026.08.25.1";

async function buildMethodologySnapshot(
  supabase: ReturnType<typeof getSupabaseServer>,
  organisationId: string,
) {
  const { data: organisation, error } = await supabase
    .from("organisations")
    .select(
      "id,name,afs_default_workflow_levels,afs_allow_solo,afs_allow_three_level,afs_section_signoff_defaults,afs_white_label_documents",
    )
    .eq("id", organisationId)
    .single();

  if (error || !organisation) {
    throw new Error(
      error?.message || "Could not load the AFS methodology settings for this practice.",
    );
  }

  const capturedAt = new Date().toISOString();

  return {
    version: AFS_METHODOLOGY_VERSION,
    lockedAt: capturedAt,
    snapshot: {
      schemaVersion: 1,
      productMethodologyVersion: AFS_METHODOLOGY_VERSION,
      legacyBackfill: false,
      organisationId: organisation.id,
      organisationName: organisation.name,
      workflow: {
        defaultWorkflowLevels: Number(
          organisation.afs_default_workflow_levels || 2,
        ),
        allowSolo: Boolean(organisation.afs_allow_solo),
        allowThreeLevel: Boolean(organisation.afs_allow_three_level),
        sectionSignoffDefaults:
          organisation.afs_section_signoff_defaults || {},
      },
      documents: {
        whiteLabel: Boolean(organisation.afs_white_label_documents),
      },
      capturedAt,
    },
  };
}

type Applicability = "required" | "conditional" | "not_applicable" | "optional";

const FINALISATION_SECTIONS = [
  { key: "client-setup", defaultApplicability: "required" },
  { key: "trial-balance", defaultApplicability: "required" },
  { key: "adjusting-journals", defaultApplicability: "conditional" },
  { key: "mapping", defaultApplicability: "required" },
  { key: "lead-schedules", defaultApplicability: "conditional" },
  { key: "tax-calculator", defaultApplicability: "required" },
  { key: "financial-statements", defaultApplicability: "required" },
  { key: "minutes", defaultApplicability: "conditional" },
  { key: "export-print", defaultApplicability: "optional" },
] as const;

function numericValue(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function cleanLeadKey(value: unknown) {
  return String(value || "").trim();
}

async function getFlightControlReadiness(
  supabase: ReturnType<typeof getSupabaseServer>,
  engagementId: string,
) {
  const { data: engagement, error: engagementError } = await supabase
    .from("afs_engagements")
    .select("id,organisation_id,status")
    .eq("id", engagementId)
    .single();

  if (engagementError) throw engagementError;

  const organisationId = String(engagement?.organisation_id || "").trim();

  if (!organisationId) {
    return {
      readyForFinalisation: false,
      blockers: ["The AFS engagement is not linked to a practice."],
      summary: null,
    };
  }

  const [
    { data: workflow, error: workflowError },
    { data: signoffs, error: signoffError },
    { data: reviewPoints, error: reviewError },
    { data: applicabilityRows, error: applicabilityError },
    { data: trialBalanceLines, error: trialBalanceError },
    { data: leadAnnotations, error: leadAnnotationsError },
    { data: workingPapers, error: workingPapersError },
  ] = await Promise.all([
    supabase
      .from("afs_engagement_workflow")
      .select("workflow_levels,is_started")
      .eq("engagement_id", engagementId)
      .eq("organisation_id", organisationId)
      .maybeSingle(),

    supabase
      .from("afs_section_signoffs")
      .select(
        "section_key,prepared_at,reviewed_at,captain_cleared_at",
      )
      .eq("engagement_id", engagementId)
      .eq("organisation_id", organisationId),

    supabase
      .from("afs_review_points")
      .select("section_key,status")
      .eq("engagement_id", engagementId)
      .eq("organisation_id", organisationId),

    supabase
      .from("afs_section_applicability")
      .select("section_key,applicability")
      .eq("engagement_id", engagementId)
      .eq("organisation_id", organisationId),

    supabase
      .from("afs_trial_balance_lines")
      .select(
        "lead_schedule_key,lead_schedule_number,current_year_balance,prior_year_balance,debit,credit",
      )
      .eq("engagement_id", engagementId),

    supabase
      .from("afs_lead_schedule_annotations")
      .select("schedule_key")
      .eq("engagement_id", engagementId),

    supabase
      .from("afs_working_papers")
      .select("lead_schedule_key,lead_schedule_number")
      .eq("engagement_id", engagementId),
  ]);

  if (workflowError) throw workflowError;
  if (signoffError) throw signoffError;
  if (reviewError) throw reviewError;
  if (applicabilityError) throw applicabilityError;
  if (trialBalanceError) throw trialBalanceError;
  if (leadAnnotationsError) throw leadAnnotationsError;
  if (workingPapersError) throw workingPapersError;

  const signoffBySection = new Map(
    (signoffs || []).map((row: any) => [row.section_key, row]),
  );

  const applicabilityBySection = new Map(
    (applicabilityRows || []).map((row: any) => [row.section_key, row]),
  );

  const pointsBySection = new Map<
    string,
    { open: number; resolved: number; cleared: number }
  >();

  for (const point of reviewPoints || []) {
    const current = pointsBySection.get(point.section_key) || {
      open: 0,
      resolved: 0,
      cleared: 0,
    };

    if (point.status === "open") current.open += 1;
    if (point.status === "resolved") current.resolved += 1;
    if (point.status === "cleared") current.cleared += 1;

    pointsBySection.set(point.section_key, current);
  }

  const levels = Number(workflow?.workflow_levels || 2);

  const usedLeadKeys = new Set<string>();

  for (const line of trialBalanceLines || []) {
    const key = cleanLeadKey(line.lead_schedule_key);
    if (!key) continue;

    const current =
      line.current_year_balance !== null &&
      line.current_year_balance !== undefined
        ? numericValue(line.current_year_balance)
        : numericValue(line.debit) - numericValue(line.credit);

    const prior = numericValue(line.prior_year_balance);

    if (Math.abs(current) >= 0.005 || Math.abs(prior) >= 0.005) {
      usedLeadKeys.add(key);
    }
  }

  for (const annotation of leadAnnotations || []) {
    const key = cleanLeadKey(annotation.schedule_key);
    if (key) usedLeadKeys.add(key);
  }

  for (const paper of workingPapers || []) {
    const key = cleanLeadKey(paper.lead_schedule_key);
    if (key) usedLeadKeys.add(key);
  }

  const usedLeadSchedules = Array.from(usedLeadKeys).map((key) => {
    const signoffKey = `lead-schedule:${key}`;
    const signoff: any = signoffBySection.get(signoffKey) || null;
    const points = pointsBySection.get(signoffKey) || {
      open: 0,
      resolved: 0,
      cleared: 0,
    };

    const prepared = Boolean(signoff?.prepared_at);
    const reviewed = Boolean(signoff?.reviewed_at);
    const captainCleared = Boolean(signoff?.captain_cleared_at);

    const signedComplete =
      levels === 1
        ? captainCleared
        : prepared && reviewed && captainCleared;

    return {
      key,
      prepared,
      reviewed,
      captainCleared,
      complete: signedComplete && points.open === 0,
      reviewPoints: points,
    };
  });

  const sections = FINALISATION_SECTIONS.map((section) => {
    const signoff: any = signoffBySection.get(section.key) || null;
    const applicabilityRow: any =
      applicabilityBySection.get(section.key) || null;

    const applicability = (
      applicabilityRow?.applicability || section.defaultApplicability
    ) as Applicability;

    const points = pointsBySection.get(section.key) || {
      open: 0,
      resolved: 0,
      cleared: 0,
    };

    if (section.key === "lead-schedules" && usedLeadSchedules.length > 0) {
      const usedComplete = usedLeadSchedules.filter(
        (item) => item.complete,
      ).length;
      const usedPrepared = usedLeadSchedules.filter(
        (item) => item.prepared,
      ).length;
      const usedReviewed = usedLeadSchedules.filter(
        (item) => item.reviewed,
      ).length;
      const usedCaptain = usedLeadSchedules.filter(
        (item) => item.captainCleared,
      ).length;

      const leadOpenPoints = usedLeadSchedules.reduce(
        (total, item) =>
          total + Number(item.reviewPoints.open || 0),
        Number(points.open || 0),
      );

      return {
        key: section.key,
        applicability,
        prepared: usedPrepared === usedLeadSchedules.length,
        reviewed: usedReviewed === usedLeadSchedules.length,
        captainCleared: usedCaptain === usedLeadSchedules.length,
        complete:
          usedComplete === usedLeadSchedules.length &&
          leadOpenPoints === 0,
        openReviewPoints: leadOpenPoints,
      };
    }

    const prepared = Boolean(signoff?.prepared_at);
    const reviewed = Boolean(signoff?.reviewed_at);
    const captainCleared = Boolean(signoff?.captain_cleared_at);

    const signedComplete =
      levels === 1
        ? captainCleared
        : prepared && reviewed && captainCleared;

    return {
      key: section.key,
      applicability,
      prepared,
      reviewed,
      captainCleared,
      complete: signedComplete && points.open === 0,
      openReviewPoints: Number(points.open || 0),
    };
  });

  const requiredSections = sections.filter(
    (section) => section.applicability === "required",
  );

  const openReviewPoints = sections.reduce(
    (sum, section) => sum + Number(section.openReviewPoints || 0),
    0,
  );

  const blockingOpenReviewPoints = requiredSections.reduce(
    (sum, section) => sum + Number(section.openReviewPoints || 0),
    0,
  );

  const completeCount = requiredSections.filter(
    (section) => section.complete,
  ).length;

  const readyForFinalisation =
    Boolean(workflow?.is_started) &&
    requiredSections.length > 0 &&
    completeCount === requiredSections.length &&
    blockingOpenReviewPoints === 0;

  const blockers: string[] = [];

  if (!workflow?.is_started) {
    blockers.push("The AFS flight has not been started.");
  }

  for (const section of requiredSections) {
    if (!section.complete) {
      blockers.push(
        `${section.key} is not fully signed off or still has an open review point.`,
      );
    }
  }

  if (blockingOpenReviewPoints > 0) {
    blockers.push(
      `${blockingOpenReviewPoints} open review point${
        blockingOpenReviewPoints === 1 ? "" : "s"
      } remain in required sections.`,
    );
  }

  return {
    readyForFinalisation,
    blockers: [...new Set(blockers)],
    summary: {
      requiredTotal: requiredSections.length,
      completeCount,
      openReviewPoints,
      blockingOpenReviewPoints,
      usedLeadScheduleCount: usedLeadSchedules.length,
    },
  };
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

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const engagementId = cleanText(body.engagementId);
    const status = cleanText(body.status);

    if (!engagementId) {
      return NextResponse.json(
        { error: "Engagement id is required." },
        { status: 400 }
      );
    }

    if (!["Draft", "Final", "Reopened", "Archived"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid AFS engagement status." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    if (status === "Final") {
      const readiness = await getFlightControlReadiness(supabase, engagementId);

      if (!readiness.readyForFinalisation) {
        return NextResponse.json(
          {
            success: false,
            code: "AFS_NOT_READY_FOR_FINALISATION",
            error:
              "This AFS flight cannot be marked Final until Flight Control is complete.",
            blockers: readiness.blockers,
            summary: readiness.summary,
          },
          { status: 409 },
        );
      }
    }

    const { data, error } = await supabase
      .from("afs_engagements")
      .update({ status })
      .eq("id", engagementId)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ engagement: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update AFS engagement." },
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

    const methodology = await buildMethodologySnapshot(
      supabase,
      finalOrganisationId,
    );

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
        afs_methodology_version: methodology.version,
        afs_methodology_snapshot: methodology.snapshot,
        afs_methodology_locked_at: methodology.lockedAt,
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
