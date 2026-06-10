import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "../../../lib/supabaseServer";

async function getIdFromContext(context: any) {
  const params = await context?.params;
  const id = params?.id;

  if (!id || typeof id !== "string") {
    throw new Error("Missing AFS engagement id.");
  }

  return id;
}

export async function POST(req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const body = await req.json();

    const fullName = String(body.full_name || "").trim();

    if (!fullName) {
      return NextResponse.json(
        { error: "Full name is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from("afs_client_people")
      .insert({
        engagement_id: engagementId,
        person_type: String(body.person_type || "Director").trim(),
        full_name: fullName,
        nationality: String(body.nationality || "").trim() || null,
        id_number: String(body.id_number || "").trim() || null,
        income_tax_number: String(body.income_tax_number || "").trim() || null,
        appointment_date: String(body.appointment_date || "").trim() || null,
        resignation_date: String(body.resignation_date || "").trim() || null,
        email: String(body.email || "").trim() || null,
        cell: String(body.cell || "").trim() || null,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ person: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to add person." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const body = await req.json();

    const personId = String(body.personId || "").trim();

    if (!personId) {
      return NextResponse.json(
        { error: "Person id is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    const { error } = await supabase
      .from("afs_client_people")
      .delete()
      .eq("id", personId)
      .eq("engagement_id", engagementId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete person." },
      { status: 500 }
    );
  }
}