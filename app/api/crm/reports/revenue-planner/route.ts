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

    const { data: rows, error } = await admin
      .from("crm_billable_wip_work_summary")
      .select("*")
      .eq("organisation_id", profile.organisation_id)
      .in("billing_status", [
        "not_ready",
        "ready_to_bill",
        "drafted",
      ])
      .order("last_time_entry_at", {
        ascending: true,
        nullsFirst: false,
      });

    if (error) throw error;

    const active = rows || [];
    const now = Date.now();

    let readyValue = 0;
    let readyItems = 0;
    let overdueValue = 0;
    let overdueItems = 0;
    let draftedValue = 0;

    const readyClientIds = new Set<string>();

    for (const row of active as any[]) {
      const value = Number(row.suggested_billable_value || 0);
      const lastTime = row.last_time_entry_at
        ? new Date(row.last_time_entry_at).getTime()
        : now;

      const ageDays = Math.max(
        0,
        Math.floor((now - lastTime) / 86400000)
      );

      if (row.billing_status === "drafted") {
        draftedValue += value;
        continue;
      }

      if (row.billing_status === "ready_to_bill") {
        readyValue += value;
        readyItems += 1;

        if (row.client_id) {
          readyClientIds.add(String(row.client_id));
        }
      }

      if (
        row.work_status === "completed" &&
        row.billing_status !== "drafted" &&
        ageDays >= 7
      ) {
        overdueValue += value;
        overdueItems += 1;
      }
    }

    return NextResponse.json({
      success: true,
      rows: active,
      summary: {
        ready_to_bill_value: Number(readyValue.toFixed(2)),
        ready_to_bill_items: readyItems,
        ready_to_bill_clients: readyClientIds.size,
        overdue_value: Number(overdueValue.toFixed(2)),
        overdue_items: overdueItems,
        drafted_value: Number(draftedValue.toFixed(2)),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message || "Could not load Billing to be done.",
      },
      { status: 500 }
    );
  }
}
