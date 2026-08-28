import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function safeFilename(value: unknown) {
  return (
    clean(value)
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
      .replace(/\s+/g, " ")
      .trim() || "Client"
  );
}

function formatAddress(address: any) {
  if (!address) return "";
  return [
    address.line_1,
    address.line_2,
    address.city,
    address.province,
    address.postal_code,
  ]
    .map(clean)
    .filter(Boolean)
    .join(", ");
}

function dateDigits(value: string | null | undefined) {
  if (!value) return "";
  const [yyyy, mm, dd] = value.split("-");
  if (!yyyy || !mm || !dd) return "";
  return `${dd}${mm}${yyyy.slice(-2)}`;
}

function monthLabel(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 7)}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-ZA", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function splitMoney(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return { rand: "", cents: "" };

  const fixed = amount.toFixed(2);
  const [rand, cents] = fixed.split(".");
  return { rand, cents };
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();

    const [
      clientResult,
      contactsResult,
      addressesResult,
      uifResult,
      employeesResult,
    ] = await Promise.all([
      supabase.from("crm_clients").select("*").eq("id", id).maybeSingle(),

      supabase
        .from("crm_client_contacts")
        .select(
          "id, contact_name, contact_position, email, mobile, phone, is_primary"
        )
        .eq("client_id", id)
        .order("is_primary", { ascending: false }),

      supabase
        .from("crm_client_addresses")
        .select(
          "id, address_type, line_1, line_2, city, province, postal_code, country"
        )
        .eq("client_id", id)
        .order("address_type"),

      supabase
        .from("crm_uif_registrations")
        .select("ui19_declaration_month")
        .eq("client_id", id)
        .maybeSingle(),

      supabase
        .from("crm_uif_employees")
        .select(
          "id, surname, initials, id_passport_number, gross_monthly_remuneration, total_hours_worked, commencement_date, termination_date, termination_reason_code, is_contributor, non_contributor_reason_code, is_active"
        )
        .eq("client_id", id)
        .order("surname"),
    ]);

    if (clientResult.error) throw clientResult.error;
    if (!clientResult.data) {
      return NextResponse.json(
        { success: false, error: "Client not found." },
        { status: 404 }
      );
    }

    if (contactsResult.error) throw contactsResult.error;
    if (addressesResult.error) throw addressesResult.error;
    if (uifResult.error) throw uifResult.error;
    if (employeesResult.error) throw employeesResult.error;

    const client = clientResult.data;
    const contacts = contactsResult.data || [];
    const addresses = addressesResult.data || [];
    const employees = (employeesResult.data || []).filter(
      (employee: any) => employee.is_active !== false
    );
    const uif = uifResult.data;

    if (!employees.length) {
      return NextResponse.json(
        { success: false, error: "Add at least one UI-19 employee first." },
        { status: 400 }
      );
    }

    const primaryContact =
      contacts.find((contact: any) => contact.is_primary) ||
      contacts[0] ||
      null;

    const physicalAddress =
      addresses.find((address: any) =>
        ["physical", "street", "business", "registered"].includes(
          clean(address.address_type).toLowerCase()
        )
      ) ||
      addresses[0] ||
      null;

    const postalAddress =
      addresses.find((address: any) =>
        ["postal", "post"].includes(clean(address.address_type).toLowerCase())
      ) || null;

    // IMPORTANT:
    // This template is visually identical to the official UI-19,
    // but its internal page rotation metadata has been normalised once.
    // The original official UI-19.pdf remains untouched.
    const templatePath = path.join(
      process.cwd(),
      "public",
      "forms",
      "UI-19-upright.pdf"
    );

    const templateBytes = await readFile(templatePath);
    const templateDoc = await PDFDocument.load(templateBytes);

    const output = await PDFDocument.create();
    const font = await output.embedFont(StandardFonts.Helvetica);
    const ink = rgb(0, 0, 0);

    // Official UI-19 has seven employee rows.
    const batches: any[][] = [];
    for (let i = 0; i < employees.length; i += 7) {
      batches.push(employees.slice(i, i + 7));
    }

    for (const batch of batches) {
      const [page] = await output.copyPages(templateDoc, [0]);
      output.addPage(page);

      const pageHeight = page.getHeight();

      // Normal upright PDF coordinates. No rotation. No transformed text.
      const draw = (
        value: unknown,
        x: number,
        yTop: number,
        size = 8.5,
        maxWidth?: number
      ) => {
        const valueText = clean(value);
        if (!valueText) return;

        let outputText = valueText;

        if (maxWidth) {
          while (
            outputText.length > 1 &&
            font.widthOfTextAtSize(outputText, size) > maxWidth
          ) {
            outputText = outputText.slice(0, -1);
          }
        }

        page.drawText(outputText, {
          x,
          y: pageHeight - yTop,
          size,
          font,
          color: ink,
        });
      };

      const drawChars = (
        value: unknown,
        startX: number,
        yTop: number,
        cellWidth: number,
        maxChars: number,
        size = 8.0
      ) => {
        const chars = clean(value).replace(/\s+/g, "").slice(0, maxChars);

        [...chars].forEach((character, index) => {
          const charWidth = font.widthOfTextAtSize(character, size);
          draw(
            character,
            startX + index * cellWidth + (cellWidth - charWidth) / 2,
            yTop,
            size
          );
        });
      };

      // HEADER
      draw(monthLabel(uif?.ui19_declaration_month), 535, 35, 8.8, 145);

      // 1.1 UIF Employer Reference No / Branch No
      const uifReference = clean(client.uif_registration_number);
      if (uifReference) {
        const compact = uifReference.replace(/\D/g, "");
        drawChars(compact.slice(0, 7), 198, 128, 11.8, 7, 8.0);

        if (compact.length > 7) {
          drawChars(compact.slice(7, 8), 303, 128, 18, 1, 8.0);
        }

        if (compact.length > 8) {
          drawChars(compact.slice(8, 14), 366, 128, 11.8, 6, 8.0);
        }
      }

      // 1.2 PAYE
      // Calibrated to the actual visible PAYE box centres.
      drawChars(
        clean(client.paye_number).replace(/\D/g, ""),
        653.1,
        128,
        15.55,
        10,
        7.8
      );

      // 1.3 / 1.4
      draw(client.trading_name || client.client_name, 198, 144, 8.3, 220);
      draw(formatAddress(physicalAddress), 550, 144, 7.7, 245);

      // 1.5 intentionally blank unless work address differs from 1.4.

      // 1.6 Postal address
      draw(formatAddress(postalAddress), 550, 158, 7.7, 245);

      // 1.7 Company registration number
      drawChars(
        clean(client.registration_number || client.id_passport_number),
        575.5,
        172,
        14.2,
        16,
        7.8
      );

      // 1.8 / 1.10 / 1.11
      draw(primaryContact?.email, 154, 188, 7.9, 105);
      draw(primaryContact?.phone || primaryContact?.mobile, 514, 188, 7.9, 105);
      // Leave authorised person blank for manual completion.

      // EMPLOYEE TABLE
      const rowBaselines = [303, 318, 332, 346, 360, 375, 389];

      batch.forEach((employee: any, rowIndex: number) => {
        const y = rowBaselines[rowIndex];
        if (y == null) return;

        const money = splitMoney(employee.gross_monthly_remuneration);

        // A - Surname
        draw(employee.surname, 45, y, 7.9, 77);

        // B - Initials
        draw(employee.initials, 132, y, 7.9, 25);

        // C - ID
        drawChars(employee.id_passport_number, 163, y, 14.05, 13, 7.7);

        // D - Gross remuneration
        draw(money.rand, 350, y, 7.7, 38);
        draw(money.cents, 397, y, 7.7, 18);

        // E - Hours
        draw(employee.total_hours_worked, 425, y, 7.7, 28);

        // F - Commencement DDMMYY
        drawChars(dateDigits(employee.commencement_date), 460, y, 16.55, 6, 7.3);

        // G - Termination DDMMYY
        drawChars(dateDigits(employee.termination_date), 560, y, 16.05, 6, 7.3);

        // H - Termination reason
        draw(employee.termination_reason_code, 669, y, 7.7, 25);

        // I - Contributor
        draw(employee.is_contributor === false ? "NO" : "YES", 712, y, 7.5, 32);

        // J - Non-contributor reason
        draw(
          employee.is_contributor === false
            ? employee.non_contributor_reason_code
            : "",
          765,
          y,
          7.7,
          25
        );
      });

      // DECLARATION
      // Leave employer name, ID number, signature and date blank for manual completion/signature.
    }

    const pdfBytes = await output.save();
    const filename = `${safeFilename(client.client_name)} - UIF UI-19.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("GENERATE UI-19 ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.code === "ENOENT"
            ? "UI-19 upright template not found at public/forms/UI-19-upright.pdf."
            : error?.message || "Unable to generate UI-19.",
      },
      { status: 500 }
    );
  }
}
