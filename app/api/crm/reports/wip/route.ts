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

  if (!token) throw new Error("Not authenticated.");

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !user) throw new Error("Not authenticated.");

  const { data: profile, error } = await admin
    .from("user_profiles")
    .select("organisation_id, access_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (!profile?.access_enabled || !profile.organisation_id) {
    throw new Error("Practice access could not be confirmed.");
  }

  return profile;
}

export async function GET(request: Request) {
  try {
    const profile = await getProfile(request);
    const organisationId = profile.organisation_id;

    const [
      deliveryClientResult,
      deliveryDetailResult,
      billableResult,
      staffResult,
    ] = await Promise.all([
      admin
        .from("crm_delivery_wip_client_summary")
        .select(
          "organisation_id, client_id, client_name, total_hours, total_internal_cost, charge_out_equivalent, work_items_touched, team_members_involved"
        )
        .eq("organisation_id", organisationId)
        .order("total_internal_cost", { ascending: false }),

      admin
        .from("crm_delivery_wip_detail")
        .select(
          "client_id, hours_worked, staff_cost, resolved_billing_treatment"
        )
        .eq("organisation_id", organisationId),

      admin
        .from("crm_billable_wip_work_summary")
        .select(
          "client_id, client_name, total_hours, total_internal_cost, suggested_billable_value, billing_status, work_item_id"
        )
        .eq("organisation_id", organisationId)
        .in("billing_status", ["not_ready", "ready_to_bill", "drafted"]),

      admin
        .from("crm_staff_wip_summary")
        .select(
          "organisation_id, user_id, staff_name, staff_email, total_hours, total_staff_cost, total_charge_value, clients_worked_on, work_items_touched"
        )
        .eq("organisation_id", organisationId)
        .order("total_hours", { ascending: false }),
    ]);

    if (deliveryClientResult.error) throw deliveryClientResult.error;
    if (deliveryDetailResult.error) throw deliveryDetailResult.error;
    if (billableResult.error) throw billableResult.error;
    if (staffResult.error) throw staffResult.error;

    const deliveryClients = deliveryClientResult.data || [];
    const deliveryDetail = deliveryDetailResult.data || [];
    const billable = billableResult.data || [];
    const staff = staffResult.data || [];

    const detailByClient = new Map<
      string,
      {
        included_hours: number;
        included_staff_cost: number;
        unclassified_hours: number;
        unclassified_staff_cost: number;
        time_entries: number;
      }
    >();

    for (const row of deliveryDetail as any[]) {
      if (!row.client_id) continue;

      const current = detailByClient.get(row.client_id) || {
        included_hours: 0,
        included_staff_cost: 0,
        unclassified_hours: 0,
        unclassified_staff_cost: 0,
        time_entries: 0,
      };

      current.time_entries += 1;

      const treatment = String(row.resolved_billing_treatment || "");
      const hours = Number(row.hours_worked || 0);
      const cost = Number(row.staff_cost || 0);

      if (["included", "not_chargeable"].includes(treatment)) {
        current.included_hours += hours;
        current.included_staff_cost += cost;
      }

      if (!treatment || treatment === "unclassified") {
        current.unclassified_hours += hours;
        current.unclassified_staff_cost += cost;
      }

      detailByClient.set(row.client_id, current);
    }

    const billableByClient = new Map<
      string,
      {
        billable_hours: number;
        billable_internal_cost: number;
        billable_wip_value: number;
        billable_items: number;
      }
    >();

    for (const row of billable as any[]) {
      if (!row.client_id) continue;

      const current = billableByClient.get(row.client_id) || {
        billable_hours: 0,
        billable_internal_cost: 0,
        billable_wip_value: 0,
        billable_items: 0,
      };

      current.billable_hours += Number(row.total_hours || 0);
      current.billable_internal_cost += Number(row.total_internal_cost || 0);
      current.billable_wip_value += Number(row.suggested_billable_value || 0);
      current.billable_items += 1;

      billableByClient.set(row.client_id, current);
    }

    const clients = (deliveryClients as any[]).map((row) => {
      const detail = detailByClient.get(row.client_id) || {
        included_hours: 0,
        included_staff_cost: 0,
        unclassified_hours: 0,
        unclassified_staff_cost: 0,
        time_entries: 0,
      };

      const bill = billableByClient.get(row.client_id) || {
        billable_hours: 0,
        billable_internal_cost: 0,
        billable_wip_value: 0,
        billable_items: 0,
      };

      return {
        client_id: row.client_id,
        client_name: row.client_name,
        total_hours: Number(row.total_hours || 0),
        total_staff_cost: Number(row.total_internal_cost || 0),
        total_charge_value: Number(row.charge_out_equivalent || 0),
        work_items_touched: Number(row.work_items_touched || 0),
        time_entries: detail.time_entries,

        included_hours: Number(detail.included_hours.toFixed(2)),
        included_staff_cost: Number(detail.included_staff_cost.toFixed(2)),

        billable_hours: Number(bill.billable_hours.toFixed(2)),
        billable_internal_cost: Number(
          bill.billable_internal_cost.toFixed(2)
        ),
        billable_wip_value: Number(bill.billable_wip_value.toFixed(2)),
        billable_items: bill.billable_items,

        unclassified_hours: Number(detail.unclassified_hours.toFixed(2)),
        unclassified_staff_cost: Number(
          detail.unclassified_staff_cost.toFixed(2)
        ),
      };
    });

    const totals = clients.reduce(
      (acc, row) => {
        acc.total_hours += row.total_hours;
        acc.total_staff_cost += row.total_staff_cost;
        acc.total_charge_value += row.total_charge_value;
        acc.included_hours += row.included_hours;
        acc.included_staff_cost += row.included_staff_cost;
        acc.billable_hours += row.billable_hours;
        acc.billable_internal_cost += row.billable_internal_cost;
        acc.billable_wip_value += row.billable_wip_value;
        acc.billable_items += row.billable_items;
        acc.unclassified_hours += row.unclassified_hours;
        acc.unclassified_staff_cost += row.unclassified_staff_cost;
        return acc;
      },
      {
        total_hours: 0,
        total_staff_cost: 0,
        total_charge_value: 0,
        included_hours: 0,
        included_staff_cost: 0,
        billable_hours: 0,
        billable_internal_cost: 0,
        billable_wip_value: 0,
        billable_items: 0,
        unclassified_hours: 0,
        unclassified_staff_cost: 0,
      }
    );

    const billableClients = new Set(
      (billable as any[])
        .map((row) => row.client_id)
        .filter(Boolean)
    ).size;

    return NextResponse.json({
      success: true,
      totals: {
        total_hours: Number(totals.total_hours.toFixed(2)),
        total_staff_cost: Number(totals.total_staff_cost.toFixed(2)),
        total_charge_value: Number(totals.total_charge_value.toFixed(2)),
        wip_contribution: Number(
          (totals.total_charge_value - totals.total_staff_cost).toFixed(2)
        ),

        included_hours: Number(totals.included_hours.toFixed(2)),
        included_staff_cost: Number(
          totals.included_staff_cost.toFixed(2)
        ),

        billable_hours: Number(totals.billable_hours.toFixed(2)),
        billable_internal_cost: Number(
          totals.billable_internal_cost.toFixed(2)
        ),
        billable_wip_value: Number(
          totals.billable_wip_value.toFixed(2)
        ),
        billable_items: totals.billable_items,
        billable_clients: billableClients,

        unclassified_hours: Number(
          totals.unclassified_hours.toFixed(2)
        ),
        unclassified_staff_cost: Number(
          totals.unclassified_staff_cost.toFixed(2)
        ),
      },
      clients,
      staff,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Could not load WIP report.",
      },
      { status: 500 }
    );
  }
}
