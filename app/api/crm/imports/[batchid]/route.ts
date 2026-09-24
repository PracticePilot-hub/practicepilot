import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) throw new Error("Supabase server credentials are missing.");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getProfile(request: Request) {
  const admin = getAdmin();
  const token = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) return { admin, profile: null };

  const {
    data: { user },
  } = await admin.auth.getUser(token);

  if (!user) return { admin, profile: null };

  const { data: profile } = await admin
    .from("user_profiles")
    .select("user_id,organisation_id,access_enabled,can_access_crm")
    .eq("user_id", user.id)
    .maybeSingle();

  return { admin, profile };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ batchid?: string; batchId?: string }> }
) {
  try {
    const routeParams = await context.params;
    const batchId = String(routeParams.batchid || routeParams.batchId || "");

    if (!batchId) {
      return NextResponse.json(
        { error: "Import batch ID is missing." },
        { status: 400 }
      );
    }
    const { admin, profile } = await getProfile(request);

    if (
      !profile ||
      !profile.organisation_id ||
      profile.access_enabled === false ||
      profile.can_access_crm === false
    ) {
      return NextResponse.json({ error: "CRM access denied." }, { status: 403 });
    }

    const organisationId = profile.organisation_id;
    const url = new URL(request.url);

    const requestedPage = Math.max(
      1,
      Number(url.searchParams.get("page") || "1")
    );

    const pageSize = Math.min(
      200,
      Math.max(25, Number(url.searchParams.get("pageSize") || "100"))
    );

    const sheet = (url.searchParams.get("sheet") || "").trim();
    const status = (url.searchParams.get("status") || "").trim();

    // One small batch query.
    const { data: batch, error: batchError } = await admin
      .from("crm_import_batches")
      .select(
        "id,batch_reference,import_mode,source_system,original_filename,status,total_rows,create_count,update_count,skip_count,review_count,error_count"
      )
      .eq("id", batchId)
      .eq("organisation_id", organisationId)
      .maybeSingle();

    if (batchError) throw batchError;

    if (!batch) {
      return NextResponse.json(
        { error: "Import batch not found." },
        { status: 404 }
      );
    }

    // Initial page: NO expensive full-batch count scans.
    // Use the counts already stored on crm_import_batches.
    let filteredTotal = Number(batch.total_rows || 0);

    let countQuery = admin
      .from("crm_import_rows")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batchId)
      .eq("organisation_id", organisationId);

    const hasFilter = Boolean(sheet || status);

    if (sheet) countQuery = countQuery.eq("sheet_name", sheet);
    if (status) countQuery = countQuery.eq("match_status", status);

    if (hasFilter) {
      const { count, error } = await countQuery;
      if (error) throw error;
      filteredTotal = count || 0;
    }

    const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // One paginated row query only.
    let rowsQuery = admin
      .from("crm_import_rows")
      .select(
        "id,sheet_name,source_row_number,import_key,record_type,raw_data,match_status,matched_record_id,matched_by,match_notes,validation_errors,validation_warnings,approved_for_import"
      )
      .eq("batch_id", batchId)
      .eq("organisation_id", organisationId);

    if (sheet) rowsQuery = rowsQuery.eq("sheet_name", sheet);
    if (status) rowsQuery = rowsQuery.eq("match_status", status);

    const { data: rows, error: rowsError } = await rowsQuery
      .order("sheet_name")
      .order("source_row_number")
      .range(from, to);

    if (rowsError) throw rowsError;

    const total = Number(batch.total_rows || 0);
    const review = Number(batch.review_count || 0);
    const errorCount = Number(batch.error_count || 0);
    const create = Number(batch.create_count || 0);
    const update = Number(batch.update_count || 0);
    const skip = Number(batch.skip_count || 0);

    const classified = create + update + skip + review + errorCount;
    const pending = Math.max(0, total - classified);

    const { count: approvedCount, error: approvedCountError } = await admin
      .from("crm_import_rows")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batchId)
      .eq("organisation_id", organisationId)
      .eq("approved_for_import", true)
      .eq("import_status", "not_imported");

    if (approvedCountError) throw approvedCountError;

    return NextResponse.json({
      success: true,
      batch,
      rows: rows || [],
      counts: {
        total,
        pending,
        review,
        error: errorCount,
        approved: approvedCount || 0,
      },
      pagination: {
        page,
        pageSize,
        totalPages,
        filteredTotal,
      },
    });
  } catch (error) {
    console.error("CRM IMPORT REVIEW GET ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load the import batch.",
      },
      { status: 500 }
    );
  }
}
