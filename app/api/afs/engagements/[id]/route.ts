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

    if (trialBalanceResult.error) {
      throw trialBalanceResult.error;
    }

    if (trialBalanceHistoryResult.error) {
      throw trialBalanceHistoryResult.error;
    }

    if (notesResult.error) {
      throw notesResult.error;
    }

    if (workingPapersResult.error) {
      throw workingPapersResult.error;
    }

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
      const { data, error } = await supabase
        .from("afs_engagements")
        .update({
          status: "Final",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

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

      if (existingError) {
        throw existingError;
      }

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

      if (error) {
        throw error;
      }

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
