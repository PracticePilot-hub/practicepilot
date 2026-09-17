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

async function currentProfile(request: Request) {
  const token = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    return {
      profile: null as any,
      response: NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !user) {
    return {
      profile: null as any,
      response: NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error } = await admin
    .from("user_profiles")
    .select(
      "user_id, organisation_id, role, access_enabled, can_manage_practice_users"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !profile || profile.access_enabled === false) {
    return {
      profile: null as any,
      response: NextResponse.json(
        { success: false, error: "Access denied." },
        { status: 403 }
      ),
    };
  }

  const canManage =
    profile.role === "Super Admin" ||
    profile.role === "Admin" ||
    profile.role === "Client Manager" ||
    profile.can_manage_practice_users === true;

  if (!canManage || !profile.organisation_id) {
    return {
      profile: null as any,
      response: NextResponse.json(
        {
          success: false,
          error: "You do not have permission to manage FlightDeck settings.",
        },
        { status: 403 }
      ),
    };
  }

  return { profile, response: null as NextResponse | null };
}

export async function GET(request: Request) {
  try {
    const { profile, response } = await currentProfile(request);
    if (response) return response;

    const [{ data: target, error: targetError }, { data: users, error: usersError }] =
      await Promise.all([
        admin
          .from("crm_current_practice_target")
          .select("*")
          .eq("organisation_id", profile.organisation_id)
          .maybeSingle(),

        admin
          .from("user_profiles")
          .select(
            "id, user_id, full_name, email, role, access_enabled, standard_daily_hours"
          )
          .eq("organisation_id", profile.organisation_id)
          .eq("access_enabled", true)
          .order("full_name", { ascending: true }),
      ]);

    if (targetError) throw targetError;
    if (usersError) throw usersError;

    const { data: profiles, error: profilesError } = await admin
      .from("crm_current_staff_capacity")
      .select("*")
      .eq("organisation_id", profile.organisation_id);

    if (profilesError) throw profilesError;

    const profileByUser = new Map(
      (profiles || []).map((row: any) => [row.user_id, row])
    );

    return NextResponse.json({
      success: true,
      target: target || null,
      users: (users || []).map((user: any) => ({
        ...user,
        capacity: profileByUser.get(user.user_id) || null,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Could not load FlightDeck settings.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { profile, response } = await currentProfile(request);
    if (response) return response;

    const body = await request.json();
    const action = String(body?.action || "");

    if (action === "save-practice-target") {
      const monthlyRevenueTarget = Number(body?.monthlyRevenueTarget || 0);
      const annualRevenueTarget =
        body?.annualRevenueTarget === "" || body?.annualRevenueTarget == null
          ? null
          : Number(body.annualRevenueTarget);
      const desiredRecurringCoveragePercent =
        body?.desiredRecurringCoveragePercent === "" ||
        body?.desiredRecurringCoveragePercent == null
          ? null
          : Number(body.desiredRecurringCoveragePercent);

      if (!Number.isFinite(monthlyRevenueTarget) || monthlyRevenueTarget < 0) {
        throw new Error("Monthly revenue target must be zero or higher.");
      }

      const { data: current, error: currentError } = await admin
        .from("crm_practice_targets")
        .select("id")
        .eq("organisation_id", profile.organisation_id)
        .eq("is_active", true)
        .is("effective_to", null)
        .maybeSingle();

      if (currentError) throw currentError;

      if (current?.id) {
        const { error } = await admin
          .from("crm_practice_targets")
          .update({
            monthly_revenue_target: monthlyRevenueTarget,
            annual_revenue_target: annualRevenueTarget,
            desired_recurring_coverage_percent:
              desiredRecurringCoveragePercent,
            notes: body?.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", current.id)
          .eq("organisation_id", profile.organisation_id);

        if (error) throw error;
      } else {
        const { error } = await admin.from("crm_practice_targets").insert({
          organisation_id: profile.organisation_id,
          monthly_revenue_target: monthlyRevenueTarget,
          annual_revenue_target: annualRevenueTarget,
          desired_recurring_coverage_percent:
            desiredRecurringCoveragePercent,
          notes: body?.notes || null,
          is_active: true,
        });

        if (error) throw error;
      }

      return NextResponse.json({ success: true });
    }

    if (action === "save-staff-silo") {
      const userId = String(body?.userId || "").trim();
      if (!userId) throw new Error("Team member is required.");

      const day = (value: unknown) => {
        const numeric = Number(value || 0);
        if (!Number.isFinite(numeric) || numeric < 0 || numeric > 24) {
          throw new Error("Daily capacity must be between 0 and 24 hours.");
        }
        return numeric;
      };

      const commercialTargetAmount =
        body?.commercialTargetAmount === "" ||
        body?.commercialTargetAmount == null
          ? null
          : Number(body.commercialTargetAmount);

      if (
        commercialTargetAmount !== null &&
        (!Number.isFinite(commercialTargetAmount) ||
          commercialTargetAmount < 0)
      ) {
        throw new Error("Commercial target must be zero or higher.");
      }

      const commercialTargetBasis =
        body?.commercialTargetBasis || null;

      const payload = {
        organisation_id: profile.organisation_id,
        user_id: userId,
        monday_hours: day(body?.mondayHours),
        tuesday_hours: day(body?.tuesdayHours),
        wednesday_hours: day(body?.wednesdayHours),
        thursday_hours: day(body?.thursdayHours),
        friday_hours: day(body?.fridayHours),
        saturday_hours: day(body?.saturdayHours),
        sunday_hours: day(body?.sundayHours),
        commercial_target_amount: commercialTargetAmount,
        commercial_target_basis: commercialTargetBasis,
        custom_target_label:
          body?.customTargetLabel?.trim() || null,
        include_in_capacity_planning:
          body?.includeInCapacityPlanning !== false,
        notes: body?.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { data: current, error: currentError } = await admin
        .from("crm_staff_capacity_profiles")
        .select("id")
        .eq("organisation_id", profile.organisation_id)
        .eq("user_id", userId)
        .eq("is_active", true)
        .is("effective_to", null)
        .maybeSingle();

      if (currentError) throw currentError;

      if (current?.id) {
        const { error } = await admin
          .from("crm_staff_capacity_profiles")
          .update(payload)
          .eq("id", current.id)
          .eq("organisation_id", profile.organisation_id);

        if (error) throw error;
      } else {
        const { error } = await admin
          .from("crm_staff_capacity_profiles")
          .insert({
            ...payload,
            effective_from: new Date().toISOString().slice(0, 10),
            is_active: true,
          });

        if (error) throw error;
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Unknown settings action." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Could not save FlightDeck settings.",
      },
      { status: 500 }
    );
  }
}
