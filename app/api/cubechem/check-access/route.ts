import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { allowed: false, error: "Email is required." },
        { status: 401 }
      );
    }

    const accessResult = await supabase
      .from("practicepilot_module_access")
      .select("email, module_key, access_level")
      .eq("email", email)
      .eq("module_key", "cubechem")
      .eq("is_active", true)
      .maybeSingle();

    if (accessResult.error) throw accessResult.error;

    if (!accessResult.data) {
      return NextResponse.json(
        { allowed: false, error: "You do not have access to this module." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      allowed: true,
      email,
      accessLevel: accessResult.data.access_level,
    });
  } catch (error) {
    console.error("CubeChem access check error:", error);

    const message =
      error instanceof Error ? error.message : "Could not check CubeChem access.";

    return NextResponse.json(
      { allowed: false, error: message },
      { status: 500 }
    );
  }
}