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

function numberOrNull(value: FormDataEntryValue | null) {
  const text = emptyToNull(value);
  if (text === null) return null;

  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const formData = await req.formData();
  const supabase = getSupabaseAdmin();

  try {
    const action = String(formData.get("action") || "create");
    const employeeId = emptyToNull(formData.get("employee_id"));

    if (action === "delete") {
      if (!employeeId) {
        throw new Error("Employee ID is required.");
      }

      const { error } = await supabase
        .from("crm_uif_employees")
        .delete()
        .eq("id", employeeId)
        .eq("client_id", id);

      if (error) throw error;
    } else {
      const surname = emptyToNull(formData.get("surname"));

      if (!surname) {
        throw new Error("Employee surname is required.");
      }

      const isContributor =
        String(formData.get("is_contributor") || "yes") !== "no";

      const payload = {
        client_id: id,
        surname,
        initials: emptyToNull(formData.get("initials")),
        id_passport_number: emptyToNull(formData.get("id_passport_number")),
        gross_monthly_remuneration: numberOrNull(
          formData.get("gross_monthly_remuneration")
        ),
        total_hours_worked: numberOrNull(formData.get("total_hours_worked")),
        commencement_date: emptyToNull(formData.get("commencement_date")),
        termination_date: emptyToNull(formData.get("termination_date")),
        termination_reason_code: numberOrNull(
          formData.get("termination_reason_code")
        ),
        is_contributor: isContributor,
        non_contributor_reason_code: isContributor
          ? null
          : numberOrNull(formData.get("non_contributor_reason_code")),
        notes: emptyToNull(formData.get("notes")),
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (action === "update") {
        if (!employeeId) {
          throw new Error("Employee ID is required.");
        }

        const { error } = await supabase
          .from("crm_uif_employees")
          .update(payload)
          .eq("id", employeeId)
          .eq("client_id", id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("crm_uif_employees")
          .insert(payload);

        if (error) throw error;
      }
    }

    return NextResponse.redirect(
      new URL(`/crm/client/${id}?tab=registrations`, req.url),
      303
    );
  } catch (error: any) {
    console.error("SAVE UIF EMPLOYEE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unable to save UIF employee.",
      },
      { status: 500 }
    );
  }
}
