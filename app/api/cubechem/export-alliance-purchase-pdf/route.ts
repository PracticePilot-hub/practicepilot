import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";
import path from "path";
import {
  checkCubeChemAccess,
  getRequestEmail,
} from "../lib/checkCubeChemAccess";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function toMonthDate(value: string) {
  return `${value}-01`;
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  });
}

function getLogoBase64() {
  const logoPath = path.join(process.cwd(), "public", "brand", "CCD.png");

  if (!fs.existsSync(logoPath)) {
    return null;
  }

  const file = fs.readFileSync(logoPath);
  return `data:image/png;base64,${file.toString("base64")}`;
}

function cleanDescription(value: string) {
  return String(value || "")
    .replace(
      /\s*\|\s*R[\d,]+(\.\d{2})?\s*-\s*SAVING\s*-\s*R\s*[\d,]+(\.\d{2})?/gi,
      ""
    )
    .replace(/\s*\*{2,3}\s*SAVE\s*R\s*[0-9,]+(\.[0-9]{2})?/gi, "")
    .trim();
}

function safeFilePart(value: string) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function addPageHeader(
  doc: jsPDF,
  partner: any,
  monthLabel: string,
  logoBase64: string | null
) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 64, "F");

  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", 12, 9, 58, 31);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(0, 145, 72);
  doc.text("CUBE CHEM DISTRIBUTION", 196, 16, {
    align: "right",
  });

  doc.setFontSize(11);
  doc.text("ALLIANCE PARTNER PURCHASE PRICE LIST", 196, 25, {
    align: "right",
  });

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(String(partner.name || "").toUpperCase(), 196, 34, {
    align: "right",
  });

  if (partner.telephone) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Telephone: ${partner.telephone}`, 196, 41, {
      align: "right",
    });
  }

  doc.setDrawColor(0, 145, 72);
  doc.setLineWidth(0.8);
  doc.line(10, 52, 200, 52);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`PURCHASE PRICES: ${monthLabel.toUpperCase()}`, 196, 60, {
    align: "right",
  });
}

function addFooter(doc: jsPDF, pageNumber: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);

  doc.text(
    "Prices are confidential and intended only for the selected Alliance Partner.",
    14,
    287
  );

  doc.text(`Page ${pageNumber}`, 196, 287, {
    align: "right",
  });
}

export async function POST(req: NextRequest) {
  try {
    const requestEmail = getRequestEmail(req);
    const access = await checkCubeChemAccess(requestEmail);

    if (!access.allowed) {
      return NextResponse.json(
        { error: "You do not have access to CubeChem." },
        { status: 403 }
      );
    }

    const body = await req.json();

    const exportMonth = String(body.exportMonth || "").trim();
    const partnerId = String(body.partnerId || "").trim();

    if (!exportMonth) {
      return NextResponse.json(
        { error: "Export month is required." },
        { status: 400 }
      );
    }

    if (!partnerId) {
      return NextResponse.json(
        { error: "Alliance Partner is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const monthDate = toMonthDate(exportMonth);
    const monthLabel = formatMonthLabel(exportMonth);
    const logoBase64 = getLogoBase64();

    const partnerResult = await supabase
      .from("cubechem_sales_partners")
      .select(
        "id, partner_type, name, telephone, purchase_markup_percent, is_active"
      )
      .eq("id", partnerId)
      .eq("partner_type", "ALLIANCE_PARTNER")
      .maybeSingle();

    if (partnerResult.error) {
      throw partnerResult.error;
    }

    if (!partnerResult.data) {
      return NextResponse.json(
        { error: "Alliance Partner could not be found." },
        { status: 404 }
      );
    }

    if (!partnerResult.data.is_active) {
      return NextResponse.json(
        { error: "The selected Alliance Partner is inactive." },
        { status: 400 }
      );
    }

    const partner = partnerResult.data;
    const markupPercent = Number(partner.purchase_markup_percent ?? 20);

    const selectedProductsResult = await supabase
      .from("cubechem_partner_products")
      .select("item_code")
      .eq("partner_id", partnerId);

    if (selectedProductsResult.error) {
      throw selectedProductsResult.error;
    }

    const selectedCodes = Array.from(
      new Set(
        (selectedProductsResult.data || [])
          .map((row) => String(row.item_code || "").trim().toUpperCase())
          .filter(Boolean)
      )
    );

    if (selectedCodes.length === 0) {
      return NextResponse.json(
        {
          error:
            "No products have been selected for this Alliance Partner yet.",
        },
        { status: 400 }
      );
    }

   const uploadResult = await supabase
  .from("cubechem_price_uploads")
  .select("id, price_month, file_name, created_at")
  .eq("price_month", monthDate)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

    if (uploadResult.error) {
      throw uploadResult.error;
    }

    if (!uploadResult.data) {
      return NextResponse.json(
        {
          error: `No Abyx price list has been uploaded for ${monthLabel}.`,
        },
        { status: 404 }
      );
    }

    const itemsResult = await supabase
      .from("cubechem_price_items")
      .select("item_code, description, supplier_ex_vat")
      .eq("upload_id", uploadResult.data.id)
      .in("item_code", selectedCodes);

    if (itemsResult.error) {
      throw itemsResult.error;
    }

    const rows = (itemsResult.data || [])
      .filter(
        (row) =>
          row.item_code &&
          row.description &&
          row.supplier_ex_vat !== null &&
          Number(row.supplier_ex_vat) > 0
      )
      .map((row) => {
        const supplierPrice = Number(row.supplier_ex_vat);
        const supplierPriceInclVat = supplierPrice * 1.15;

const calculatedPrice =
  supplierPriceInclVat * (1 + Number(markupPercent) / 100);

        const roundedPrice = Math.round(calculatedPrice);

        return {
          itemCode: String(row.item_code).trim().toUpperCase(),
          description: cleanDescription(String(row.description)),
          supplierPrice,
          roundedPrice,
        };
      })
      .sort((a, b) => a.description.localeCompare(b.description));

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "None of the selected Alliance Partner products were found in the selected Abyx month.",
        },
        { status: 400 }
      );
    }

    const foundCodes = new Set(rows.map((row) => row.itemCode));

    const missingCodes = selectedCodes.filter(
      (itemCode) => !foundCodes.has(itemCode)
    );

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    addPageHeader(doc, partner, monthLabel, logoBase64);

    autoTable(doc, {
      startY: 70,
      head: [["Code", "Description", "Purchase Price"]],
      body: rows.map((row) => [
        row.itemCode,
        row.description,
        `R ${row.roundedPrice.toFixed(0)}`,
      ]),
      theme: "grid",
      margin: {
        top: 70,
        bottom: 18,
        left: 14,
        right: 14,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineColor: [148, 163, 184],
        lineWidth: 0.12,
        valign: "middle",
      },
      headStyles: {
        fillColor: [240, 253, 244],
        textColor: [15, 23, 42],
        fontStyle: "bold",
        lineColor: [0, 145, 72],
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      columnStyles: {
        0: {
          cellWidth: 28,
          fontStyle: "bold",
        },
        1: {
          cellWidth: 120,
        },
        2: {
          cellWidth: 32,
          halign: "right",
          fontStyle: "bold",
        },
      },
      didDrawPage: () => {
        addPageHeader(doc, partner, monthLabel, logoBase64);
      },
    });

    if (missingCodes.length > 0) {
      const finalY = (doc as any).lastAutoTable.finalY || 70;

      let noteY = finalY + 8;

      if (noteY > 265) {
        doc.addPage();
        addPageHeader(doc, partner, monthLabel, logoBase64);
        noteY = 76;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(153, 27, 27);
      doc.text("Selected products not found in this month:", 14, noteY);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);

      const missingText = doc.splitTextToSize(missingCodes.join(", "), 180);
      doc.text(missingText, 14, noteY + 5);
    }

    const pageCount = doc.getNumberOfPages();

    for (let page = 1; page <= pageCount; page++) {
      doc.setPage(page);
      addFooter(doc, page);
    }

    const pdfArrayBuffer = doc.output("arraybuffer");
    const buffer = Buffer.from(pdfArrayBuffer);

    const fileName = `CCD_ALLIANCE_PURCHASE_PRICES_${safeFilePart(
      partner.name
    )}_${safeFilePart(monthLabel)}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("CubeChem Alliance Partner purchase PDF error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not export Alliance Partner purchase price list.",
      },
      { status: 500 }
    );
  }
}