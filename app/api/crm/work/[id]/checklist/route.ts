import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) throw new Error("Missing Supabase admin environment variables.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function authContext(request: Request, workId: string, supabase: ReturnType<typeof adminClient>) {
  const token = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_id, organisation_id, access_enabled")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (!profile || profile.access_enabled === false) return null;

  const { data: work } = await supabase
    .from("crm_work_items")
    .select("id, organisation_id")
    .eq("id", workId)
    .maybeSingle();

  if (
    !work ||
    String(work.organisation_id || "") !== String(profile.organisation_id || "")
  ) {
    return null;
  }

  return { user: authData.user, profile, work };
}

export async function POST(request: Request, context: any) {
  try {
    const params = await context.params;
    const workId = String(params?.id || "").trim();
    const supabase = adminClient();
    const auth = await authContext(request, workId, supabase);

    if (!auth) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const body = await request.json();
    const label = String(body.label || "").trim();
    if (!label) {
      return NextResponse.json({ error: "Checklist item is required." }, { status: 400 });
    }

    const { data: lastItem } = await supabase
      .from("crm_work_item_checklist")
      .select("item_order")
      .eq("work_item_id", workId)
      .order("item_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase
      .from("crm_work_item_checklist")
      .insert({
        work_item_id: workId,
        item_order: Number(lastItem?.item_order || 0) + 1,
        label,
        status: "outstanding",
        item_type: "manual",
        template_key: "manual_addition",
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Add checklist item failed:", error);
    return NextResponse.json(
      { error: error?.message || "Could not add checklist item." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: any) {
  try {
    const params = await context.params;
    const workId = String(params?.id || "").trim();
    const supabase = adminClient();
    const auth = await authContext(request, workId, supabase);

    if (!auth) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const body = await request.json();
    const itemId = String(body.itemId || "").trim();

    const { data: item, error: itemError } = await supabase
      .from("crm_work_item_checklist")
      .select("id, item_type, status, allow_not_applicable")
      .eq("id", itemId)
      .eq("work_item_id", workId)
      .maybeSingle();

    if (itemError || !item) {
      return NextResponse.json({ error: "Checklist item not found." }, { status: 404 });
    }

    if (item.item_type === "dependency") {
      return NextResponse.json(
        { error: "Dependency items are completed automatically from linked PracticePilot work." },
        { status: 400 }
      );
    }

    const status = String(body.status || item.status);
    const allowed = new Set(["outstanding", "received", "completed", "not_applicable"]);

    if (!allowed.has(status)) {
      return NextResponse.json({ error: "Invalid checklist status." }, { status: 400 });
    }

    if (status === "not_applicable" && item.allow_not_applicable === false) {
      return NextResponse.json(
        { error: "This checklist step is required by the practice and cannot be marked N/A." },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (body.notes !== undefined) {
      updatePayload.notes = String(body.notes || "").trim() || null;
    }

    const { error } = await supabase
      .from("crm_work_item_checklist")
      .update(updatePayload)
      .eq("id", itemId)
      .eq("work_item_id", workId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Update checklist item failed:", error);
    return NextResponse.json(
      { error: error?.message || "Could not update checklist item." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: any) {
  try {
    const params = await context.params;
    const workId = String(params?.id || "").trim();
    const supabase = adminClient();
    const auth = await authContext(request, workId, supabase);

    if (!auth) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const url = new URL(request.url);
    const itemId = String(url.searchParams.get("itemId") || "").trim();

    const { data: item } = await supabase
      .from("crm_work_item_checklist")
      .select("id, item_type")
      .eq("id", itemId)
      .eq("work_item_id", workId)
      .maybeSingle();

    if (!item) {
      return NextResponse.json({ error: "Checklist item not found." }, { status: 404 });
    }

    if (item.item_type === "dependency") {
      return NextResponse.json(
        { error: "Generated dependency items cannot be deleted here." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("crm_work_item_checklist")
      .delete()
      .eq("id", itemId)
      .eq("work_item_id", workId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete checklist item failed:", error);
    return NextResponse.json(
      { error: error?.message || "Could not delete checklist item." },
      { status: 500 }
    );
  }
}
