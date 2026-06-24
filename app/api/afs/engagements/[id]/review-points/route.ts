import { NextResponse } from "next/server";
import { getSupabaseServer } from "../../../lib/supabaseServer";

async function getId(context: any) {
  const params = await context?.params;
  return String(params?.id || "");
}

function cleanText(value: any) {
  const text = String(value || "").trim();
  return text.length > 0 ? text : null;
}

export async function GET(request: Request, context: any) {
  try {
    const engagementId = await getId(context);

    if (!engagementId) {
      return NextResponse.json(
        { error: "Missing engagement id." },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const sourceArea = url.searchParams.get("sourceArea");
    const supabase = getSupabaseServer();

    let query = supabase
      .from("afs_review_points")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("raised_at", { ascending: false });

    if (sourceArea) {
      query = query.eq("source_area", sourceArea);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ reviewPoints: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load review points." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: any) {
  try {
    const engagementId = await getId(context);

    if (!engagementId) {
      return NextResponse.json(
        { error: "Missing engagement id." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const supabase = getSupabaseServer();

    const title = cleanText(body.title) || "Review point";
    const detail = cleanText(body.detail);
    const sourceArea = cleanText(body.sourceArea) || "afs";
    const sourceId = cleanText(body.sourceId);
    const priority = cleanText(body.priority) || "normal";

    const { data, error } = await supabase
      .from("afs_review_points")
      .insert({
        engagement_id: engagementId,
        source_area: sourceArea,
        source_id: sourceId,
        title,
        detail,
        priority,
        assigned_to: cleanText(body.assignedTo),
        raised_by: cleanText(body.raisedBy),
        status: "Open",
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ reviewPoint: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save review point." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: any) {
  try {
    const engagementId = await getId(context);

    if (!engagementId) {
      return NextResponse.json(
        { error: "Missing engagement id." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const reviewPointId = cleanText(body.id);

    if (!reviewPointId) {
      return NextResponse.json(
        { error: "Missing review point id." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const status = cleanText(body.status) || "Open";

    const updateRecord: Record<string, any> = {
      status,
      response: cleanText(body.response),
      updated_at: new Date().toISOString(),
    };

    if (status === "Cleared" || status === "Resolved") {
      updateRecord.cleared_by = cleanText(body.clearedBy);
      updateRecord.cleared_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("afs_review_points")
      .update(updateRecord)
      .eq("id", reviewPointId)
      .eq("engagement_id", engagementId)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ reviewPoint: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update review point." },
      { status: 500 }
    );
  }
}