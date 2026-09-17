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

async function requireManager(request: Request) {
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
    .select(
      "user_id, organisation_id, role, access_enabled, can_manage_practice_users"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  const canView =
    profile?.access_enabled !== false &&
    !!profile?.organisation_id &&
    (
      profile?.role === "Super Admin" ||
      profile?.role === "Admin" ||
      profile?.role === "Client Manager" ||
      profile?.can_manage_practice_users === true
    );

  if (!canView) {
    throw new Error("You do not have permission to view FlightDeck.");
  }

  return profile;
}

function monthlyEquivalent(amount: unknown, frequency: unknown) {
  const value = Number(amount || 0);
  const basis = String(frequency || "").toLowerCase();

  if (!Number.isFinite(value)) return 0;
  if (basis === "monthly") return value;
  if (basis === "quarterly") return value / 3;
  if (basis === "six_monthly") return value / 6;
  if (basis === "annual" || basis === "yearly") return value / 12;

  return 0;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function weekdayKey(date: Date) {
  const day = date.getDay();
  if (day === 0) return "sunday_hours";
  if (day === 1) return "monday_hours";
  if (day === 2) return "tuesday_hours";
  if (day === 3) return "wednesday_hours";
  if (day === 4) return "thursday_hours";
  if (day === 5) return "friday_hours";
  return "saturday_hours";
}

function capacityHoursBetween(
  profile: any,
  startDate: Date,
  endDate: Date,
  fallbackDailyHours: number
) {
  let total = 0;
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    const key = weekdayKey(cursor);
    const configured =
      profile && profile[key] !== null && profile[key] !== undefined
        ? Number(profile[key] || 0)
        : null;

    if (configured !== null) {
      total += configured;
    } else {
      const day = cursor.getDay();
      if (day >= 1 && day <= 5) {
        total += fallbackDailyHours;
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return total;
}

export async function GET(request: Request) {
  try {
    const profile = await requireManager(request);
    const organisationId = profile.organisation_id;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [
      targetResult,
      termsResult,
      billableResult,
      usersResult,
      capacityResult,
      timeResult,
      retainerHealthResult,
      poolsResult,
    ] = await Promise.all([
      admin
        .from("crm_current_practice_target")
        .select("*")
        .eq("organisation_id", organisationId)
        .maybeSingle(),

      admin
        .from("crm_client_commercial_terms")
        .select(
          "client_id, commercial_model, core_fee_amount, billing_frequency, is_active"
        )
        .eq("organisation_id", organisationId)
        .eq("is_active", true),

      admin
        .from("crm_billable_wip_work_summary")
        .select(
          "work_item_id, client_id, client_name, work_title, billing_status, suggested_billable_value, total_internal_cost, last_time_entry_at"
        )
        .eq("organisation_id", organisationId)
        .in("billing_status", ["ready_to_bill", "drafted", "not_ready"]),

      admin
        .from("user_profiles")
        .select(
          "user_id, full_name, email, role, access_enabled, standard_daily_hours"
        )
        .eq("organisation_id", organisationId)
        .eq("access_enabled", true)
        .order("full_name"),

      admin
        .from("crm_current_staff_capacity")
        .select("*")
        .eq("organisation_id", organisationId),

      admin
        .from("crm_work_time_costing")
        .select(
          "user_id, staff_name, staff_email, hours_worked, staff_cost, charge_value, stopped_at"
        )
        .eq("organisation_id", organisationId)
        .gte("stopped_at", monthStart.toISOString())
        .lte("stopped_at", now.toISOString()),

      admin
        .from("crm_retainer_health_current")
        .select(
          "client_id, client_name, monthly_fee_equivalent, internal_staff_cost, retainer_health_status"
        )
        .eq("organisation_id", organisationId),

      admin
        .from("crm_current_client_capacity_pools")
        .select(
          "id, scope_type, allocated_hours, period_basis, warning_percent"
        )
        .eq("organisation_id", organisationId)
        .eq("include_in_capacity_planning", true),
    ]);

    for (const result of [
      targetResult,
      termsResult,
      billableResult,
      usersResult,
      capacityResult,
      timeResult,
      retainerHealthResult,
      poolsResult,
    ]) {
      if (result.error) throw result.error;
    }

    const target = targetResult.data || null;
    const terms = termsResult.data || [];
    const billable = billableResult.data || [];
    const users = usersResult.data || [];
    const capacityProfiles = capacityResult.data || [];
    const timeRows = timeResult.data || [];
    const retainerHealth = retainerHealthResult.data || [];
    const pools = poolsResult.data || [];

    const monthlyTarget = Number(target?.monthly_revenue_target || 0);

    const recurringModels = new Set([
      "monthly_retainer",
      "annual_retainer",
      "hybrid",
    ]);

    const recurringBase = terms.reduce((sum: number, row: any) => {
      if (!recurringModels.has(String(row.commercial_model || ""))) return sum;
      return sum + monthlyEquivalent(row.core_fee_amount, row.billing_frequency);
    }, 0);

    const readyToBill = billable
      .filter((row: any) =>
        ["ready_to_bill", "drafted"].includes(String(row.billing_status || ""))
      )
      .reduce(
        (sum: number, row: any) =>
          sum + Number(row.suggested_billable_value || 0),
        0
      );

    const billingPipeline = billable.reduce(
      (sum: number, row: any) =>
        sum + Number(row.suggested_billable_value || 0),
      0
    );

    const sustainableCoverage =
      monthlyTarget > 0 ? (recurringBase / monthlyTarget) * 100 : 0;

    const expectedCoverageValue = recurringBase + readyToBill;
    const expectedCoveragePercent =
      monthlyTarget > 0
        ? (expectedCoverageValue / monthlyTarget) * 100
        : 0;

    const targetGap =
      monthlyTarget > 0
        ? Math.max(0, monthlyTarget - expectedCoverageValue)
        : 0;

    const profileByUser = new Map(
      capacityProfiles.map((row: any) => [row.user_id, row])
    );

    const timeByUser = new Map<string, {
      hours: number;
      staff_cost: number;
      charge_value: number;
    }>();

    for (const row of timeRows) {
      const current = timeByUser.get(row.user_id) || {
        hours: 0,
        staff_cost: 0,
        charge_value: 0,
      };

      current.hours += Number(row.hours_worked || 0);
      current.staff_cost += Number(row.staff_cost || 0);
      current.charge_value += Number(row.charge_value || 0);

      timeByUser.set(row.user_id, current);
    }

    const staff = users.map((user: any) => {
      const capacityProfile: any =
        profileByUser.get(user.user_id) || null;

      const fallbackDailyHours = Number(
        user.standard_daily_hours || 0
      );

      const mtdAvailableHours = capacityHoursBetween(
        capacityProfile,
        monthStart,
        now,
        fallbackDailyHours
      );

      const fullMonthCapacityHours = capacityHoursBetween(
        capacityProfile,
        monthStart,
        monthEnd,
        fallbackDailyHours
      );

      const actual = timeByUser.get(user.user_id) || {
        hours: 0,
        staff_cost: 0,
        charge_value: 0,
      };

      const timeLoadPercent =
        mtdAvailableHours > 0
          ? (actual.hours / mtdAvailableHours) * 100
          : 0;

      const contribution =
        actual.charge_value - actual.staff_cost;

      let timeStatus = "No capacity profile";
      if (mtdAvailableHours > 0) {
        if (timeLoadPercent > 100) timeStatus = "Over capacity";
        else if (timeLoadPercent >= 90) timeStatus = "Nearly full";
        else if (timeLoadPercent >= 70) timeStatus = "Healthy load";
        else timeStatus = "Capacity available";
      }

      return {
        user_id: user.user_id,
        full_name: user.full_name || user.email || "Team member",
        email: user.email || null,
        role: user.role || null,

        weekly_capacity_hours: Number(
          capacityProfile?.weekly_capacity_hours ||
            fallbackDailyHours * 5 ||
            0
        ),
        mtd_available_hours: Number(mtdAvailableHours.toFixed(2)),
        full_month_capacity_hours: Number(
          fullMonthCapacityHours.toFixed(2)
        ),

        hours_worked: Number(actual.hours.toFixed(2)),
        internal_cost: Number(actual.staff_cost.toFixed(2)),
        charge_out_equivalent: Number(
          actual.charge_value.toFixed(2)
        ),
        delivery_contribution: Number(contribution.toFixed(2)),
        time_load_percent: Number(timeLoadPercent.toFixed(1)),
        time_status: timeStatus,

        commercial_target_amount:
          capacityProfile?.commercial_target_amount == null
            ? null
            : Number(capacityProfile.commercial_target_amount),

        commercial_target_basis:
          capacityProfile?.commercial_target_basis || null,
      };
    });

    const lossMakingClients = retainerHealth.filter(
      (row: any) =>
        row.retainer_health_status === "loss_making"
    );

    const scopeRiskClients = retainerHealth.filter(
      (row: any) =>
        row.retainer_health_status === "scope_creep_risk" ||
        row.retainer_health_status === "watch"
    );

    const overloadedStaff = staff.filter(
      (row: any) => row.time_load_percent > 100
    );

    const nearlyFullStaff = staff.filter(
      (row: any) =>
        row.time_load_percent >= 90 &&
        row.time_load_percent <= 100
    );

    const attention: Array<{
      severity: "high" | "medium" | "info";
      title: string;
      detail: string;
    }> = [];

    if (monthlyTarget > 0 && targetGap > 0) {
      attention.push({
        severity: targetGap > monthlyTarget * 0.2 ? "high" : "medium",
        title: "Gap to monthly practice target",
        detail: `R ${Math.round(targetGap).toLocaleString("en-ZA")} remains after recurring revenue and current ready-to-bill work.`,
      });
    }

    if (
      target?.desired_recurring_coverage_percent != null &&
      sustainableCoverage <
        Number(target.desired_recurring_coverage_percent)
    ) {
      attention.push({
        severity: "medium",
        title: "Recurring coverage below desired level",
        detail: `Current sustainable coverage is ${sustainableCoverage.toFixed(
          1
        )}% against a ${Number(
          target.desired_recurring_coverage_percent
        ).toFixed(0)}% target.`,
      });
    }

    if (readyToBill > 0) {
      attention.push({
        severity: "info",
        title: "Revenue ready to convert",
        detail: `R ${Math.round(readyToBill).toLocaleString(
          "en-ZA"
        )} is currently ready to bill or drafted.`,
      });
    }

    if (lossMakingClients.length) {
      attention.push({
        severity: "high",
        title: "Loss-making retainers",
        detail: `${lossMakingClients.length} retainer client${
          lossMakingClients.length === 1 ? "" : "s"
        } currently cost more to deliver than the monthly fee equivalent.`,
      });
    }

    if (scopeRiskClients.length) {
      attention.push({
        severity: "medium",
        title: "Retainer pressure",
        detail: `${scopeRiskClients.length} client${
          scopeRiskClients.length === 1 ? "" : "s"
        } are approaching or exceeding comfortable delivery cost levels.`,
      });
    }

    if (overloadedStaff.length) {
      attention.push({
        severity: "high",
        title: "Team capacity exceeded",
        detail: `${overloadedStaff.length} team member${
          overloadedStaff.length === 1 ? " is" : "s are"
        } above available month-to-date capacity.`,
      });
    } else if (nearlyFullStaff.length) {
      attention.push({
        severity: "medium",
        title: "Team capacity tightening",
        detail: `${nearlyFullStaff.length} team member${
          nearlyFullStaff.length === 1 ? " is" : "s are"
        } at 90% or more of available month-to-date capacity.`,
      });
    }

    const totalHoursWorked = staff.reduce(
      (sum: number, row: any) => sum + row.hours_worked,
      0
    );
    const totalInternalCost = staff.reduce(
      (sum: number, row: any) => sum + row.internal_cost,
      0
    );
    const totalChargeOut = staff.reduce(
      (sum: number, row: any) =>
        sum + row.charge_out_equivalent,
      0
    );
    const totalContribution = staff.reduce(
      (sum: number, row: any) =>
        sum + row.delivery_contribution,
      0
    );

    return NextResponse.json({
      success: true,
      month: {
        label: now.toLocaleDateString("en-ZA", {
          month: "long",
          year: "numeric",
        }),
        start: isoDate(monthStart),
        today: isoDate(now),
        end: isoDate(monthEnd),
      },

      practice: {
        monthly_target: monthlyTarget,
        desired_recurring_coverage_percent:
          target?.desired_recurring_coverage_percent == null
            ? null
            : Number(target.desired_recurring_coverage_percent),
        recurring_base: Number(recurringBase.toFixed(2)),
        sustainable_coverage_percent: Number(
          sustainableCoverage.toFixed(1)
        ),
        ready_to_bill: Number(readyToBill.toFixed(2)),
        billing_pipeline: Number(billingPipeline.toFixed(2)),
        expected_coverage_value: Number(
          expectedCoverageValue.toFixed(2)
        ),
        expected_coverage_percent: Number(
          expectedCoveragePercent.toFixed(1)
        ),
        target_gap: Number(targetGap.toFixed(2)),
      },

      delivery: {
        total_hours_worked: Number(totalHoursWorked.toFixed(2)),
        total_internal_cost: Number(totalInternalCost.toFixed(2)),
        total_charge_out_equivalent: Number(totalChargeOut.toFixed(2)),
        total_delivery_contribution: Number(
          totalContribution.toFixed(2)
        ),
      },

      health: {
        loss_making_clients: lossMakingClients.length,
        scope_risk_clients: scopeRiskClients.length,
        active_capacity_pools: pools.length,
      },

      staff,
      attention,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message || "Could not load FlightDeck.",
      },
      { status: 500 }
    );
  }
}
