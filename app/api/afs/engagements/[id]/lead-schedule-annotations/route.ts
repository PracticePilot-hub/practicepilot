import { NextResponse } from "next/server";
import { getSupabaseServer } from "../../../lib/supabaseServer";

export async function GET(request: Request, context: any) {
  try {
    const params = await context?.params;
    const engagementId = params?.id;

    if (!engagementId) {
      return NextResponse.json(
        { error: "Missing engagement id." },
        { status: 400 }
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
      { status: 500 }
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
        { status: 400 }
      );
    }

    const body = await request.json();

    const supabase = getSupabaseServer();

    const payload = {
      engagement_id: engagementId,
      trial_balance_line_id: body?.trialBalanceLineId || null,
      schedule_key: body?.scheduleKey || "cash-and-cash-equivalents",
      reference_code: body?.referenceCode || null,
      tickmark_code: body?.tickmarkCode || null,
      tickmark_label: body?.tickmarkLabel || null,
      annotation_note: body?.annotationNote || null,
      prepared_by: body?.preparedBy || null,
      reviewed_by: body?.reviewedBy || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("afs_lead_schedule_annotations")
      .insert(payload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ annotation: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save annotation." },
      { status: 500 }
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
        { status: 400 }
      );
    }

    const body = await request.json();

    if (!body?.id) {
      return NextResponse.json(
        { error: "Missing annotation id." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

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

    return NextResponse.json({ annotation: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update annotation." },
      { status: 500 }
    );
  }
}