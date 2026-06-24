// Path: app/api/paia/manuals/[manualId]/sections/route.ts

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
    throw new Error(
      "Missing Supabase environment variables. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local, then restart npm run dev."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey) as any;
}

function bool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function text(value: unknown) {
  const cleaned = String(value ?? "").trim();
  return cleaned.length ? cleaned : null;
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function replaceRows(
  supabase: any,
  table: string,
  manualId: string,
  rows: Record<string, unknown>[]
) {
  const deleteResult = await supabase.from(table).delete().eq("manual_id", manualId);

  if (deleteResult.error) {
    throw new Error(deleteResult.error.message);
  }

  if (!rows.length) {
    return;
  }

  const insertResult = await supabase.from(table).insert(rows);

  if (insertResult.error) {
    throw new Error(insertResult.error.message);
  }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { manualId } = await context.params;
    const supabase = getSupabaseAdmin();

    const [
      records,
      legislation,
      purposes,
      dataSubjects,
      informationCategories,
      recipients,
      crossBorder,
      securityMeasures,
      signatories,
    ] = await Promise.all([
      supabase
        .from("paia_manual_records")
        .select("*")
        .eq("manual_id", manualId)
        .order("category_key", { ascending: true })
        .order("sort_order", { ascending: true }),
      supabase
        .from("paia_manual_legislation")
        .select("*")
        .eq("manual_id", manualId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("paia_manual_processing_purposes")
        .select("*")
        .eq("manual_id", manualId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("paia_manual_data_subjects")
        .select("*")
        .eq("manual_id", manualId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("paia_manual_personal_information_categories")
        .select("*")
        .eq("manual_id", manualId)
        .order("person_type", { ascending: true })
        .order("sort_order", { ascending: true }),
      supabase
        .from("paia_manual_recipients")
        .select("*")
        .eq("manual_id", manualId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("paia_manual_cross_border")
        .select("*")
        .eq("manual_id", manualId)
        .order("created_at", { ascending: true }),
      supabase
        .from("paia_manual_security_measures")
        .select("*")
        .eq("manual_id", manualId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("paia_manual_signatories")
        .select("*")
        .eq("manual_id", manualId)
        .order("sort_order", { ascending: true }),
    ]);

    const firstError =
      records.error ||
      legislation.error ||
      purposes.error ||
      dataSubjects.error ||
      informationCategories.error ||
      recipients.error ||
      crossBorder.error ||
      securityMeasures.error ||
      signatories.error;

    if (firstError) {
      return NextResponse.json({ error: firstError.message }, { status: 500 });
    }

    return NextResponse.json({
      records: records.data ?? [],
      legislation: legislation.data ?? [],
      purposes: purposes.data ?? [],
      dataSubjects: dataSubjects.data ?? [],
      informationCategories: informationCategories.data ?? [],
      recipients: recipients.data ?? [],
      crossBorder: crossBorder.data ?? [],
      securityMeasures: securityMeasures.data ?? [],
      signatories: signatories.data ?? [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load PAIA sections." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { manualId } = await context.params;
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    const section = String(body.section ?? "");
    const rows = Array.isArray(body.rows) ? body.rows : [];

    if (section === "records") {
      await replaceRows(
        supabase,
        "paia_manual_records",
        manualId,
        rows.map((row: any, index: number) => ({
          manual_id: manualId,
          category_key: text(row.category_key) || "general",
          record_name: text(row.record_name) || "Untitled record",
          is_selected: bool(row.is_selected, true),
          is_custom: bool(row.is_custom, false),
          available_on_website: bool(row.available_on_website, false),
          available_on_request: bool(row.available_on_request, true),
          notes: text(row.notes),
          sort_order: numberValue(row.sort_order, index + 1),
        }))
      );
    } else if (section === "legislation") {
      await replaceRows(
        supabase,
        "paia_manual_legislation",
        manualId,
        rows.map((row: any, index: number) => ({
          manual_id: manualId,
          legislation_name: text(row.legislation_name) || "Untitled legislation",
          applicable_records: text(row.applicable_records),
          is_selected: bool(row.is_selected, true),
          is_custom: bool(row.is_custom, false),
          sort_order: numberValue(row.sort_order, index + 1),
        }))
      );
    } else if (section === "purposes") {
      await replaceRows(
        supabase,
        "paia_manual_processing_purposes",
        manualId,
        rows.map((row: any, index: number) => ({
          manual_id: manualId,
          purpose_name: text(row.purpose_name) || "Untitled purpose",
          is_selected: bool(row.is_selected, true),
          is_custom: bool(row.is_custom, false),
          sort_order: numberValue(row.sort_order, index + 1),
        }))
      );
    } else if (section === "dataSubjects") {
      await replaceRows(
        supabase,
        "paia_manual_data_subjects",
        manualId,
        rows.map((row: any, index: number) => ({
          manual_id: manualId,
          subject_name: text(row.subject_name) || "Untitled data subject",
          information_processed: text(row.information_processed),
          is_selected: bool(row.is_selected, true),
          is_custom: bool(row.is_custom, false),
          sort_order: numberValue(row.sort_order, index + 1),
        }))
      );
    } else if (section === "informationCategories") {
      await replaceRows(
        supabase,
        "paia_manual_personal_information_categories",
        manualId,
        rows.map((row: any, index: number) => ({
          manual_id: manualId,
          person_type: text(row.person_type) || "natural_person",
          category_name: text(row.category_name) || "Untitled information category",
          is_selected: bool(row.is_selected, true),
          is_custom: bool(row.is_custom, false),
          sort_order: numberValue(row.sort_order, index + 1),
        }))
      );
    } else if (section === "recipients") {
      await replaceRows(
        supabase,
        "paia_manual_recipients",
        manualId,
        rows.map((row: any, index: number) => ({
          manual_id: manualId,
          recipient_name: text(row.recipient_name) || "Untitled recipient",
          information_shared: text(row.information_shared),
          is_selected: bool(row.is_selected, true),
          is_custom: bool(row.is_custom, false),
          sort_order: numberValue(row.sort_order, index + 1),
        }))
      );
    } else if (section === "crossBorder") {
      await replaceRows(
        supabase,
        "paia_manual_cross_border",
        manualId,
        rows.map((row: any) => ({
          manual_id: manualId,
          option_key: text(row.option_key) || "custom",
          description: text(row.description),
          is_selected: bool(row.is_selected, false),
        }))
      );
    } else if (section === "securityMeasures") {
      await replaceRows(
        supabase,
        "paia_manual_security_measures",
        manualId,
        rows.map((row: any, index: number) => ({
          manual_id: manualId,
          measure_name: text(row.measure_name) || "Untitled security measure",
          is_selected: bool(row.is_selected, true),
          is_custom: bool(row.is_custom, false),
          sort_order: numberValue(row.sort_order, index + 1),
        }))
      );
    } else if (section === "signatories") {
      await replaceRows(
        supabase,
        "paia_manual_signatories",
        manualId,
        rows.map((row: any, index: number) => ({
          manual_id: manualId,
          signatory_name: text(row.signatory_name) || "Untitled signatory",
          signatory_capacity: text(row.signatory_capacity),
          signature_label: text(row.signature_label),
          signed_at: text(row.signed_at),
          sort_order: numberValue(row.sort_order, index + 1),
        }))
      );
    } else {
      return NextResponse.json(
        { error: "Unknown PAIA section." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to save PAIA section." },
      { status: 500 }
    );
  }
}
