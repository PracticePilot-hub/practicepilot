import { NextResponse } from "next/server";
import { getSupabaseServer } from "../../../lib/supabaseServer";

async function invalidateLeadScheduleSignoff(
  supabase: ReturnType<typeof getSupabaseServer>,
  engagementId: string,
  scheduleKey: string,
  reason: string,
) {
  const cleanScheduleKey = String(scheduleKey || "").trim();
  if (!cleanScheduleKey) return;

  const sectionKey = `lead-schedule:${cleanScheduleKey}`;

  const { data: existing, error: existingError } = await supabase
    .from("afs_section_signoffs")
    .select("id,prepared_at,reviewed_at,captain_cleared_at")
    .eq("engagement_id", engagementId)
    .eq("section_key", sectionKey)
    .maybeSingle();

  if (existingError) throw existingError;

  if (
    !existing?.id ||
    (!existing.prepared_at &&
      !existing.reviewed_at &&
      !existing.captain_cleared_at)
  ) {
    return;
  }

  const now = new Date().toISOString();

  const { error: reopenError } = await supabase
    .from("afs_section_signoffs")
    .update({
      prepared_by: null,
      prepared_at: null,
      reviewed_by: null,
      reviewed_at: null,
      captain_cleared_by: null,
      captain_cleared_at: null,
      reopened_at: now,
      reopen_reason: reason,
      updated_at: now,
    })
    .eq("id", existing.id);

  if (reopenError) throw reopenError;
}

export async function GET(request: Request, context: any) {
  try {
    const params = await context?.params;
    const engagementId = params?.id;

    if (!engagementId) {
      return NextResponse.json(
        { error: "Missing engagement id." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from("afs_lead_schedule_annotations")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ annotations: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load annotations." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: any) {
  try {
    const params = await context?.params;
    const engagementId = params?.id;

    if (!engagementId) {
      return NextResponse.json(
        { error: "Missing engagement id." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const scheduleKey = String(
      body?.scheduleKey || "cash-and-cash-equivalents",
    ).trim();
    const trialBalanceLineId =
      String(body?.trialBalanceLineId || "").trim() || null;
    const tickmarkCode = String(body?.tickmarkCode || "").trim() || null;

    const supabase = getSupabaseServer();

    const payload = {
      engagement_id: engagementId,
      trial_balance_line_id: trialBalanceLineId,
      schedule_key: scheduleKey,
      reference_code: body?.referenceCode || null,
      tickmark_code: tickmarkCode,
      tickmark_label: body?.tickmarkLabel || null,
      annotation_note: body?.annotationNote || null,
      prepared_by: body?.preparedBy || null,
      reviewed_by: body?.reviewedBy || null,
      updated_at: new Date().toISOString(),
    };

    let annotation: any = null;

    /*
      Multiple tickmarks ARE allowed on the same TB line.

      The only duplicate we prevent is the exact same tickmark code being
      added repeatedly to the same TB line in the same lead schedule.
      Example:
        BR = agreed to bank reconciliation
        BS = agreed to bank statement
      Both may coexist on one account line.
    */
    if (trialBalanceLineId && tickmarkCode) {
      const { data: existing, error: existingError } = await supabase
        .from("afs_lead_schedule_annotations")
        .select("id")
        .eq("engagement_id", engagementId)
        .eq("schedule_key", scheduleKey)
        .eq("trial_balance_line_id", trialBalanceLineId)
        .eq("tickmark_code", tickmarkCode)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.id) {
        const { data, error } = await supabase
          .from("afs_lead_schedule_annotations")
          .update(payload)
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        annotation = data;
      }
    }

    if (!annotation) {
      const { data, error } = await supabase
        .from("afs_lead_schedule_annotations")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      annotation = data;
    }

    await invalidateLeadScheduleSignoff(
      supabase,
      engagementId,
      scheduleKey,
      `${scheduleKey} changed after sign-off: lead-schedule annotation changed.`,
    );

    return NextResponse.json({ annotation });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save annotation." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: any) {
  try {
    const params = await context?.params;
    const engagementId = params?.id;

    if (!engagementId) {
      return NextResponse.json(
        { error: "Missing engagement id." },
        { status: 400 },
      );
    }

    const body = await request.json();

    if (!body?.id) {
      return NextResponse.json(
        { error: "Missing annotation id." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServer();

    const { data: current, error: currentError } = await supabase
      .from("afs_lead_schedule_annotations")
      .select("id,schedule_key")
      .eq("id", body.id)
      .eq("engagement_id", engagementId)
      .single();

    if (currentError) {
      return NextResponse.json({ error: currentError.message }, { status: 500 });
    }

    const scheduleKey = String(
      current?.schedule_key || body?.scheduleKey || "",
    ).trim();

    const { data, error } = await supabase
      .from("afs_lead_schedule_annotations")
      .update({
        reference_code: body?.referenceCode || null,
        tickmark_code: body?.tickmarkCode || null,
        tickmark_label: body?.tickmarkLabel || null,
        annotation_note: body?.annotationNote || null,
        prepared_by: body?.preparedBy || null,
        reviewed_by: body?.reviewedBy || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .eq("engagement_id", engagementId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (scheduleKey) {
      await invalidateLeadScheduleSignoff(
        supabase,
        engagementId,
        scheduleKey,
        `${scheduleKey} changed after sign-off: lead-schedule annotation changed.`,
      );
    }

    return NextResponse.json({ annotation: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update annotation." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: any) {
  try {
    const params = await context?.params;
    const engagementId = params?.id;

    if (!engagementId) {
      return NextResponse.json(
        { error: "Missing engagement id." },
        { status: 400 },
      );
    }

    const url = new URL(request.url);
    const annotationId = String(url.searchParams.get("id") || "").trim();

    if (!annotationId) {
      return NextResponse.json(
        { error: "Missing annotation id." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServer();

    const { data: current, error: currentError } = await supabase
      .from("afs_lead_schedule_annotations")
      .select("id,schedule_key")
      .eq("id", annotationId)
      .eq("engagement_id", engagementId)
      .single();

    if (currentError || !current) {
      return NextResponse.json(
        { error: currentError?.message || "Annotation not found." },
        { status: 404 },
      );
    }

    const { error } = await supabase
      .from("afs_lead_schedule_annotations")
      .delete()
      .eq("id", annotationId)
      .eq("engagement_id", engagementId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await invalidateLeadScheduleSignoff(
      supabase,
      engagementId,
      String(current.schedule_key || ""),
      `${String(current.schedule_key || "")} changed after sign-off: tickmark removed.`,
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to remove annotation." },
      { status: 500 },
    );
  }
}

