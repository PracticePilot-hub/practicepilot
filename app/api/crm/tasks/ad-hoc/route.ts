import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

   const {
  task_title,
  due_date,
  assigned_to_user_id,
  created_by_user_id,
  client_id,
  ad_hoc_category,
  ad_hoc_notes,
  meeting_start_time,
  meeting_end_time,
  meeting_location,
} = body;

    if (!task_title || !String(task_title).trim()) {
      return NextResponse.json(
        { success: false, error: "Task title is required." },
        { status: 400 }
      );
    }

    if (!due_date) {
      return NextResponse.json(
        { success: false, error: "Due date is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("crm_tasks")
      .insert({
        task_title: String(task_title).trim(),
        task_description: ad_hoc_notes || null,
        service_name: ad_hoc_category || "Ad Hoc",
        task_status: "Open",
        due_date,
        period_start: due_date,
        period_end: due_date,
        has_deadline: true,
        is_manual_task: true,
        assigned_to_user_id: assigned_to_user_id || null,
        created_by_user_id: created_by_user_id || null,
        client_id: client_id || null,
        ad_hoc_category: ad_hoc_category || "Ad Hoc",
        ad_hoc_notes: ad_hoc_notes || null,
        meeting_start_time: meeting_start_time || null,
meeting_end_time: meeting_end_time || null,
meeting_location: meeting_location || null,
      })
      .select("id, task_title")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      task: data,
    });
  } catch (error: any) {
    console.error("Ad hoc task creation failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Ad hoc task creation failed.",
      },
      { status: 500 }
    );
  }
}