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

    const { data: trialBalanceLines, error: tbError } = await supabase
      .from("afs_trial_balance_lines")
      .select("*")
      .eq("engagement_id", id)
      .order("account_code", { ascending: true });

    if (tbError) {
      throw tbError;
    }

    const { data: notes, error: notesError } = await supabase
      .from("afs_notes")
      .select("*")
      .eq("engagement_id", id)
      .order("sort_order", { ascending: true });

    if (notesError) {
      throw notesError;
    }

    const { data: workingPapers, error: wpError } = await supabase
      .from("afs_working_papers")
      .select("*")
      .eq("engagement_id", id)
      .order("created_at", { ascending: true });

    if (wpError) {
      throw wpError;
    }

    return NextResponse.json({
      engagement,
      trialBalanceLines: trialBalanceLines || [],
      notes: notes || [],
      workingPapers: workingPapers || [],
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

    const updateData = {
      client_name: String(body.clientName || "").trim(),
      entity_type: String(body.entityType || "").trim() || null,
      financial_year_end: String(body.financialYearEnd || "").trim(),
      status: String(body.status || "Draft").trim(),
      prepared_by: String(body.preparedBy || "").trim() || null,
      reviewed_by: String(body.reviewedBy || "").trim() || null,
      notes: String(body.notes || "").trim() || null,
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

    const { data, error } = await supabase
      .from("afs_engagements")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

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

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete AFS engagement." },
      { status: 500 }
    );
  }
}