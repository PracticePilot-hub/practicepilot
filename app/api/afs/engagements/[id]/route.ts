import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "../../lib/supabaseServer";

async function getIdFromContext(context: any) {
  const params = await context?.params;
  const id = params?.id;

  if (!id || typeof id !== "string") {
    throw new Error("Missing AFS engagement id.");
  }

  return id;
}

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
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


export async function GET(req: NextRequest, context: any) {
  try {
    const id = await getIdFromContext(context);
    const supabase = getSupabaseServer();

    const { data: engagement, error: engagementError } = await supabase
      .from("afs_engagements")
      .select("*")
      .eq("id", id)
      .single();

    if (engagementError) {
      throw engagementError;
    }

    const [
      trialBalanceResult,
      trialBalanceHistoryResult,
      notesResult,
      workingPapersResult,
    ] = await Promise.all([
      supabase
        .from("afs_trial_balance_lines")
        .select("*")
        .eq("engagement_id", id)
        .order("account_code", { ascending: true }),

      supabase
        .from("afs_trial_balance_history")
        .select("*")
        .eq("engagement_id", id)
        .order("financial_year_end", { ascending: true })
        .order("account_code", { ascending: true }),

      supabase
        .from("afs_notes")
        .select("*")
        .eq("engagement_id", id)
        .order("sort_order", { ascending: true }),

      supabase
        .from("afs_working_papers")
        .select("*")
        .eq("engagement_id", id)
        .order("created_at", { ascending: true }),
    ]);

    if (trialBalanceResult.error) throw trialBalanceResult.error;
    if (trialBalanceHistoryResult.error) throw trialBalanceHistoryResult.error;
    if (notesResult.error) throw notesResult.error;
    if (workingPapersResult.error) throw workingPapersResult.error;

    return NextResponse.json({
      engagement,
      trialBalanceLines: trialBalanceResult.data || [],
      trialBalanceHistory: trialBalanceHistoryResult.data || [],
      notes: notesResult.data || [],
      workingPapers: workingPapersResult.data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load AFS engagement." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, context: any) {
  try {
    const id = await getIdFromContext(context);
    const body = await req.json();
    const supabase = getSupabaseServer();

    const action = cleanText(body.action);

    if (action === "sign-off") {
      const readiness = await getFlightControlReadiness(supabase, id);

      if (!readiness.readyForFinalisation) {
        return NextResponse.json(
          {
            success: false,
            code: "AFS_NOT_READY_FOR_FINALISATION",
            error:
              "This AFS flight cannot be signed off yet. Complete Flight Control first.",
            blockers: readiness.blockers,
            summary: readiness.summary,
          },
          { status: 409 },
        );
      }

      const { data, error } = await supabase
        .from("afs_engagements")
        .update({
          status: "Final",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        engagement: data,
        message: "Flight signed off successfully.",
      });
    }

    if (action === "reopen") {
      const reason = cleanText(body.reason);

      if (!reason) {
        return NextResponse.json(
          { error: "A reason is required before reopening the flight." },
          { status: 400 }
        );
      }

      const { data: existing, error: existingError } = await supabase
        .from("afs_engagements")
        .select("notes")
        .eq("id", id)
        .single();

      if (existingError) throw existingError;

      const reopenedEntry = [
        existing?.notes || "",
        `Reopened: ${new Date().toISOString()} — ${reason}`,
      ]
        .filter(Boolean)
        .join("\n");

      const { data, error } = await supabase
        .from("afs_engagements")
        .update({
          status: "Reopened",
          notes: reopenedEntry,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        engagement: data,
        message: "Flight reopened successfully.",
      });
    }

    const updateData = {
      client_name: cleanText(body.clientName),
      entity_type: cleanText(body.entityType),
      financial_year_end: cleanText(body.financialYearEnd),
      status: cleanText(body.status) || "Draft",
      prepared_by: cleanText(body.preparedBy),
      reviewed_by: cleanText(body.reviewedBy),
      notes: cleanText(body.notes),
      updated_at: new Date().toISOString(),
    };

    if (!updateData.client_name) {
      return NextResponse.json(
        { error: "Client name is required." },
        { status: 400 }
      );
    }

    if (!updateData.financial_year_end) {
      return NextResponse.json(
        { error: "Financial year end is required." },
        { status: 400 }
      );
    }

    if (updateData.status === "Final") {
      const readiness = await getFlightControlReadiness(supabase, id);

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
      .update(updateData)
      .eq("id", id)
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

export async function DELETE(req: NextRequest, context: any) {
  try {
    const id = await getIdFromContext(context);
    const supabase = getSupabaseServer();

    const { error } = await supabase
      .from("afs_engagements")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete AFS engagement." },
      { status: 500 }
    );
  }
}
