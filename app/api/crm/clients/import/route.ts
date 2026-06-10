import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseSecretKey) {
  throw new Error("Missing SUPABASE_SECRET_KEY");
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

function cleanText(value: any) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function cleanBoolean(value: any) {
  const text = String(value || "").trim().toLowerCase();

  return (
    text === "yes" ||
    text === "true" ||
    text === "1" ||
    text === "y" ||
    text === "registered"
  );
}

function cleanDate(value: any) {
  if (!value) return null;

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();

  if (!text) return null;

  const parsedDate = new Date(text);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString().slice(0, 10);
}

function getValue(row: Record<string, any>, possibleNames: string[]) {
  for (const name of possibleNames) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== "") {
      return row[name];
    }
  }

  return null;
}

export async function POST(req: Request) {
  const formData = await req.formData();

  const file = formData.get("file") as File | null;
  const organisationId = String(formData.get("organisationId") || "").trim();

  if (!file) {
    return NextResponse.json({ error: "Import file is required." }, { status: 400 });
  }

  if (!organisationId) {
    return NextResponse.json({ error: "Organisation ID is required." }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    defval: "",
  });

  let importedCount = 0;
  let skippedCount = 0;
  let firstError = "";

  for (const row of rows) {
    const clientName = cleanText(
      getValue(row, ["Client Name", "Client", "Name", "Company Name"])
    );

    if (!clientName) {
      skippedCount += 1;
      continue;
    }

    const { data: client, error: clientError } = await supabase
      .from("crm_clients")
      .insert({
        organisation_id: organisationId,

        client_name: clientName,
        status: cleanText(getValue(row, ["Status"])),
        entity_type: cleanText(getValue(row, ["Entity Type", "Type"])),
        year_end: cleanText(getValue(row, ["Year End", "Financial Year End"])),

        id_passport_number: cleanText(getValue(row, ["ID/Passport Number", "ID Number", "Passport Number"])),
        date_of_birth: cleanDate(getValue(row, ["Date of Birth", "DOB"])),

        trust_deed_number: cleanText(getValue(row, ["Trust Deed Number", "Trust Number"])),
        registration_number: cleanText(getValue(row, ["Registration Number", "Reg Number", "Company Registration Number"])),
        registration_date: cleanDate(getValue(row, ["Registration Date", "Reg Date"])),

        client_code: cleanText(getValue(row, ["Client Code", "Code"])),
        trading_name: cleanText(getValue(row, ["Trading Name", "Trade Name"])),

        customs_number: cleanText(getValue(row, ["Customs Nr", "Customs Number"])),
        paye_number: cleanText(getValue(row, ["PAYE Nr", "PAYE Number"])),
        tax_number: cleanText(getValue(row, ["Tax Nr", "Tax Number", "Income Tax Number"])),
        uif_registration_number: cleanText(getValue(row, ["UIF Reg", "UIF Number", "UIF Registration Number"])),
        sdl_registered: cleanBoolean(getValue(row, ["SDL Registered", "SDL"])),
        vat_number: cleanText(getValue(row, ["VAT Nr", "VAT Number"])),
        wcc_reference_number: cleanText(getValue(row, ["WCC Ref Nr", "WCC Reference Number"])),

        monthly_fee: Number(getValue(row, ["Monthly Fee", "Fee", "Monthly Billing"]) || 0) || null,
        annual_fee: Number(getValue(row, ["Annual Fee", "Annual Billing"]) || 0) || null,
        billing_frequency: cleanText(getValue(row, ["Billing Frequency", "Frequency"])),

        imported_source: file.name,
      })
      .select("id")
      .single();

    if (clientError || !client) {
      skippedCount += 1;

      if (!firstError) {
        firstError = clientError?.message || "Unknown client import error.";
      }

      continue;
    }

    const primaryContactName = cleanText(
      getValue(row, ["Primary Contact", "Contact Person", "Contact Name"])
    );

    const primaryEmail = cleanText(
      getValue(row, ["Email", "Email Address", "Primary Email"])
    );

    const primaryPhone = cleanText(
      getValue(row, ["Phone", "Telephone", "Mobile", "Cell"])
    );

    if (primaryContactName || primaryEmail || primaryPhone) {
      await supabase.from("crm_client_contacts").insert({
        organisation_id: organisationId,
        client_id: client.id,
        contact_name: primaryContactName,
        email: primaryEmail,
        phone: primaryPhone,
        is_primary: true,
      });
    }

    const physicalAddress = cleanText(
      getValue(row, ["Physical Address", "Business Address", "Street Address"])
    );

    if (physicalAddress) {
      await supabase.from("crm_client_addresses").insert({
        organisation_id: organisationId,
        client_id: client.id,
        address_type: "Physical",
        line_1: physicalAddress,
      });
    }

    const postalAddress = cleanText(
      getValue(row, ["Postal Address", "Mailing Address"])
    );

    if (postalAddress) {
      await supabase.from("crm_client_addresses").insert({
        organisation_id: organisationId,
        client_id: client.id,
        address_type: "Postal",
        line_1: postalAddress,
      });
    }

    importedCount += 1;
  }

  return NextResponse.json({
    importedCount,
    skippedCount,
    firstError,
  });
}