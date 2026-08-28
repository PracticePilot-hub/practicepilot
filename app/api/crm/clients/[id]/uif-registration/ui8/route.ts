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

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatAddress(address: any) {
  if (!address) return "";
  return [
    address.line_1,
    address.line_2,
    address.city,
    address.province,
  ]
    .map(clean)
    .filter(Boolean)
    .join(", ");
}

function formatDirectorAddress(director: any, type: "physical" | "postal") {
  const prefix = type === "physical" ? "physical_address_" : "postal_address_";

  return [
    director?.[`${prefix}line_1`],
    director?.[`${prefix}line_2`],
    director?.[`${prefix}city`],
    director?.[`${prefix}province`],
  ]
    .map(clean)
    .filter(Boolean)
    .join(", ");
}

function entityOwnershipCode(entityType: unknown) {
  const value = clean(entityType).toLowerCase();

  if (value.includes("sole") || value.includes("individual")) return "1";
  if (value.includes("partnership")) return "2";
  if (
    value.includes("pty") ||
    value.includes("company") ||
    value.includes("private") ||
    value.includes("public company")
  ) {
    return "3";
  }
  if (value.includes("close corporation") || value === "cc") return "4";
  if (value.includes("trust")) return "5";
  return "6";
}

function initialsAndSurname(fullName: unknown) {
  const parts = clean(fullName).split(/\s+/).filter(Boolean);
  if (!parts.length) return "";

  const surname = parts[parts.length - 1];
  const initials = parts
    .slice(0, -1)
    .map((part) => part[0]?.toUpperCase())
    .filter(Boolean)
    .join("");

  return initials ? `${surname} ${initials}` : surname;
}

function safeFilename(value: unknown) {
  const result = clean(value)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return result || "Client";
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
      directorsResult,
      statutoryResult,
      uifResult,
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
        .from("crm_client_directors")
        .select(
          "id, director_name, id_passport_number, email, phone, appointment_date, cessation_date, is_active, physical_address_line_1, physical_address_line_2, physical_address_city, physical_address_province, physical_address_postal_code, physical_address_country, postal_address_line_1, postal_address_line_2, postal_address_city, postal_address_province, postal_address_postal_code, postal_address_country"
        )
        .eq("client_id", id)
        .eq("is_active", true)
        .order("director_name"),

      supabase
        .from("crm_client_statutory_profiles")
        .select("nature_of_business, magisterial_district, municipality")
        .eq("client_id", id)
        .maybeSingle(),

      supabase
        .from("crm_uif_registrations")
        .select(
          "registration_status, first_contributor_date, number_of_contributors, language_preference, employee_information_method"
        )
        .eq("client_id", id)
        .maybeSingle(),
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
    if (directorsResult.error) throw directorsResult.error;
    if (statutoryResult.error) throw statutoryResult.error;
    if (uifResult.error) throw uifResult.error;

    const client = clientResult.data;
    const contacts = contactsResult.data || [];
    const addresses = addressesResult.data || [];
    const directors = directorsResult.data || [];
    const statutory = statutoryResult.data;
    const uif = uifResult.data;

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

    const templatePath = path.join(
      process.cwd(),
      "public",
      "forms",
      "UI-8_application-for-registration-as-an-employer.pdf"
    );

    const templateBytes = await readFile(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const page = pdfDoc.getPages()[0];

    if (!page) {
      throw new Error("The UI-8 PDF template does not contain a page.");
    }

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const ink = rgb(0, 0, 0);

    const draw = (
      value: unknown,
      x: number,
      y: number,
      options?: { size?: number; maxWidth?: number; bold?: boolean }
    ) => {
      const valueText = clean(value);
      if (!valueText) return;

      const size = options?.size ?? 9.5;
      const selectedFont = font;

      let output = valueText;
      if (options?.maxWidth) {
        while (
          output.length > 1 &&
          selectedFont.widthOfTextAtSize(output, size) > options.maxWidth
        ) {
          output = output.slice(0, -1);
        }

        if (output !== valueText && output.length > 3) {
          output = `${output.slice(0, -3)}...`;
        }
      }

      page.drawText(output, {
        x,
        y,
        size,
        font: selectedFont,
        color: ink,
      });
    };

    // UI-8 field positions. PDF page is 595 x 842 pt.
    draw(formatDate(uif?.first_contributor_date), 458, 649, {
      size: 9.5,
      maxWidth: 90,
    });

    draw(uif?.number_of_contributors, 458, 631, {
      size: 9.5,
      maxWidth: 90,
    });

    draw(client.trading_name || client.client_name, 267, 613, {
      size: 9.5,
      maxWidth: 260,
    });

    draw(entityOwnershipCode(client.entity_type), 156, 594, {
      size: 8,
    });

    draw(statutory?.nature_of_business, 163, 576, {
      size: 9.5,
      maxWidth: 365,
    });

    draw(client.client_name, 263, 557, {
      size: 9.1,
      maxWidth: 150,
    });
    draw(client.registration_number || client.id_passport_number, 437, 557, {
      size: 9.1,
      maxWidth: 105,
    });

    draw(client.paye_number, 338, 539, {
      size: 9.3,
      maxWidth: 200,
    });

    draw(statutory?.magisterial_district, 227, 521, {
      size: 9.3,
      maxWidth: 190,
    });
    draw(statutory?.municipality, 60, 510, {
      size: 9.3,
      maxWidth: 205,
    });

    draw(primaryContact?.mobile || primaryContact?.phone, 330, 503, {
      size: 9.3,
      maxWidth: 135,
    });

    draw(primaryContact?.email, 205, 484, {
      size: 9.3,
      maxWidth: 255,
    });

    draw(
      clean(uif?.language_preference).toLowerCase() === "afrikaans" ? "2" : "1",
      186,
      466,
      { size: 8, bold: true }
    );

    draw(formatAddress(postalAddress), 157, 447, {
      size: 8.8,
      maxWidth: 235,
    });
    draw(postalAddress?.postal_code, 442, 447, {
      size: 9.1,
      maxWidth: 55,
    });

    draw(formatAddress(physicalAddress), 155, 429, {
      size: 8.8,
      maxWidth: 235,
    });
    draw(physicalAddress?.postal_code, 443, 429, {
      size: 9.1,
      maxWidth: 55,
    });

    const directorRows = [
      { nameY: 390, postalY: 374, residentialY: 355 },
      { nameY: 334, postalY: 318, residentialY: 299 },
      { nameY: 278, postalY: 262, residentialY: 243 },
    ];

    const drawIdInBoxes = (value: unknown, y: number) => {
      const id = clean(value).replace(/\s+/g, "").slice(0, 13);
      if (!id) return;

      // UI-8 has 13 boxes starting at approx x=324.
      const startX = 326;
      const boxWidth = 18.2;

      [...id].forEach((char, index) => {
        draw(char, startX + index * boxWidth + 5.2, y, {
          size: 9.2,
        });
      });
    };

    directors.slice(0, 3).forEach((director: any, index: number) => {
      const row = directorRows[index];
      if (!row) return;

      draw(initialsAndSurname(director.director_name), 145, row.nameY, {
        size: 9.4,
        maxWidth: 140,
      });

      drawIdInBoxes(director.id_passport_number, row.nameY);

      draw(formatDirectorAddress(director, "postal"), 128, row.postalY, {
        size: 8.8,
        maxWidth: 264,
      });
      draw(director.postal_address_postal_code, 448, row.postalY, {
        size: 8.6,
        maxWidth: 55,
      });

      draw(formatDirectorAddress(director, "physical"), 148, row.residentialY, {
        size: 8.8,
        maxWidth: 242,
      });
      draw(director.physical_address_postal_code, 448, row.residentialY, {
        size: 8.6,
        maxWidth: 55,
      });
    });

    if (uif?.employee_information_method === "electronic") {
      draw(
        "EMPLOYEE INFORMATION WILL BE SUBMITTED ELECTRONICALLY",
        175,
        183,
        {
          size: 9.3,
              maxWidth: 330,
        }
      );
    }

    const pdfBytes = await pdfDoc.save();
    const filename = `${safeFilename(client.client_name)} - UIF Employer Registration UI-8.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("GENERATE UI-8 ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.code === "ENOENT"
            ? "UI-8 template not found in public/forms."
            : error?.message || "Unable to generate UI-8.",
      },
      { status: 500 }
    );
  }
}