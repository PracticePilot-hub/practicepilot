import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseSecretKey) {
  throw new Error("Missing SUPABASE_SECRET_KEY");
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

export async function GET() {
  const { data, error } = await supabase
    .from("user_profiles")
    .select(`
      *,
      organisations (
        id,
        name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data });
}

export async function POST(req: Request) {
  const body = await req.json();

  const fullName = String(body.fullName || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "").trim();
  const role = String(body.role || "Client Viewer").trim();
  const organisationId = String(body.organisationId || "").trim();
  const canEditProjects = Boolean(body.canEditProjects);
  const canAccessAccounting = Boolean(body.canAccessAccounting);
  const canAccessProjects = Boolean(body.canAccessProjects);
  const canAccessBudgeting = Boolean(body.canAccessBudgeting);

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const userId = authData.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Could not create auth user" }, { status: 500 });
  }

  const isInternalUser = role === "Super Admin" || role === "Admin" || role === "Staff";

  const { data, error } = await supabase
    .from("user_profiles")
    .insert([
      {
        user_id: userId,
        full_name: fullName || null,
        email,
        role,
        organisation_id: isInternalUser ? null : organisationId || null,
       can_edit_projects: isInternalUser ? true : canEditProjects,
       can_access_accounting: isInternalUser ? true : canAccessAccounting,
       can_access_projects: true,
       can_access_budgeting: isInternalUser ? true : canAccessBudgeting,
       access_enabled: true,
      },
    ])
    .select(`
      *,
      organisations (
        id,
        name
      )
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}