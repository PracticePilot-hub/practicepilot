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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("project_timeline_items")
    .select(`
      *,
      project_contractors (
        id,
        contractor_name,
        trade_category
      )
    `)
    .eq("project_id", projectId)
    .order("start_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ timelineItems: data || [] });
}

export async function POST(req: Request) {
  const body = await req.json();

  if (String(body.action || "").trim() === "delete") {
  const timelineItemId = String(body.timelineItemId || "").trim();

  if (!timelineItemId) {
    return NextResponse.json({ error: "Timeline item ID is required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("project_timeline_items")
    .delete()
    .eq("id", timelineItemId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

if (String(body.action || "").trim() === "update") {
  const timelineItemId = String(body.timelineItemId || "").trim();
  const title = String(body.title || "").trim();

  if (!timelineItemId) {
    return NextResponse.json({ error: "Timeline item ID is required." }, { status: 400 });
  }

  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("project_timeline_items")
    .update({
      contractor_id: String(body.contractorId || "").trim() || null,
      title,
      description: String(body.description || "").trim() || null,
      start_date: body.startDate || null,
      end_date: body.endDate || null,
      status: String(body.status || "Planned").trim(),
    })
    .eq("id", timelineItemId)
    .select(`
      *,
      project_contractors (
        id,
        contractor_name,
        trade_category
      )
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ timelineItem: data });
}

if (String(body.action || "").trim() === "update-status") {
  const timelineItemId = String(body.timelineItemId || "").trim();
  const status = String(body.status || "").trim();

  if (!timelineItemId) {
    return NextResponse.json({ error: "Timeline item ID is required." }, { status: 400 });
  }

  if (!status) {
    return NextResponse.json({ error: "Status is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("project_timeline_items")
    .update({ status })
    .eq("id", timelineItemId)
    .select(`
      *,
      project_contractors (
        id,
        contractor_name,
        trade_category
      )
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ timelineItem: data });
}

if (String(body.action || "").trim() === "list") {
  const projectId = String(body.projectId || "").trim();

  if (!projectId) {
    return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("project_timeline_items")
    .select(`
      *,
      project_contractors (
        id,
        contractor_name,
        trade_category
      )
    `)
    .eq("project_id", projectId)
    .order("start_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ timelineItems: data || [] });
}

  const projectId = String(body.projectId || "").trim();
  const organisationId = String(body.organisationId || "").trim() || null;
  const contractorId = String(body.contractorId || "").trim() || null;
  const title = String(body.title || "").trim();

  if (!projectId) {
    return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
  }

  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("project_timeline_items")
    .insert({
      project_id: projectId,
      organisation_id: organisationId,
      contractor_id: contractorId,
      title,
      description: String(body.description || "").trim() || null,
      start_date: body.startDate || null,
      end_date: body.endDate || null,
      status: String(body.status || "Planned").trim(),
    })
    .select(`
      *,
      project_contractors (
        id,
        contractor_name,
        trade_category
      )
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ timelineItem: data });
}