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

async function invalidateClientSetupSignoff(
  supabase: ReturnType<typeof getSupabaseServer>,
  engagementId: string,
  reason: string,
) {
  const { data: existing, error: existingError } = await supabase
    .from("afs_section_signoffs")
    .select("id,prepared_at,reviewed_at,captain_cleared_at")
    .eq("engagement_id", engagementId)
    .eq("section_key", "client-setup")
    .maybeSingle();

  if (existingError) throw existingError;

  if (
    !existing?.id ||
    (!existing.prepared_at &&
      !existing.reviewed_at &&
      !existing.captain_cleared_at)
  ) {
    return false;
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

  return true;
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

    const signoffInvalidated = await invalidateClientSetupSignoff(
      supabase,
      engagementId,
      `Client Setup changed after sign-off: ${String(data.person_type || "person")} ${fullName} was added.`,
    );

    return NextResponse.json({
      person: data,
      signoffInvalidated,
    });
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

    const { data: person, error: personError } = await supabase
      .from("afs_client_people")
      .select("id,person_type,full_name")
      .eq("id", personId)
      .eq("engagement_id", engagementId)
      .single();

    if (personError) {
      throw personError;
    }

    const { error } = await supabase
      .from("afs_client_people")
      .delete()
      .eq("id", personId)
      .eq("engagement_id", engagementId);

    if (error) {
      throw error;
    }

    const signoffInvalidated = await invalidateClientSetupSignoff(
      supabase,
      engagementId,
      `Client Setup changed after sign-off: ${String(person?.person_type || "person")} ${String(person?.full_name || "").trim()} was deleted.`,
    );

    return NextResponse.json({
      success: true,
      signoffInvalidated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete person." },
      { status: 500 }
    );
  }
}
