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

async function getOrganisationId(context: any) {
  const params = await context.params;
  return String(params.id || "");
}

export async function PATCH(req: Request, context: any) {
  const id = await getOrganisationId(context);
  const body = await req.json();

  const updateData: Record<string, any> = {};

  if (body.name !== undefined) {
    updateData.name = String(body.name || "").trim();
  }

  if (body.contactPerson !== undefined) {
    updateData.contact_person = String(body.contactPerson || "").trim() || null;
  }

  if (body.contactEmail !== undefined) {
    updateData.contact_email = String(body.contactEmail || "").trim() || null;
  }

  if (body.contactNumber !== undefined) {
    updateData.contact_number = String(body.contactNumber || "").trim() || null;
  }
  
  if (body.logoUrl !== undefined) {
  updateData.logo_url = String(body.logoUrl || "").trim() || null;
}
  if (body.status !== undefined) {
    updateData.status = String(body.status || "Active");
  }

  if (body.accessEnabled !== undefined) {
    updateData.access_enabled = Boolean(body.accessEnabled);
  }

  const { data, error } = await supabase
    .from("organisations")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ organisation: data });
}