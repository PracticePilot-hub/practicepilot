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

async function getAuthContext(request: Request, workId: string) {
  const token = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) throw new Error("You are not signed in.");

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);

  if (userError || !user) {
    throw new Error("Your login session could not be confirmed.");
  }

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("user_id, organisation_id, access_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profile?.access_enabled || !profile.organisation_id) {
    throw new Error("Your PracticePilot practice access could not be confirmed.");
  }

  const { data: work, error: workError } = await admin
    .from("crm_work_items")
    .select("id, organisation_id, status")
    .eq("id", workId)
    .eq("organisation_id", profile.organisation_id)
    .maybeSingle();

  if (workError) throw workError;
  if (!work) throw new Error("Work item not found.");

  return {
    user,
    profile,
    work,
  };
}

async function buildTimerState(
  organisationId: string,
  workId: string,
  userId: string
) {
  const { data: entries, error } = await admin
    .from("crm_work_time_entries")
    .select("id, user_id, started_at, stopped_at, duration_seconds")
    .eq("organisation_id", organisationId)
    .eq("work_item_id", workId)
    .order("started_at", { ascending: true });

  if (error) throw error;

  const all = entries || [];
  const mine = all.filter((entry: any) => entry.user_id === userId);

  const open = mine.find((entry: any) => !entry.stopped_at) || null;

  const myClosedSeconds = mine.reduce(
    (sum: number, entry: any) => sum + Number(entry.duration_seconds || 0),
    0
  );

  const totalClosedSeconds = all.reduce(
    (sum: number, entry: any) => sum + Number(entry.duration_seconds || 0),
    0
  );

  return {
    running: Boolean(open),
    open_entry_id: open?.id || null,
    open_started_at: open?.started_at || null,
    my_closed_seconds: myClosedSeconds,
    total_closed_seconds: totalClosedSeconds,
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workId } = await context.params;

    const { user, profile } = await getAuthContext(request, workId);

    const state = await buildTimerState(
      profile.organisation_id,
      workId,
      user.id
    );

    return NextResponse.json({ success: true, ...state });
  } catch (error: any) {
    console.error("WORK TIMER GET ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Could not load time tracking.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workId } = await context.params;

    const { user, profile, work } = await getAuthContext(request, workId);

    const body = await request.json();
    const action = String(body?.action || "").trim().toLowerCase();

    if (!["start", "pause", "resume", "end"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid timer action." },
        { status: 400 }
      );
    }

    const { data: openEntries, error: openError } = await admin
      .from("crm_work_time_entries")
      .select("id, work_item_id, started_at")
      .eq("organisation_id", profile.organisation_id)
      .eq("user_id", user.id)
      .is("stopped_at", null);

    if (openError) throw openError;

    const currentOpen =
      (openEntries || []).find(
        (entry: any) => entry.work_item_id === workId
      ) || null;

    const otherOpen =
      (openEntries || []).find(
        (entry: any) => entry.work_item_id !== workId
      ) || null;

    if (action === "start" || action === "resume") {
      if (currentOpen) {
        const state = await buildTimerState(
          profile.organisation_id,
          workId,
          user.id
        );

        return NextResponse.json({ success: true, ...state });
      }

      if (otherOpen) {
        return NextResponse.json(
          {
            success: false,
            error:
              "You already have a timer running on another task. Pause or end that timer first.",
          },
          { status: 409 }
        );
      }

      const { error: insertError } = await admin
        .from("crm_work_time_entries")
        .insert({
          organisation_id: profile.organisation_id,
          work_item_id: workId,
          user_id: user.id,
          work_stage: "doing",
          started_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      if (String(work.status || "").toLowerCase() === "not_started") {
        const { error: workUpdateError } = await admin
          .from("crm_work_items")
          .update({
            status: "in_progress",
            updated_at: new Date().toISOString(),
          })
          .eq("id", workId)
          .eq("organisation_id", profile.organisation_id);

        if (workUpdateError) throw workUpdateError;
      }
    }

    if (action === "pause" || action === "end") {
      if (currentOpen) {
        const stoppedAt = new Date();
        const startedAt = new Date(currentOpen.started_at);

        const durationSeconds = Math.max(
          0,
          Math.floor(
            (stoppedAt.getTime() - startedAt.getTime()) / 1000
          )
        );

        const { error: updateError } = await admin
          .from("crm_work_time_entries")
          .update({
            stopped_at: stoppedAt.toISOString(),
            duration_seconds: durationSeconds,
            note: action === "pause" ? "Paused" : "Ended",
            updated_at: stoppedAt.toISOString(),
          })
          .eq("id", currentOpen.id)
          .eq("organisation_id", profile.organisation_id)
          .eq("user_id", user.id);

        if (updateError) throw updateError;
      }
    }

    const state = await buildTimerState(
      profile.organisation_id,
      workId,
      user.id
    );

    return NextResponse.json({ success: true, ...state });
  } catch (error: any) {
    console.error("WORK TIMER POST ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Could not update time tracking.",
      },
      { status: 500 }
    );
  }
}
