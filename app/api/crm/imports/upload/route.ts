import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REQUIRED_SHEETS = [
  "Import Control",
  "Clients",
  "People",
  "People Roles",
  "Client Groups",
  "Group Members",
  "Registrations",
  "Addresses",
  "Document Links",
];

const IMPORT_SHEETS = REQUIRED_SHEETS.filter(
  (name) => name !== "Import Control"
);

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) throw new Error("Missing Supabase service-role key.");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

async function currentProfile(request: Request) {
  const admin = getSupabaseAdmin();
  const token = bearerToken(request);

  if (!token) {
    return {
      admin,
      profile: null,
      response: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !user) {
    return {
      admin,
      profile: null,
      response: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select(
      "id,user_id,organisation_id,role,access_enabled,can_access_crm,can_manage_practice_users,is_practice_owner,full_name,email"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    !profile.organisation_id ||
    profile.access_enabled === false ||
    profile.can_access_crm === false
  ) {
    return {
      admin,
      profile: null,
      response: NextResponse.json(
        { error: "CRM access denied." },
        { status: 403 }
      ),
    };
  }

  const canImport = Boolean(
    profile.is_practice_owner ||
      profile.can_manage_practice_users ||
      ["Client Manager", "Admin", "Super Admin"].includes(
        String(profile.role || "")
      )
  );

  if (!canImport) {
    return {
      admin,
      profile: null,
      response: NextResponse.json(
        { error: "Practice manager access is required for CRM imports." },
        { status: 403 }
      ),
    };
  }

  return { admin, profile, response: null };
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normaliseImportMode(value: string) {
  const mode = value.toLowerCase();

  if (mode === "add new") return "add_new";
  if (mode === "update existing") return "update_existing";
  if (mode === "add + update") return "add_update";

  throw new Error(
    'Import Control must use "Add New", "Update Existing" or "Add + Update".'
  );
}

function normaliseGroupHandling(value: string) {
  const v = value.toLowerCase();

  if (v === "create if missing + link if existing") {
    return "create_if_missing_link_existing";
  }
  if (v === "link existing only") return "link_existing_only";
  if (v === "do not import groups") return "do_not_import_groups";

  throw new Error("Import Control contains an invalid Group Handling value.");
}

function controlValue(
  rows: unknown[][],
  label: string
) {
  const row = rows.find(
    (candidate) => text(candidate?.[0]).toLowerCase() === label.toLowerCase()
  );
  return text(row?.[1]);
}

function sheetRows(workbook: XLSX.WorkBook, sheetName: string) {
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) return [];

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: 3,
    defval: "",
    raw: false,
  });
}

function meaningfulRows(rows: Record<string, unknown>[]) {
  return rows.filter((row) =>
    Object.values(row).some((value) => text(value) !== "")
  );
}

function recordTypeForSheet(sheetName: string) {
  const map: Record<string, string> = {
    Clients: "client",
    People: "person",
    "People Roles": "people_role",
    "Client Groups": "client_group",
    "Group Members": "group_member",
    Registrations: "registration",
    Addresses: "address",
    "Document Links": "document_link",
  };

  return map[sheetName] || sheetName.toLowerCase().replaceAll(" ", "_");
}

function importKeyForRow(
  sheetName: string,
  row: Record<string, unknown>
) {
  const keys: Record<string, string[]> = {
    Clients: ["Client Import Key*"],
    People: ["Person Import Key*"],
    "People Roles": ["Client Import Key*", "Person Import Key*"],
    "Client Groups": ["Group Import Key*"],
    "Group Members": ["Group Import Key*", "Client Import Key*"],
    Registrations: ["Client Import Key*", "Registration Type*"],
    Addresses: ["Client Import Key*", "Address Type*"],
    "Document Links": ["Client Import Key*", "Link / URL*"],
  };

  const fields = keys[sheetName] || [];
  const parts = fields.map((field) => text(row[field])).filter(Boolean);

  return parts.length ? parts.join("::") : null;
}

function validateRow(
  sheetName: string,
  row: Record<string, unknown>
) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (sheetName === "Clients") {
    if (!text(row["Client Import Key*"])) {
      errors.push("Client Import Key is required.");
    }
    if (!text(row["Client / Record Name*"])) {
      errors.push("Client / Record Name is required.");
    }
    if (!text(row["Relationship Status*"])) {
      errors.push("Relationship Status is required.");
    }
    if (!text(row["Record Type*"])) {
      errors.push("Record Type is required.");
    }
    if (text(row["Force Review?"]).toLowerCase() === "yes") {
      warnings.push("Source row is marked for manual review.");
    }
  }

  if (sheetName === "People") {
    if (!text(row["Person Import Key*"])) {
      errors.push("Person Import Key is required.");
    }
  }

  if (sheetName === "Client Groups") {
    if (!text(row["Group Import Key*"])) {
      errors.push("Group Import Key is required.");
    }
    if (!text(row["Group Name*"])) {
      errors.push("Group Name is required.");
    }
  }

  if (sheetName === "Group Members") {
    if (!text(row["Group Import Key*"])) {
      errors.push("Group Import Key is required.");
    }
    if (!text(row["Client Import Key*"])) {
      errors.push("Client Import Key is required.");
    }
  }

  if (sheetName === "People Roles") {
    if (!text(row["Client Import Key*"])) {
      errors.push("Client Import Key is required.");
    }
    if (!text(row["Person Import Key*"])) {
      errors.push("Person Import Key is required.");
    }
    if (!text(row["Role*"])) {
      errors.push("Role is required.");
    }
  }

  if (sheetName === "Registrations") {
    if (!text(row["Client Import Key*"])) {
      errors.push("Client Import Key is required.");
    }
    if (!text(row["Registration Type*"])) {
      errors.push("Registration Type is required.");
    }
  }

  if (sheetName === "Addresses") {
    if (!text(row["Client Import Key*"])) {
      errors.push("Client Import Key is required.");
    }
    if (!text(row["Address Type*"])) {
      errors.push("Address Type is required.");
    }
  }

  if (sheetName === "Document Links") {
    if (!text(row["Client Import Key*"])) {
      errors.push("Client Import Key is required.");
    }
    if (!text(row["Provider*"])) {
      errors.push("Provider is required.");
    }
    if (!text(row["Link / URL*"])) {
      errors.push("Link / URL is required.");
    }
  }

  return { errors, warnings };
}

export async function POST(request: Request) {
  let batchId: string | null = null;

  try {
    const { admin, profile, response } = await currentProfile(request);
    if (response || !profile) return response;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please choose a PracticePilot Master Import workbook." },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "Only .xlsx PracticePilot Master Import workbooks are supported." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash("sha256").update(buffer).digest("hex");

    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
    });

    const missingSheets = REQUIRED_SHEETS.filter(
      (sheetName) => !workbook.SheetNames.includes(sheetName)
    );

    if (missingSheets.length) {
      return NextResponse.json(
        {
          error: `This is not a valid PracticePilot CRM Master Import workbook. Missing tab(s): ${missingSheets.join(
            ", "
          )}.`,
        },
        { status: 400 }
      );
    }

    const controlSheet = workbook.Sheets["Import Control"];
    const controlRows = XLSX.utils.sheet_to_json<unknown[]>(controlSheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    const practiceName = controlValue(controlRows, "Practice Name*");
    const importPurpose = controlValue(controlRows, "Import Purpose*");
    const importModeDisplay = controlValue(controlRows, "Import Mode*");
    const sourceSystem = controlValue(controlRows, "Source System*");
    const sourceExportDate = controlValue(controlRows, "Source Export Date");
    const batchReference = controlValue(
      controlRows,
      "Migration Batch Reference*"
    );
    const preparedBy = controlValue(controlRows, "Prepared By");
    const groupHandlingDisplay = controlValue(
      controlRows,
      "Group Handling*"
    );

    if (!batchReference) {
      throw new Error(
        "Import Control: Migration Batch Reference is required."
      );
    }

    if (!importModeDisplay) {
      throw new Error("Import Control: Import Mode is required.");
    }

    if (!groupHandlingDisplay) {
      throw new Error("Import Control: Group Handling is required.");
    }

    const importMode = normaliseImportMode(importModeDisplay);
    const groupHandling = normaliseGroupHandling(groupHandlingDisplay);

    const { data: existingBatch } = await admin
      .from("crm_import_batches")
      .select(
        "id,batch_reference,status,import_mode,source_system,original_filename,file_hash"
      )
      .eq("organisation_id", profile.organisation_id)
      .eq("batch_reference", batchReference)
      .maybeSingle();

    if (existingBatch) {
      if (
        existingBatch.file_hash &&
        existingBatch.file_hash !== fileHash
      ) {
        return NextResponse.json(
          {
            error: `Batch ${batchReference} already belongs to a different workbook. Change the Migration Batch Reference before uploading this file.`,
          },
          { status: 409 }
        );
      }

      const { data: existingRows, error: existingRowsError } = await admin
        .from("crm_import_rows")
        .select("sheet_name,match_status")
        .eq("organisation_id", profile.organisation_id)
        .eq("batch_id", existingBatch.id);

      if (existingRowsError) throw existingRowsError;

      const rows = existingRows || [];
      const countSheet = (sheetName: string) =>
        rows.filter((row) => row.sheet_name === sheetName).length;

      const review = rows.filter((row) =>
        ["review", "possible_duplicate"].includes(
          String(row.match_status || "")
        )
      ).length;

      const errors = rows.filter(
        (row) => row.match_status === "error"
      ).length;

      return NextResponse.json({
        success: true,
        existing: true,
        batch: {
          id: existingBatch.id,
          batch_reference: existingBatch.batch_reference,
          status: existingBatch.status,
          import_mode: existingBatch.import_mode,
          source_system: existingBatch.source_system,
          original_filename: existingBatch.original_filename,
        },
        counts: {
          total: rows.length,
          clients: countSheet("Clients"),
          people: countSheet("People"),
          peopleRoles: countSheet("People Roles"),
          groups: countSheet("Client Groups"),
          groupMembers: countSheet("Group Members"),
          registrations: countSheet("Registrations"),
          addresses: countSheet("Addresses"),
          documentLinks: countSheet("Document Links"),
          review,
          errors,
        },
      });
    }

    const { data: batch, error: batchError } = await admin
      .from("crm_import_batches")
      .insert({
        organisation_id: profile.organisation_id,
        batch_reference: batchReference,
        practice_name: practiceName || null,
        import_purpose: importPurpose || null,
        import_mode: importMode,
        source_system: sourceSystem || null,
        source_export_date: sourceExportDate || null,
        prepared_by: preparedBy || profile.full_name || profile.email || null,
        group_handling: groupHandling,
        original_filename: file.name,
        file_hash: fileHash,
        status: "validating",
        created_by_user_id: profile.user_id,
      })
      .select("*")
      .single();

    if (batchError || !batch) {
      throw new Error(batchError?.message || "Could not create import batch.");
    }

    batchId = batch.id;

    const rowsToInsert: Record<string, unknown>[] = [];
    const perSheetCounts: Record<string, number> = {};
    let reviewCount = 0;
    let errorCount = 0;

    for (const sheetName of IMPORT_SHEETS) {
      const rows = meaningfulRows(sheetRows(workbook, sheetName));
      perSheetCounts[sheetName] = rows.length;

      rows.forEach((row, index) => {
        const { errors, warnings } = validateRow(sheetName, row);

        const rowStatus =
          errors.length > 0
            ? "error"
            : warnings.length > 0
              ? "review"
              : "pending";

        if (rowStatus === "error") errorCount += 1;
        if (rowStatus === "review") reviewCount += 1;

        rowsToInsert.push({
          organisation_id: profile.organisation_id,
          batch_id: batch.id,
          sheet_name: sheetName,
          source_row_number: index + 5,
          import_key: importKeyForRow(sheetName, row),
          record_type: recordTypeForSheet(sheetName),
          raw_data: row,
          normalized_data: row,
          match_status: rowStatus,
          validation_errors: errors,
          validation_warnings: warnings,
          approved_for_import: false,
          import_status: "not_imported",
        });
      });
    }

    if (rowsToInsert.length) {
      const chunkSize = 500;

      for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
        const chunk = rowsToInsert.slice(i, i + chunkSize);
        const { error: rowInsertError } = await admin
          .from("crm_import_rows")
          .insert(chunk);

        if (rowInsertError) throw rowInsertError;
      }
    }

    const finalStatus =
      errorCount > 0 || reviewCount > 0 ? "review_required" : "ready";

    const { error: batchUpdateError } = await admin
      .from("crm_import_batches")
      .update({
        status: finalStatus,
        total_rows: rowsToInsert.length,
        review_count: reviewCount,
        error_count: errorCount,
      })
      .eq("id", batch.id);

    if (batchUpdateError) throw batchUpdateError;

    await admin.from("crm_import_events").insert({
      organisation_id: profile.organisation_id,
      batch_id: batch.id,
      event_type: "workbook_staged",
      message: `Workbook staged with ${rowsToInsert.length} row(s).`,
      details: {
        filename: file.name,
        file_hash: fileHash,
        counts: perSheetCounts,
        review_count: reviewCount,
        error_count: errorCount,
      },
      created_by_user_id: profile.user_id,
    });

    return NextResponse.json({
      success: true,
      batch: {
        id: batch.id,
        batch_reference: batchReference,
        status: finalStatus,
        import_mode: importMode,
        source_system: sourceSystem || null,
        original_filename: file.name,
      },
      counts: {
        total: rowsToInsert.length,
        clients: perSheetCounts["Clients"] || 0,
        people: perSheetCounts["People"] || 0,
        peopleRoles: perSheetCounts["People Roles"] || 0,
        groups: perSheetCounts["Client Groups"] || 0,
        groupMembers: perSheetCounts["Group Members"] || 0,
        registrations: perSheetCounts["Registrations"] || 0,
        addresses: perSheetCounts["Addresses"] || 0,
        documentLinks: perSheetCounts["Document Links"] || 0,
        review: reviewCount,
        errors: errorCount,
      },
    });
  } catch (error) {
    console.error("CRM import staging failed:", error);

    if (batchId) {
      try {
        const admin = getSupabaseAdmin();
        await admin
          .from("crm_import_batches")
          .update({ status: "failed" })
          .eq("id", batchId);
      } catch (cleanupError) {
        console.error("Could not mark CRM import batch failed:", cleanupError);
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not stage the CRM import workbook.",
      },
      { status: 500 }
    );
  }
}
