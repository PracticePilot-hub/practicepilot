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

function text(value: unknown) {
  return String(value ?? "").trim();
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
    .select("user_id,organisation_id,role,access_enabled,can_access_crm,can_manage_practice_users,is_practice_owner")
    .eq("user_id", user.id)
    .maybeSingle();

  return { admin, profile };
}

export async function POST(
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
      !profile?.organisation_id ||
      profile.access_enabled === false ||
      profile.can_access_crm === false
    ) {
      return NextResponse.json({ error: "CRM access denied." }, { status: 403 });
    }

    const { data: batch } = await admin
      .from("crm_import_batches")
      .select("id")
      .eq("id", batchId)
      .eq("organisation_id", profile.organisation_id)
      .maybeSingle();

    if (!batch) {
      return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
    }

    const { data: rows, error: rowsError } = await admin
      .from("crm_import_rows")
      .select("*")
      .eq("batch_id", batchId)
      .eq("organisation_id", profile.organisation_id)
      .order("sheet_name")
      .order("source_row_number");

    if (rowsError) throw rowsError;

    const safeRows = rows || [];

    const clients = safeRows.filter((row) => row.sheet_name === "Clients");
    const people = safeRows.filter((row) => row.sheet_name === "People");
    const groups = safeRows.filter((row) => row.sheet_name === "Client Groups");

    const clientKeys = new Set(clients.map((row) => text(row.raw_data?.["Client Import Key*"])).filter(Boolean));
    const personKeys = new Set(people.map((row) => text(row.raw_data?.["Person Import Key*"])).filter(Boolean));
    const groupKeys = new Set(groups.map((row) => text(row.raw_data?.["Group Import Key*"])).filter(Boolean));

    const duplicateImportKeys = new Set<string>();
    const seen = new Set<string>();

    for (const row of safeRows) {
      if (!row.import_key) continue;
      const composite = `${row.sheet_name}::${row.import_key}`;
      if (seen.has(composite)) duplicateImportKeys.add(composite);
      seen.add(composite);
    }

    const clientNumbers = new Map<string, number>();
    const legalIds = new Map<string, number>();
    const names = new Map<string, number>();

    for (const row of clients) {
      const number = text(row.raw_data?.["Existing Client Number"]);
      const legalId = text(row.raw_data?.["Registration / ID / Trust Number"]);
      const name = text(row.raw_data?.["Client / Record Name*"]).toLowerCase();

      if (number) clientNumbers.set(number, (clientNumbers.get(number) || 0) + 1);
      if (legalId) legalIds.set(legalId, (legalIds.get(legalId) || 0) + 1);
      if (name) names.set(name, (names.get(name) || 0) + 1);
    }

    let errorCount = 0;
    let reviewCount = 0;

    const updates = safeRows.map((row) => {
      const errors = Array.isArray(row.validation_errors)
        ? [...row.validation_errors]
        : [];
      const warnings = Array.isArray(row.validation_warnings)
        ? [...row.validation_warnings]
        : [];

      const composite = row.import_key
        ? `${row.sheet_name}::${row.import_key}`
        : "";

      if (composite && duplicateImportKeys.has(composite)) {
        errors.push(`Duplicate import key inside ${row.sheet_name}.`);
      }

      const raw = row.raw_data || {};

      if (row.sheet_name === "People Roles") {
        const clientKey = text(raw["Client Import Key*"]);
        const personKey = text(raw["Person Import Key*"]);

        if (clientKey && !clientKeys.has(clientKey)) {
          errors.push(`Client Import Key ${clientKey} does not exist in Clients.`);
        }
        if (personKey && !personKeys.has(personKey)) {
          errors.push(`Person Import Key ${personKey} does not exist in People.`);
        }
      }

      if (row.sheet_name === "Group Members") {
        const groupKey = text(raw["Group Import Key*"]);
        const clientKey = text(raw["Client Import Key*"]);

        if (groupKey && !groupKeys.has(groupKey)) {
          errors.push(`Group Import Key ${groupKey} does not exist in Client Groups.`);
        }
        if (clientKey && !clientKeys.has(clientKey)) {
          errors.push(`Client Import Key ${clientKey} does not exist in Clients.`);
        }
      }

      if (
        ["Registrations", "Addresses", "Document Links"].includes(row.sheet_name)
      ) {
        const clientKey = text(raw["Client Import Key*"]);
        if (clientKey && !clientKeys.has(clientKey)) {
          errors.push(`Client Import Key ${clientKey} does not exist in Clients.`);
        }
      }

      if (row.sheet_name === "Clients") {
        const number = text(raw["Existing Client Number"]);
        const legalId = text(raw["Registration / ID / Trust Number"]);
        const name = text(raw["Client / Record Name*"]).toLowerCase();

        if (number && (clientNumbers.get(number) || 0) > 1) {
          warnings.push(`Existing Client Number ${number} appears more than once in this workbook.`);
        }
        if (legalId && (legalIds.get(legalId) || 0) > 1) {
          warnings.push(`Registration / ID / Trust Number ${legalId} appears more than once in this workbook.`);
        }
        if (name && (names.get(name) || 0) > 1) {
          warnings.push("Client / Record Name appears more than once in this workbook.");
        }
        if (text(raw["Force Review?"]).toLowerCase() === "yes") {
          warnings.push("Client row is explicitly marked for review.");
        }
      }

      const uniqueErrors = Array.from(new Set(errors));
      const uniqueWarnings = Array.from(new Set(warnings));

      const status =
        uniqueErrors.length > 0
          ? "error"
          : uniqueWarnings.length > 0
            ? "review"
            : "pending";

      if (status === "error") errorCount += 1;
      if (status === "review") reviewCount += 1;

      return {
        id: row.id,
        validation_errors: uniqueErrors,
        validation_warnings: uniqueWarnings,
        match_status: status,
      };
    });

    const concurrency = 25;

    for (let i = 0; i < updates.length; i += concurrency) {
      const chunk = updates.slice(i, i + concurrency);

      await Promise.all(
        chunk.map(async (item) => {
          const { error: updateError } = await admin
            .from("crm_import_rows")
            .update({
              validation_errors: item.validation_errors,
              validation_warnings: item.validation_warnings,
              match_status: item.match_status,
              approved_for_import: false,
              approved_by_user_id: null,
              approved_at: null,
            })
            .eq("id", item.id);

          if (updateError) throw updateError;
        })
      );
    }

    const nextStatus =
      errorCount > 0 || reviewCount > 0 ? "review_required" : "ready";

    const { error: batchUpdateError } = await admin
      .from("crm_import_batches")
      .update({
        status: nextStatus,
        error_count: errorCount,
        review_count: reviewCount,
      })
      .eq("id", batchId)
      .eq("organisation_id", profile.organisation_id);

    if (batchUpdateError) throw batchUpdateError;

    await admin.from("crm_import_events").insert({
      organisation_id: profile.organisation_id,
      batch_id: batchId,
      event_type: "validation_completed",
      message: `Validation completed with ${reviewCount} review row(s) and ${errorCount} error row(s).`,
      details: {
        review_count: reviewCount,
        error_count: errorCount,
      },
      created_by_user_id: profile.user_id,
    });

    return NextResponse.json({
      success: true,
      status: nextStatus,
      review_count: reviewCount,
      error_count: errorCount,
    });
  } catch (error) {
    console.error("CRM IMPORT VALIDATION ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not validate the import batch.",
      },
      { status: 500 }
    );
  }
}
