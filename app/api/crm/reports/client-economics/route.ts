import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing Supabase admin environment variables.");
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function getProfile(request: Request) {
  const token = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) throw new Error("You are not signed in.");

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !user) {
    throw new Error("Your login session could not be confirmed.");
  }

  const { data: profile, error } = await admin
    .from("user_profiles")
    .select("organisation_id, access_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (!profile?.access_enabled || !profile.organisation_id) {
    throw new Error("Your PracticePilot practice access could not be confirmed.");
  }

  return profile;
}

function monthlyEquivalent(
  amount: number | null,
  frequency: string | null
) {
  if (amount == null) return null;

  if (frequency === "monthly") return amount;
  if (frequency === "quarterly") return amount / 3;
  if (frequency === "six_monthly") return amount / 6;
  if (frequency === "annual") return amount / 12;

  return null;
}

export async function GET(request: Request) {
  try {
    const profile = await getProfile(request);

    const [
      { data: clients, error: clientsError },
      { data: terms, error: termsError },
      { data: health, error: healthError },
      { data: serviceTerms, error: serviceTermsError },
      { data: billable, error: billableError },
    ] = await Promise.all([
      admin
        .from("crm_clients")
        .select("id, client_name, client_code, entity_type, relationship_status")
        .eq("organisation_id", profile.organisation_id)
        .eq("relationship_status", "flying_client")
        .order("client_name"),

      admin
        .from("crm_client_commercial_terms")
        .select("*")
        .eq("organisation_id", profile.organisation_id)
        .eq("is_active", true),

      admin
        .from("crm_retainer_health_current")
        .select("*")
        .eq("organisation_id", profile.organisation_id),

      admin
        .from("crm_client_commercial_service_terms")
        .select(
          "client_id, service_name, billing_treatment, scope_notes"
        )
        .eq("organisation_id", profile.organisation_id)
        .eq("is_active", true),

      admin
        .from("crm_billable_wip_work_summary")
        .select("suggested_billable_value, billing_status")
        .eq("organisation_id", profile.organisation_id)
        .in("billing_status", ["not_ready", "ready_to_bill", "drafted"]),
    ]);

    if (clientsError) throw clientsError;
    if (termsError) throw termsError;
    if (healthError) throw healthError;
    if (serviceTermsError) throw serviceTermsError;
    if (billableError) throw billableError;

    const termByClient = new Map(
      (terms || []).map((row: any) => [row.client_id, row])
    );

    const healthByClient = new Map(
      (health || []).map((row: any) => [row.client_id, row])
    );

    const serviceTermsByClient = new Map<string, any[]>();

    for (const row of serviceTerms || []) {
      const list = serviceTermsByClient.get(row.client_id) || [];
      list.push(row);
      serviceTermsByClient.set(row.client_id, list);
    }

    const rows = (clients || []).map((client: any) => {
      const term: any = termByClient.get(client.id) || null;
      const retainer: any = healthByClient.get(client.id) || null;
      const serviceRows = serviceTermsByClient.get(client.id) || [];

      const includedServices = serviceRows
        .filter(
          (row: any) =>
            row.billing_treatment === "included" ||
            row.billing_treatment === "not_chargeable"
        )
        .map((row: any) => row.service_name);

      const separatelyBillable = serviceRows
        .filter((row: any) =>
          ["separately_billed", "hourly", "fixed_fee"].includes(
            row.billing_treatment
          )
        )
        .map((row: any) => row.service_name);

      const model = term?.commercial_model || null;

      const feeEquivalent =
        retainer?.monthly_fee_equivalent ??
        monthlyEquivalent(
          term?.core_fee_amount == null
            ? null
            : Number(term.core_fee_amount),
          term?.billing_frequency || null
        );

      const internalCost = Number(retainer?.internal_staff_cost || 0);
      const contribution =
        feeEquivalent == null ? null : feeEquivalent - internalCost;

      const recovery =
        internalCost > 0 && feeEquivalent != null
          ? (feeEquivalent / internalCost) * 100
          : null;

      let healthStatus = retainer?.retainer_health_status || "terms_incomplete";

      if (
        !["monthly_retainer", "annual_retainer", "hybrid"].includes(
          String(model || "")
        )
      ) {
        healthStatus = "healthy";
      }

      return {
        client_id: client.id,
        client_name: client.client_name,
        client_code: client.client_code || null,
        entity_type: client.entity_type || null,

        commercial_model: model,
        core_fee_amount:
          term?.core_fee_amount == null
            ? null
            : Number(term.core_fee_amount),
        billing_frequency: term?.billing_frequency || null,
        monthly_fee_equivalent: feeEquivalent,

        tracked_hours: Number(retainer?.tracked_hours || 0),
        internal_staff_cost: internalCost,
        charge_out_equivalent: Number(
          retainer?.charge_out_equivalent || 0
        ),
        contribution_amount: contribution,
        effective_recovery_percent: recovery,

        retainer_health_status: healthStatus,

        included_services: includedServices,
        separately_billable_services: separatelyBillable,
        billing_notes: term?.notes || null,
      };
    });

    const retainerRows = rows.filter((row: any) =>
      ["monthly_retainer", "annual_retainer", "hybrid"].includes(
        String(row.commercial_model || "")
      )
    );

    const summary = {
      total_clients: rows.length,
      healthy: retainerRows.filter(
        (row: any) => row.retainer_health_status === "healthy"
      ).length,
      watch: retainerRows.filter(
        (row: any) => row.retainer_health_status === "watch"
      ).length,
      scope_creep_risk: retainerRows.filter(
        (row: any) =>
          row.retainer_health_status === "scope_creep_risk"
      ).length,
      loss_making: retainerRows.filter(
        (row: any) => row.retainer_health_status === "loss_making"
      ).length,
      terms_incomplete: retainerRows.filter(
        (row: any) =>
          row.retainer_health_status === "terms_incomplete"
      ).length,
      average_effective_recovery:
        retainerRows.filter(
          (row: any) =>
            row.effective_recovery_percent != null &&
            Number.isFinite(row.effective_recovery_percent)
        ).length > 0
          ? retainerRows
              .filter(
                (row: any) =>
                  row.effective_recovery_percent != null &&
                  Number.isFinite(row.effective_recovery_percent)
              )
              .reduce(
                (sum: number, row: any) =>
                  sum + Number(row.effective_recovery_percent || 0),
                0
              ) /
            retainerRows.filter(
              (row: any) =>
                row.effective_recovery_percent != null &&
                Number.isFinite(row.effective_recovery_percent)
            ).length
          : 0,
      unbilled_ad_hoc_value: (billable || []).reduce(
        (sum: number, row: any) =>
          sum + Number(row.suggested_billable_value || 0),
        0
      ),
    };

    return NextResponse.json({
      success: true,
      rows,
      summary,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message || "Could not load Client Economics.",
      },
      { status: 500 }
    );
  }
}
