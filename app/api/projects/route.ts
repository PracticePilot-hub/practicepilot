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
    .from("projects")
    .select(`
      *,
      organisations (
        id,
        name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ projects: data });
}

export async function POST(req: Request) {
  const body = await req.json();

  const organisationId = String(body.organisationId || "").trim();
  const name = String(body.name || "").trim();
  const numberOfPhases = Number(body.numberOfPhases || 0);

  if (!organisationId) {
    return NextResponse.json(
      { error: "Client is required" },
      { status: 400 }
    );
  }

  if (!name) {
    return NextResponse.json(
      { error: "Project name is required" },
      { status: 400 }
    );
  }

  if (!numberOfPhases || numberOfPhases <= 0) {
    return NextResponse.json(
      { error: "Number of phases is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("projects")
    .insert([
      {
        organisation_id: organisationId,
        name,
        number_of_phases: numberOfPhases,
        status: "Active",
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
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ project: data });
}