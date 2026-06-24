// Path: app/api/paia/manuals/[manualId]/logo/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    manualId: string;
  }>;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey) as any;
}

function cleanExtension(fileName: string, mimeType: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension && ["png", "jpg", "jpeg", "webp"].includes(extension)) {
    return extension === "jpeg" ? "jpg" : extension;
  }

  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";

  return "png";
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { manualId } = await context.params;
    const supabase = getSupabaseAdmin();

    const formData = await request.formData();
    const file = formData.get("logo");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No logo file received." }, { status: 400 });
    }

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      return NextResponse.json(
        { error: "Logo must be PNG, JPG or WEBP." },
        { status: 400 }
      );
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Logo file is too large. Maximum size is 2MB." },
        { status: 400 }
      );
    }

    const extension = cleanExtension(file.name, file.type);
    const filePath = `${manualId}/logo-${Date.now()}.${extension}`;

    const upload = await supabase.storage
      .from("paia-logos")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (upload.error) {
      throw new Error(upload.error.message);
    }

    const publicUrlResult = supabase.storage
      .from("paia-logos")
      .getPublicUrl(filePath);

    const logoUrl = publicUrlResult.data.publicUrl;

    const update = await supabase
      .from("paia_manuals")
      .update({
        logo_url: logoUrl,
        logo_file_path: filePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", manualId)
      .select()
      .single();

    if (update.error) {
      throw new Error(update.error.message);
    }

    return NextResponse.json({
      logo_url: logoUrl,
      logo_file_path: filePath,
      manual: update.data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to upload PAIA logo." },
      { status: 500 }
    );
  }
}
