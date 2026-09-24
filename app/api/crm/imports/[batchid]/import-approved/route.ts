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

  if (!url || !key) {
    throw new Error("Supabase server credentials are missing.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function nullable(value: unknown) {
  const valueText = text(value);
  if (!valueText || valueText === "[CLEAR]") return null;
  return valueText;
}

function relationStatus(value: unknown) {
  const v = text(value).toLowerCase();

  if (v === "in airspace") return "in_airspace";
  if (v === "on radar") return "on_radar";
  if (v === "former client") return "former_client";
  return "flying_client";
}

function clientCategory(value: unknown) {
  const v = text(value).toLowerCase();

  if (v === "individual") return "individual";
  if (v === "trust") return "trust";
  return "entity";
}

async function currentProfile(request: Request) {
  const admin = adminClient();
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
    .select(
      "user_id,organisation_id,role,access_enabled,can_access_crm,can_manage_practice_users,is_practice_owner"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  return { admin, profile };
}

async function allApprovedRows(
  admin: ReturnType<typeof adminClient>,
  organisationId: string,
  batchId: string
) {
  const all: any[] = [];
  const pageSize = 500;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("crm_import_rows")
      .select("*")
      .eq("organisation_id", organisationId)
      .eq("batch_id", batchId)
      .eq("approved_for_import", true)
      .eq("import_status", "not_imported")
      .order("sheet_name")
      .order("source_row_number")
      .range(from, from + pageSize - 1);

    if (error) throw error;

    const rows = data || [];
    all.push(...rows);

    if (rows.length < pageSize) break;
  }

  return all;
}

async function markRow(
  admin: ReturnType<typeof adminClient>,
  rowId: string,
  status: "imported" | "skipped" | "failed",
  importedRecordId: string | null,
  message: string
) {
  const { error } = await admin
    .from("crm_import_rows")
    .update({
      import_status: status,
      imported_record_id: importedRecordId,
      import_message: message,
    })
    .eq("id", rowId);

  if (error) throw error;
}

async function ledgerUpsert(
  admin: ReturnType<typeof adminClient>,
  organisationId: string,
  batchId: string,
  sourceSystem: string | null,
  importKey: string,
  recordType: string,
  ppRecordId: string
) {
  if (!importKey || !ppRecordId) return;

  const { error } = await admin.from("crm_import_ledger").upsert(
    {
      organisation_id: organisationId,
      source_system: sourceSystem,
      source_import_key: importKey,
      record_type: recordType,
      pp_record_id: ppRecordId,
      first_batch_id: batchId,
      last_batch_id: batchId,
      last_imported_at: new Date().toISOString(),
    },
    {
      onConflict: "organisation_id,record_type,source_import_key",
    }
  );

  if (error) throw error;
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

    const { admin, profile } = await currentProfile(request);

    if (
      !profile ||
      !profile.organisation_id ||
      profile.access_enabled === false ||
      profile.can_access_crm === false
    ) {
      return NextResponse.json(
        { error: "CRM access denied." },
        { status: 403 }
      );
    }

    const canImport = Boolean(
      profile.is_practice_owner ||
        profile.can_manage_practice_users ||
        ["Client Manager", "Admin", "Super Admin"].includes(
          String(profile.role || "")
        )
    );

    if (!canImport) {
      return NextResponse.json(
        { error: "Practice manager access is required for CRM imports." },
        { status: 403 }
      );
    }

    const organisationId = String(profile.organisation_id);

    const { data: batch, error: batchError } = await admin
      .from("crm_import_batches")
      .select("id,batch_reference,source_system,import_mode,status")
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

    const approvedRows = await allApprovedRows(admin, organisationId, batchId);

    if (!approvedRows.length) {
      return NextResponse.json(
        { error: "There are no approved rows waiting to be imported." },
        { status: 400 }
      );
    }

    await admin
      .from("crm_import_batches")
      .update({
        status: "importing",
        started_at: new Date().toISOString(),
      })
      .eq("id", batchId)
      .eq("organisation_id", organisationId);

    const rowsBySheet = new Map<string, any[]>();

    for (const row of approvedRows) {
      const list = rowsBySheet.get(row.sheet_name) || [];
      list.push(row);
      rowsBySheet.set(row.sheet_name, list);
    }

    const clientIdByImportKey = new Map<string, string>();
    const personByImportKey = new Map<string, any>();

    for (const personRow of rowsBySheet.get("People") || []) {
      personByImportKey.set(
        text(personRow.raw_data?.["Person Import Key*"]),
        personRow
      );
    }

    let importedClients = 0;
    let updatedClients = 0;
    let contacts = 0;
    let directors = 0;
    let shareholders = 0;
    let addresses = 0;
    let registrationRows = 0;
    let documentLinks = 0;
    let skippedRows = 0;
    let failedRows = 0;

    // ------------------------------------------------------------------
    // 1. CLIENTS
    // ------------------------------------------------------------------
    for (const row of rowsBySheet.get("Clients") || []) {
      try {
        const raw = row.raw_data || {};
        const importKey = text(raw["Client Import Key*"]);
        const category = clientCategory(raw["Record Type*"]);
        const relationship = relationStatus(raw["Relationship Status*"]);
        const legalNumber = nullable(raw["Registration / ID / Trust Number"]);

        const clientRecord: Record<string, unknown> = {
          organisation_id: organisationId,
          client_name: text(raw["Client / Record Name*"]),
          client_code: nullable(raw["Existing Client Number"]),
          trading_name: nullable(raw["Trading Name"]),
          entity_type:
            nullable(raw["Legal / Entity Type"]) ||
            nullable(raw["Record Type*"]),
          client_category: category,
          relationship_status: relationship,
          status: relationship === "former_client" ? "Former" : "Active",
          year_end: nullable(raw["Financial Year End"]),
          tax_number: nullable(raw["Income Tax Number"]),
          vat_number: nullable(raw["VAT Number"]),
          paye_number: nullable(raw["PAYE Number"]),
          uif_registration_number: nullable(raw["UIF Number"]),
          wcc_reference_number: nullable(raw["COIDA Number"]),
          imported_source: `crm_master_import:${batch.batch_reference}`,
        };

        if (category === "individual") {
          clientRecord.id_passport_number = legalNumber;
          clientRecord.registration_number = null;
          clientRecord.trust_deed_number = null;
        } else if (category === "trust") {
          clientRecord.trust_deed_number = legalNumber;
          clientRecord.registration_number = legalNumber;
          clientRecord.id_passport_number = null;
        } else {
          clientRecord.registration_number = legalNumber;
          clientRecord.id_passport_number = null;
          clientRecord.trust_deed_number = null;
        }

        let clientId = text(row.matched_record_id);

        if (!clientId && importKey) {
          const { data: ledger } = await admin
            .from("crm_import_ledger")
            .select("pp_record_id")
            .eq("organisation_id", organisationId)
            .eq("record_type", "client")
            .eq("source_import_key", importKey)
            .maybeSingle();

          clientId = text(ledger?.pp_record_id);
        }

        if (clientId) {
          const updateData: Record<string, unknown> = {};

          for (const [key, value] of Object.entries(clientRecord)) {
            if (key === "organisation_id") continue;
            if (value !== null && value !== "") {
              updateData[key] = value;
            }
          }

          const { error } = await admin
            .from("crm_clients")
            .update(updateData)
            .eq("id", clientId)
            .eq("organisation_id", organisationId);

          if (error) throw error;

          updatedClients += 1;
        } else {
          const { data: created, error } = await admin
            .from("crm_clients")
            .insert(clientRecord)
            .select("id")
            .single();

          if (error || !created?.id) {
            throw error || new Error("Client could not be created.");
          }

          clientId = String(created.id);
          importedClients += 1;
        }

        clientIdByImportKey.set(importKey, clientId);

        await ledgerUpsert(
          admin,
          organisationId,
          batchId,
          batch.source_system,
          importKey,
          "client",
          clientId
        );

        await markRow(
          admin,
          row.id,
          "imported",
          clientId,
          clientId ? "Client imported successfully." : "Client processed."
        );
      } catch (error) {
        failedRows += 1;
        await markRow(
          admin,
          row.id,
          "failed",
          null,
          error instanceof Error ? error.message : "Client import failed."
        );
      }
    }

    // Resolve any clients already imported in prior run.
    const allClientKeys = Array.from(
      new Set(
        approvedRows
          .map((row) => text(row.raw_data?.["Client Import Key*"]))
          .filter(Boolean)
      )
    );

    if (allClientKeys.length) {
      const { data: ledgerRows } = await admin
        .from("crm_import_ledger")
        .select("source_import_key,pp_record_id")
        .eq("organisation_id", organisationId)
        .eq("record_type", "client")
        .in("source_import_key", allClientKeys);

      for (const ledger of ledgerRows || []) {
        clientIdByImportKey.set(
          text(ledger.source_import_key),
          text(ledger.pp_record_id)
        );
      }
    }

    // ------------------------------------------------------------------
    // 2. PEOPLE ROLES -> Contacts / Directors / Shareholders
    // ------------------------------------------------------------------
    for (const row of rowsBySheet.get("People Roles") || []) {
      try {
        const raw = row.raw_data || {};
        const clientKey = text(raw["Client Import Key*"]);
        const personKey = text(raw["Person Import Key*"]);
        const role = text(raw["Role*"]).toLowerCase();
        const clientId = clientIdByImportKey.get(clientKey);
        const personRow = personByImportKey.get(personKey);
        const person = personRow?.raw_data || {};

        if (!clientId || !personRow) {
          skippedRows += 1;
          await markRow(
            admin,
            row.id,
            "skipped",
            null,
            "Skipped because the linked client/person was not imported."
          );
          continue;
        }

        const name =
          text(person["Full Name"]) ||
          [text(person["First Name*"]), text(person["Surname*"])]
            .filter(Boolean)
            .join(" ");

        if (role === "contact") {
          const { data: created, error } = await admin
            .from("crm_client_contacts")
            .insert({
              organisation_id: organisationId,
              client_id: clientId,
              contact_name: name || null,
              contact_position: "Contact",
              email: nullable(person["Email"]),
              mobile: nullable(person["Mobile"]),
              phone: nullable(person["Mobile"]),
              is_primary:
                text(raw["Is Primary Contact?"]).toLowerCase() === "yes",
            })
            .select("id")
            .single();

          if (error) throw error;

          contacts += 1;
          await markRow(
            admin,
            row.id,
            "imported",
            String(created?.id || ""),
            "Contact imported."
          );
          continue;
        }

        if (role === "director") {
          const { data: created, error } = await admin
            .from("crm_client_directors")
            .insert({
              organisation_id: organisationId,
              client_id: clientId,
              director_name: name,
              id_passport_number: nullable(person["ID / Passport Number"]),
              email: nullable(person["Email"]),
              phone: nullable(person["Mobile"]),
              appointment_date: nullable(raw["Start Date"]),
              cessation_date: nullable(raw["End Date"]),
              is_active: text(raw["Active?"]).toLowerCase() !== "no",
            })
            .select("id")
            .single();

          if (error) throw error;

          directors += 1;
          await markRow(
            admin,
            row.id,
            "imported",
            String(created?.id || ""),
            "Director imported."
          );
          continue;
        }

        if (role === "shareholder") {
          const { data: created, error } = await admin
            .from("secretarial_shareholders")
            .insert({
              organisation_id: organisationId,
              client_id: clientId,
              full_legal_name: name,
              id_registration_number: nullable(person["ID / Passport Number"]),
              holder_type: "individual",
              email: nullable(person["Email"]),
              phone: nullable(person["Mobile"]),
              is_active: text(raw["Active?"]).toLowerCase() !== "no",
            })
            .select("id")
            .single();

          if (error) throw error;

          shareholders += 1;
          await markRow(
            admin,
            row.id,
            "imported",
            String(created?.id || ""),
            "Shareholder imported."
          );
          continue;
        }

        skippedRows += 1;
        await markRow(
          admin,
          row.id,
          "skipped",
          null,
          `Role "${text(raw["Role*"])}" has no final PP import destination yet.`
        );
      } catch (error) {
        failedRows += 1;
        await markRow(
          admin,
          row.id,
          "failed",
          null,
          error instanceof Error ? error.message : "People role import failed."
        );
      }
    }

    // People master rows are source rows; mark as imported once referenced.
    for (const row of rowsBySheet.get("People") || []) {
      try {
        await markRow(
          admin,
          row.id,
          "imported",
          null,
          "Person source row processed through People Roles."
        );
      } catch {
        failedRows += 1;
      }
    }

    // ------------------------------------------------------------------
    // 3. ADDRESSES
    // ------------------------------------------------------------------
    for (const row of rowsBySheet.get("Addresses") || []) {
      try {
        const raw = row.raw_data || {};
        const clientId = clientIdByImportKey.get(
          text(raw["Client Import Key*"])
        );

        if (!clientId) {
          skippedRows += 1;
          await markRow(
            admin,
            row.id,
            "skipped",
            null,
            "Linked client was not imported."
          );
          continue;
        }

        const { data: created, error } = await admin
          .from("crm_client_addresses")
          .insert({
            organisation_id: organisationId,
            client_id: clientId,
            address_type: text(raw["Address Type*"]) || "Physical",
            line_1: nullable(raw["Line 1"]),
            line_2: nullable(raw["Line 2"]),
            city: nullable(raw["City"]),
            province: nullable(raw["Province / State"]),
            postal_code: nullable(raw["Postal Code"]),
            country: nullable(raw["Country"]),
          })
          .select("id")
          .single();

        if (error) throw error;

        addresses += 1;
        await markRow(
          admin,
          row.id,
          "imported",
          String(created?.id || ""),
          "Address imported."
        );
      } catch (error) {
        failedRows += 1;
        await markRow(
          admin,
          row.id,
          "failed",
          null,
          error instanceof Error ? error.message : "Address import failed."
        );
      }
    }

    // ------------------------------------------------------------------
    // 4. REGISTRATIONS
    //    Main tax registrations are already written from the Clients sheet.
    //    Customs is updated here if supplied.
    // ------------------------------------------------------------------
    for (const row of rowsBySheet.get("Registrations") || []) {
      try {
        const raw = row.raw_data || {};
        const clientId = clientIdByImportKey.get(
          text(raw["Client Import Key*"])
        );

        if (!clientId) {
          skippedRows += 1;
          await markRow(
            admin,
            row.id,
            "skipped",
            null,
            "Linked client was not imported."
          );
          continue;
        }

        const registrationType = text(raw["Registration Type*"]).toLowerCase();
        const registrationNumber = nullable(raw["Registration Number"]);

        if (registrationType === "customs" && registrationNumber) {
          const { error } = await admin
            .from("crm_clients")
            .update({ customs_number: registrationNumber })
            .eq("id", clientId)
            .eq("organisation_id", organisationId);

          if (error) throw error;
        }

        registrationRows += 1;
        await markRow(
          admin,
          row.id,
          "imported",
          clientId,
          "Registration captured on the client master."
        );
      } catch (error) {
        failedRows += 1;
        await markRow(
          admin,
          row.id,
          "failed",
          null,
          error instanceof Error ? error.message : "Registration import failed."
        );
      }
    }

    // ------------------------------------------------------------------
    // 5. DOCUMENT LINKS -> CRM client notes
    // ------------------------------------------------------------------
    for (const row of rowsBySheet.get("Document Links") || []) {
      try {
        const raw = row.raw_data || {};
        const clientId = clientIdByImportKey.get(
          text(raw["Client Import Key*"])
        );

        if (!clientId) {
          skippedRows += 1;
          await markRow(
            admin,
            row.id,
            "skipped",
            null,
            "Linked client was not imported."
          );
          continue;
        }

        const label = text(raw["Label"]) || text(raw["Provider*"]) || "Document link";
        const url = text(raw["Link / URL*"]);

        const { data: created, error } = await admin
          .from("crm_client_notes")
          .insert({
            organisation_id: organisationId,
            client_id: clientId,
            note_type: "document_link",
            note_title: label,
            note_body: url,
            created_by_user_id: profile.user_id,
          })
          .select("id")
          .single();

        if (error) throw error;

        documentLinks += 1;
        await markRow(
          admin,
          row.id,
          "imported",
          String(created?.id || ""),
          "Document link stored as a CRM client note."
        );
      } catch (error) {
        failedRows += 1;
        await markRow(
          admin,
          row.id,
          "failed",
          null,
          error instanceof Error ? error.message : "Document link import failed."
        );
      }
    }

    // ------------------------------------------------------------------
    // 6. GROUPS
    // Current PP group schema is not part of the client master tables above.
    // Keep these rows staged rather than guessing table/column names.
    // ------------------------------------------------------------------
    for (const sheetName of ["Client Groups", "Group Members"]) {
      for (const row of rowsBySheet.get(sheetName) || []) {
        skippedRows += 1;
        await markRow(
          admin,
          row.id,
          "skipped",
          null,
          "Group row preserved in the import batch; group table wiring is separate from the client master import."
        );
      }
    }

    const completedAt = new Date().toISOString();

    const { count: stillNotImported } = await admin
      .from("crm_import_rows")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId)
      .eq("batch_id", batchId)
      .eq("approved_for_import", true)
      .eq("import_status", "not_imported");

    const { count: failedCount } = await admin
      .from("crm_import_rows")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId)
      .eq("batch_id", batchId)
      .eq("import_status", "failed");

    const finalStatus =
      Number(failedCount || 0) > 0
        ? "completed_with_errors"
        : "completed";

    await admin
      .from("crm_import_batches")
      .update({
        status: finalStatus,
        completed_at: completedAt,
      })
      .eq("id", batchId)
      .eq("organisation_id", organisationId);

    await admin.from("crm_import_events").insert({
      organisation_id: organisationId,
      batch_id: batchId,
      event_type: "approved_rows_imported",
      message: `Approved CRM rows imported. ${importedClients} client(s) created, ${updatedClients} updated.`,
      details: {
        imported_clients: importedClients,
        updated_clients: updatedClients,
        contacts,
        directors,
        shareholders,
        addresses,
        registration_rows: registrationRows,
        document_links: documentLinks,
        skipped_rows: skippedRows,
        failed_rows: failedRows,
        approved_rows_still_waiting: stillNotImported || 0,
      },
      created_by_user_id: profile.user_id,
    });

    return NextResponse.json({
      success: true,
      result: {
        importedClients,
        updatedClients,
        contacts,
        directors,
        shareholders,
        addresses,
        registrationRows,
        documentLinks,
        skippedRows,
        failedRows,
      },
    });
  } catch (error) {
    console.error("CRM IMPORT APPROVED ROWS ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not import the approved CRM rows.",
      },
      { status: 500 }
    );
  }
}
