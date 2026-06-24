// Path: app/api/paia/manuals/[manualId]/route.ts

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
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Missing server Supabase key. Add SUPABASE_SERVICE_ROLE_KEY in Vercel and redeploy."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { manualId } = await context.params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("paia_manuals")
      .select("*")
      .eq("id", manualId)
      .limit(1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const manual = Array.isArray(data) ? data[0] : null;

    if (!manual) {
      return NextResponse.json(
        { error: "PAIA manual not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ manual });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load PAIA manual." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { manualId } = await context.params;
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("paia_manuals")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", manualId)
      .select("*")
      .limit(1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const manual = Array.isArray(data) ? data[0] : null;

    if (!manual) {
      return NextResponse.json(
        { error: "PAIA manual not found after update." },
        { status: 404 }
      );
    }

    return NextResponse.json({ manual });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to update PAIA manual." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { manualId } = await context.params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("paia_manuals")
      .delete()
      .eq("id", manualId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to delete PAIA manual." },
      { status: 500 }
    );
  }
}