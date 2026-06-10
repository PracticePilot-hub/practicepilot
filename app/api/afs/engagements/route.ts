import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "../lib/supabaseServer";

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
  try {
    const body = await req.json();

    const clientName = String(body.clientName || "").trim();
    const entityType = String(body.entityType || "").trim();
    const financialYearEnd = String(body.financialYearEnd || "").trim();
    const preparedBy = String(body.preparedBy || "").trim();
    const reviewedBy = String(body.reviewedBy || "").trim();
    const notes = String(body.notes || "").trim();

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
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ engagement: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create AFS engagement." },
      { status: 500 }
    );
  }
}