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
    .from("organisations")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ organisations: data });
}

export async function POST(req: Request) {
  const body = await req.json();

  const name = String(body.name || "").trim();
  const contactPerson = String(body.contactPerson || "").trim();
  const contactEmail = String(body.contactEmail || "").trim();
  const contactNumber = String(body.contactNumber || "").trim();
  const logoUrl = String(body.logoUrl || "").trim();

  if (!name) {
    return NextResponse.json({ error: "Client name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("organisations")
    .insert([
      {
        name,
        contact_person: contactPerson || null,
        contact_email: contactEmail || null,
        contact_number: contactNumber || null,
        logo_url: logoUrl || null,
        status: "Active",
        access_enabled: true,
      },
    ])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ organisation: data });
}