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

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("crm_services")
      .select(
  "id, service_name, service_group, colour_hex, text_colour_hex, is_active"
)
      .order("service_group", { ascending: true })
      .order("service_name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      services: data || [],
    });
  } catch (error: any) {
    console.error("Could not load services:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Could not load services.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();

    const { id, colour_hex, text_colour_hex } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing service id." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("crm_services")
      .update({
        colour_hex: colour_hex || "#0b5cab",
        text_colour_hex: text_colour_hex || "#ffffff",
      })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("Could not save service colour:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Could not save service colour.",
      },
      { status: 500 }
    );
  }
}