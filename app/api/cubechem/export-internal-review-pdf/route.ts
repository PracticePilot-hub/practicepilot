import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  checkCubeChemAccess,
  getRequestEmail,
} from "../lib/checkCubeChemAccess";

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

function money(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return `R ${Number(value).toFixed(2)}`;
}

function percent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return `${Number(value).toFixed(2)}%`;
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

function addHeader(doc: jsPDF, monthLabel: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text("CubeChem Internal Price Review", 14, 16);

  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(`Review Month: ${monthLabel}`, 14, 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Internal review report only. Use the customer price list export after prices have been accepted.",
    14,
    30
  );

  doc.setDrawColor(0, 145, 72);
  doc.setLineWidth(0.5);
  doc.line(14, 34, 283, 34);
}

function addFooter(doc: jsPDF, pageNumber: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Internal CubeChem price review report", 14, 200);
  doc.text(`Page ${pageNumber}`, 283, 200, { align: "right" });
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

    const supabase = getSupabaseAdmin();

    const body = await req.json();
    const exportMonth = String(body.exportMonth || "");

    if (!exportMonth) {
      return NextResponse.json(
        { error: "Export month is required." },
        { status: 400 }
      );
    }

    const monthDate = toMonthDate(exportMonth);
    const monthLabel = formatMonthLabel(exportMonth);

    const reviewItems = await supabase
      .from("cubechem_price_review_items")
      .select("*")
      .eq("price_month", monthDate)
      .order("category_sort", { ascending: true })
      .order("item_sort", { ascending: true })
      .order("ccd_item_code", { ascending: true });

    if (reviewItems.error) throw reviewItems.error;

    const rows = reviewItems.data || [];

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: `No review prices found for ${monthLabel}. First compare the month, then export.`,
        },
        { status: 400 }
      );
    }

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    addHeader(doc, monthLabel);

    const grouped = new Map<string, any[]>();

    for (const row of rows) {
      const category = row.category_name || "Other";

      if (!grouped.has(category)) {
        grouped.set(category, []);
      }

      grouped.get(category)?.push(row);
    }

    let currentY = 42;

    for (const [categoryName, categoryRows] of grouped.entries()) {
      if (currentY > 176) {
        doc.addPage();
        addHeader(doc, monthLabel);
        currentY = 42;
      }

      doc.setFillColor(226, 232, 240);
      doc.setDrawColor(203, 213, 225);
      doc.rect(14, currentY - 5, 263, 8, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(String(categoryName).toUpperCase(), 16, currentY);

      currentY += 5;

      autoTable(doc, {
        startY: currentY,
        head: [
          [
            "Code",
            "Description",
            "Previous",
            "Suggested",
            "R Change",
            "% Change",
          ],
        ],
        body: categoryRows.map((row: any) => {
          const previousPrice = Number(row.previous_approved_price || 0);

          const calculatedPrice =
            row.calculated_price === null || row.calculated_price === undefined
              ? null
              : Number(row.calculated_price);

          const finalPrice =
            row.approved_price === null || row.approved_price === undefined
              ? calculatedPrice
              : Number(row.approved_price);

          const randChange =
            finalPrice !== null && finalPrice !== undefined
              ? finalPrice - previousPrice
              : null;

          const percentChange =
            previousPrice > 0 && randChange !== null
              ? (randChange / previousPrice) * 100
              : null;

          return [
            row.ccd_item_code,
            cleanDescription(row.description),
            money(previousPrice),
            money(finalPrice),
            money(randChange),
            percent(percentChange),
          ];
        }),
        theme: "grid",
        margin: {
          top: 38,
          bottom: 14,
          left: 14,
          right: 14,
        },
        styles: {
          fontSize: 7,
          cellPadding: 1.4,
          lineColor: [203, 213, 225],
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
          0: { cellWidth: 24, fontStyle: "bold" },
          1: { cellWidth: 130 },
          2: { cellWidth: 28, halign: "right" },
          3: { cellWidth: 28, halign: "right", fontStyle: "bold" },
          4: { cellWidth: 28, halign: "right" },
          5: { cellWidth: 25, halign: "right" },
        },
        didDrawPage: () => {
          addHeader(doc, monthLabel);
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 9;
    }

    const pageCount = doc.getNumberOfPages();

    for (let page = 1; page <= pageCount; page++) {
      doc.setPage(page);
      addFooter(doc, page);
    }

    const pdfArrayBuffer = doc.output("arraybuffer");
    const buffer = Buffer.from(pdfArrayBuffer);

    const fileName = `CCD_INTERNAL_PRICE_REVIEW_${monthLabel.replace(
      /\s+/g,
      "_"
    )}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("CubeChem internal review PDF export error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Could not export internal review PDF.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}