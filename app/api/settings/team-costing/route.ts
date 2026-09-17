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

  if (!canManage) {
    return {
      profile: null as any,
      response: NextResponse.json(
        {
          success: false,
          error:
            "Only the Primary Practice Admin or an authorised practice manager may manage team costing.",
        },
        { status: 403 }
      ),
    };
  }

  if (!profile.organisation_id) {
    return {
      profile: null as any,
      response: NextResponse.json(
        { success: false, error: "Your user is not linked to a practice." },
        { status: 400 }
      ),
    };
  }

  return { profile, response: null as NextResponse | null };
}

export async function GET(request: Request) {
  try {
    const { profile, response } = await currentProfile(request);
    if (response) return response;

    const { data: users, error } = await admin
      .from("user_profiles")
      .select(
        "id, user_id, full_name, email, role, access_enabled, hourly_cost_rate, hourly_charge_rate"
      )
      .eq("organisation_id", profile.organisation_id)
      .eq("access_enabled", true)
      .order("full_name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      users: users || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Could not load team costing.",
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
    const profileId = String(body?.profileId || "").trim();

    const hourlyCostRate =
      body?.hourlyCostRate === "" || body?.hourlyCostRate == null
        ? null
        : Number(body.hourlyCostRate);

    const hourlyChargeRate =
      body?.hourlyChargeRate === "" || body?.hourlyChargeRate == null
        ? null
        : Number(body.hourlyChargeRate);

    if (!profileId) {
      return NextResponse.json(
        { success: false, error: "Team member is required." },
        { status: 400 }
      );
    }

    if (
      hourlyCostRate !== null &&
      (!Number.isFinite(hourlyCostRate) || hourlyCostRate < 0)
    ) {
      return NextResponse.json(
        { success: false, error: "Hourly cost rate must be zero or higher." },
        { status: 400 }
      );
    }

    if (
      hourlyChargeRate !== null &&
      (!Number.isFinite(hourlyChargeRate) || hourlyChargeRate < 0)
    ) {
      return NextResponse.json(
        { success: false, error: "Hourly charge rate must be zero or higher." },
        { status: 400 }
      );
    }

    const { error } = await admin
      .from("user_profiles")
      .update({
        hourly_cost_rate: hourlyCostRate,
        hourly_charge_rate: hourlyChargeRate,
      })
      .eq("id", profileId)
      .eq("organisation_id", profile.organisation_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Could not save team costing.",
      },
      { status: 500 }
    );
  }
}
