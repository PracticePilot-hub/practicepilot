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

export async function POST(req: Request, context: any) {
  const organisationId = await getOrganisationId(context);
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const fileExtension = file.name.split(".").pop() || "png";
  const fileName = `${organisationId}-${Date.now()}.${fileExtension}`;
  const filePath = `logos/${fileName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("client-logos")
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage
    .from("client-logos")
    .getPublicUrl(filePath);

  const logoUrl = publicUrlData.publicUrl;

  const { data, error } = await supabase
    .from("organisations")
    .update({
      logo_url: logoUrl,
    })
    .eq("id", organisationId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ organisation: data });
}