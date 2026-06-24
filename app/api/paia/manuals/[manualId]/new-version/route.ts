// Path: app/api/paia/manuals/[manualId]/new-version/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    manualId: string;
  }>;
};

const sectionTables = [
  "paia_manual_records",
  "paia_manual_legislation",
  "paia_manual_processing_purposes",
  "paia_manual_data_subjects",
  "paia_manual_personal_information_categories",
  "paia_manual_recipients",
  "paia_manual_cross_border",
  "paia_manual_security_measures",
  "paia_manual_signatories",
];

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
    throw new Error("Missing server Supabase key.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }) as any;
}

function nextVersionNumber(currentVersion: string | null | undefined) {
  const raw = String(currentVersion || "1.0").trim();
  const major = Number(raw.split(".")[0]);

  if (!Number.isFinite(major) || major < 1) {
    return "2.0";
  }

  return `${major + 1}.0`;
}

function cleanManualForCopy(oldManual: Record<string, any>) {
  const copy = { ...oldManual };

  delete copy.id;
  delete copy.created_at;
  delete copy.updated_at;

  copy.version_number = nextVersionNumber(oldManual.version_number);
  copy.status = "draft";
  copy.date_compiled = new Date().toISOString().slice(0, 10);
  copy.next_review_date = null;
  copy.reviewed_by = null;
  copy.approved_by = null;
  copy.created_from_manual_id = oldManual.id;

  return copy;
}

function cleanSectionRowForCopy(row: Record<string, any>, newManualId: string) {
  const copy = { ...row };

  delete copy.id;
  delete copy.created_at;
  delete copy.updated_at;

  copy.manual_id = newManualId;

  return copy;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { manualId } = await context.params;
    const supabase = getSupabaseAdmin();

    const { data: oldManualRows, error: oldManualError } = await supabase
      .from("paia_manuals")
      .select("*")
      .eq("id", manualId)
      .limit(1);

    if (oldManualError) {
      return NextResponse.json(
        { error: oldManualError.message },
        { status: 500 }
      );
    }

    const oldManual = Array.isArray(oldManualRows) ? oldManualRows[0] : null;

    if (!oldManual) {
      return NextResponse.json(
        { error: "Original PAIA manual not found." },
        { status: 404 }
      );
    }

    if (String(oldManual.status || "").toLowerCase() !== "finalised") {
      return NextResponse.json(
        { error: "Only finalised PAIA manuals can be versioned." },
        { status: 400 }
      );
    }

    const newManualPayload = cleanManualForCopy(oldManual);

    const { data: newManualRows, error: newManualError } = await supabase
      .from("paia_manuals")
      .insert(newManualPayload)
      .select("*")
      .limit(1);

    if (newManualError) {
      return NextResponse.json(
        { error: `Could not create new manual: ${newManualError.message}` },
        { status: 500 }
      );
    }

    const newManual = Array.isArray(newManualRows) ? newManualRows[0] : null;

    if (!newManual?.id) {
      return NextResponse.json(
        { error: "New PAIA manual version was not returned after insert." },
        { status: 500 }
      );
    }

    for (const table of sectionTables) {
      const { data: oldRows, error: loadError } = await supabase
        .from(table)
        .select("*")
        .eq("manual_id", manualId);

      if (loadError) {
        return NextResponse.json(
          { error: `Could not load ${table}: ${loadError.message}` },
          { status: 500 }
        );
      }

      const rowsToInsert = (oldRows ?? []).map((row: Record<string, any>) =>
        cleanSectionRowForCopy(row, newManual.id)
      );

      if (rowsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from(table)
          .insert(rowsToInsert);

        if (insertError) {
          return NextResponse.json(
            { error: `Could not copy ${table}: ${insertError.message}` },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      manual: newManual,
      new_manual_id: newManual.id,
      version_number: newManual.version_number,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message ?? "Failed to create new PAIA manual version.",
      },
      { status: 500 }
    );
  }
}