import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "../lib/supabaseServer";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

async function getFallbackOrganisation(supabase: ReturnType<typeof getSupabaseServer>) {
  const { data } = await supabase
    .from("organisations")
    .select("id, name")
    .ilike("name", "Bizzacc Menlyn%")
    .limit(1)
    .maybeSingle();

  return data || null;
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const clientName = cleanText(body.clientName);
    const entityType = cleanText(body.entityType);
    const financialYearEnd = cleanText(body.financialYearEnd);
    const preparedBy = cleanText(body.preparedBy);
    const reviewedBy = cleanText(body.reviewedBy);
    const notes = cleanText(body.notes);

    const organisationId = cleanText(
      body.organisationId ?? body.firmClientId ?? body.clientOrganisationId
    );

    const firmClientName = cleanText(
      body.firmClientName ?? body.organisationName ?? body.clientOrganisationName
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
        finalFirmClientName = finalFirmClientName || fallbackOrganisation.name;
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