import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function emptyToNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function monthToDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return /^\d{4}-\d{2}$/.test(text) ? `${text}-01` : null;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const formData = await req.formData();
  const supabase = getSupabaseAdmin();

  try {
    const statutoryPayload = {
      client_id: id,
      nature_of_business: emptyToNull(formData.get("nature_of_business")),
      magisterial_district: emptyToNull(formData.get("magisterial_district")),
      municipality: emptyToNull(formData.get("municipality")),
      updated_at: new Date().toISOString(),
    };

    const contributorsRaw = emptyToNull(formData.get("number_of_contributors"));
    const contributors =
      contributorsRaw === null ? null : Number(contributorsRaw);

    const uifPayload = {
      client_id: id,
      registration_status:
        emptyToNull(formData.get("registration_status")) || "not_started",
      first_contributor_date: emptyToNull(formData.get("first_contributor_date")),
      number_of_contributors:
        contributors !== null && Number.isFinite(contributors)
          ? contributors
          : null,
      language_preference: emptyToNull(formData.get("language_preference")),
      employee_information_method: emptyToNull(
        formData.get("employee_information_method")
      ),
      ui19_declaration_month: monthToDate(
        formData.get("ui19_declaration_month")
      ),
      submission_date: emptyToNull(formData.get("submission_date")),
      registration_effective_date: emptyToNull(
        formData.get("registration_effective_date")
      ),
      notes: emptyToNull(formData.get("notes")),
      ui8_completed: checkbox(formData, "ui8_completed"),
      ui19_or_employee_info_prepared: checkbox(
        formData,
        "ui19_or_employee_info_prepared"
      ),
      supporting_documents_attached: checkbox(
        formData,
        "supporting_documents_attached"
      ),
      signature_obtained: checkbox(formData, "signature_obtained"),
      submitted_to_uif: checkbox(formData, "submitted_to_uif"),
      confirmation_received: checkbox(formData, "confirmation_received"),
      updated_at: new Date().toISOString(),
    };

    const [statutoryResult, uifResult] = await Promise.all([
      supabase
        .from("crm_client_statutory_profiles")
        .upsert(statutoryPayload, { onConflict: "client_id" }),
      supabase
        .from("crm_uif_registrations")
        .upsert(uifPayload, { onConflict: "client_id" }),
    ]);

    if (statutoryResult.error) throw statutoryResult.error;
    if (uifResult.error) throw uifResult.error;

    return NextResponse.redirect(
      new URL(`/crm/client/${id}?tab=registrations`, req.url),
      303
    );
  } catch (error: any) {
    console.error("SAVE UIF REGISTRATION ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unable to save UIF registration.",
      },
      { status: 500 }
    );
  }
}
