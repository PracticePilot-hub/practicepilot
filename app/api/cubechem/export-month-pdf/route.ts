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

type CategoryRule = {
  category_name: string;
  category_sort: number;
  item_sort: number | null;
  item_code_prefix: string | null;
  item_code_exact: string | null;
  description_contains: string | null;
};

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

function getCategory(row: any, rules: CategoryRule[]) {
  const itemCode = String(row.ccd_item_code || "").toUpperCase();
  const description = String(row.description || "").toLowerCase();

  const exactRule = rules.find(
    (rule) =>
      rule.item_code_exact &&
      itemCode === String(rule.item_code_exact).toUpperCase()
  );

  if (exactRule) return exactRule;

  const descriptionRule = rules.find(
    (rule) =>
      rule.description_contains &&
      description.includes(String(rule.description_contains).toLowerCase())
  );

  if (descriptionRule) return descriptionRule;

  const prefixRule = rules.find(
    (rule) =>
      rule.item_code_prefix &&
      itemCode.startsWith(String(rule.item_code_prefix).toUpperCase())
  );

  if (prefixRule) return prefixRule;

  return {
    category_name: "Other",
    category_sort: 999,
    item_sort: 9999,
    item_code_prefix: null,
    item_code_exact: null,
    description_contains: null,
  };
}

function addPageHeader(
  doc: jsPDF,
  franchise: any,
  monthLabel: string,
  logoBase64: string | null
) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 70, "F");

  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", 12, 9, 58, 31);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(0, 145, 72);
  doc.text("CUBE CHEM DISTRIBUTION", 196, 16, { align: "right" });

  doc.setFontSize(10.5);
  doc.text(String(franchise.area_heading || "").toUpperCase(), 196, 24, {
    align: "right",
  });

  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);

  let detailY = 32;

  if (franchise.phone) {
    doc.text(`PHONE/WHATSAPP ORDERS: ${franchise.phone}`, 196, detailY, {
      align: "right",
    });
    detailY += 5.5;
  }

  if (franchise.email) {
    doc.text(`EMAIL ORDERS: ${franchise.email}`, 196, detailY, {
      align: "right",
    });
    detailY += 5.5;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 145, 72);

  const websiteText = "www.cubechem.co.za";
  const websiteWidth = doc.getTextWidth(websiteText);
  const websiteX = 196 - websiteWidth;

  doc.text(websiteText, 196, detailY, { align: "right" });
  doc.link(websiteX, detailY - 4, websiteWidth, 5, {
    url: "https://www.cubechem.co.za",
  });

  detailY += 5.5;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 145, 72);
  doc.text(
    franchise.slogan || "For quality and affordable product that work!",
    196,
    detailY,
    { align: "right" }
  );

  doc.setDrawColor(0, 145, 72);
  doc.setLineWidth(0.8);
  doc.line(10, 56, 200, 56);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`PRICE LIST: ${monthLabel.toUpperCase()}`, 196, 64, {
    align: "right",
  });
}

function addFooter(doc: jsPDF, pageNumber: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Prices are subject to availability and change without notice.", 14, 287);
  doc.text(`Page ${pageNumber}`, 196, 287, { align: "right" });
}

function addSectionHeading(doc: jsPDF, title: string, y: number) {
  doc.setFillColor(226, 240, 217);
  doc.setDrawColor(0, 145, 72);
  doc.setLineWidth(0.2);
  doc.rect(14, y - 5, 180, 8, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 16, y);
}

function addDeliveryPage(
  doc: jsPDF,
  franchise: any,
  monthLabel: string,
  logoBase64: string | null,
  bodyText: string
) {
  doc.addPage();

  addPageHeader(doc, franchise, monthLabel, logoBase64);

  doc.setFillColor(245, 245, 245);
  doc.setDrawColor(0, 145, 72);
  doc.setLineWidth(0.4);
  doc.rect(16, 78, 178, 150, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("ORDERS AND DELIVERY INFORMATION", 105, 90, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);

  const lines = doc.splitTextToSize(bodyText, 160);
  doc.text(lines, 105, 104, {
    align: "center",
    lineHeightFactor: 1.45,
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

    const supabase = getSupabaseAdmin();

    const body = await req.json();
    const exportMonth = String(body.exportMonth || "");
    const franchiseCode = String(body.franchiseCode || "pretoria");

    if (!exportMonth) {
      return NextResponse.json(
        { error: "Export month is required." },
        { status: 400 }
      );
    }

    const monthDate = toMonthDate(exportMonth);
    const monthLabel = formatMonthLabel(exportMonth);
    const logoBase64 = getLogoBase64();

    const franchiseResult = await supabase
      .from("cubechem_franchises")
      .select("*")
      .eq("franchise_code", franchiseCode)
      .eq("is_active", true)
      .single();

    if (franchiseResult.error) {
      return NextResponse.json(
        { error: "Selected franchise could not be found." },
        { status: 400 }
      );
    }

    const franchise = franchiseResult.data;

    const reviewItems = await supabase
      .from("cubechem_price_review_items")
      .select("*")
      .eq("price_month", monthDate);

    if (reviewItems.error) throw reviewItems.error;

    if (!reviewItems.data || reviewItems.data.length === 0) {
      return NextResponse.json(
        {
          error: `No calculated/final prices found for ${monthLabel}. First compare the month, then export.`,
        },
        { status: 400 }
      );
    }

    const categoryRules = await supabase
      .from("cubechem_category_rules")
      .select("*")
      .eq("is_active", true)
      .order("category_sort", { ascending: true })
      .order("item_sort", { ascending: true });

    if (categoryRules.error) throw categoryRules.error;

    const staticSections = await supabase
      .from("cubechem_static_pdf_sections")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (staticSections.error) throw staticSections.error;

    const staticItems = await supabase
      .from("cubechem_static_pdf_items")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (staticItems.error) throw staticItems.error;

    const rules = (categoryRules.data || []) as CategoryRule[];

    const validRows = reviewItems.data
      .filter(
        (row: any) =>
          row.status !== "NOT FOUND" &&
          row.status !== "RULE SOURCE MISSING" &&
          row.approved_price !== null
      )
      .map((row: any) => {
        const category = getCategory(row, rules);

        const calculatedPrice =
          row.calculated_price === null || row.calculated_price === undefined
            ? null
            : Number(row.calculated_price);

        const finalPrice = Number(row.approved_price || 0);

        const saving =
          calculatedPrice !== null && finalPrice < calculatedPrice
            ? calculatedPrice - finalPrice
            : 0;

        return {
          ...row,
          description: cleanDescription(row.description),
          category_name: row.category_name || category.category_name,
          category_sort: row.category_sort ?? category.category_sort,
          item_sort: row.item_sort ?? category.item_sort ?? 9999,
          final_price: finalPrice,
          saving,
        };
      })
      .sort((a: any, b: any) => {
        if (a.category_sort !== b.category_sort) {
          return a.category_sort - b.category_sort;
        }

        if ((a.item_sort ?? 9999) !== (b.item_sort ?? 9999)) {
          return (a.item_sort ?? 9999) - (b.item_sort ?? 9999);
        }

        return String(a.ccd_item_code).localeCompare(String(b.ccd_item_code));
      });

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    addPageHeader(doc, franchise, monthLabel, logoBase64);

    let currentY = 76;

    const categoryNames = Array.from(
      new Set(validRows.map((row: any) => row.category_name || "Other"))
    );

    for (const categoryName of categoryNames) {
      const categoryRows = validRows.filter(
        (row: any) => (row.category_name || "Other") === categoryName
      );

      if (categoryRows.length === 0) continue;

      if (currentY > 248) {
        doc.addPage();
        addPageHeader(doc, franchise, monthLabel, logoBase64);
        currentY = 76;
      }

      addSectionHeading(doc, categoryName, currentY);
      currentY += 5;

      autoTable(doc, {
        startY: currentY,
        head: [["Code", "Description", "Price"]],
        body: categoryRows.map((row: any) => [
          row.ccd_item_code,
          `${row.description}${
            row.saving > 0 ? `   ***SAVE R ${row.saving.toFixed(2)}` : ""
          }`,
          `R ${Number(row.final_price || 0).toFixed(2)}`,
        ]),
        theme: "grid",
        margin: {
          top: 76,
          bottom: 16,
          left: 14,
          right: 14,
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 1.8,
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
          0: { cellWidth: 25, fontStyle: "bold" },
          1: { cellWidth: 125 },
          2: { cellWidth: 30, halign: "right", fontStyle: "bold" },
        },
        didDrawPage: () => {
          addPageHeader(doc, franchise, monthLabel, logoBase64);
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    const probacSection = staticSections.data?.find(
      (section: any) => section.section_key === "probac"
    );

    if (probacSection) {
      const probacRows = (staticItems.data || []).filter(
        (item: any) => item.section_key === "probac"
      );

      if (probacRows.length > 0) {
        if (currentY > 220) {
          doc.addPage();
          addPageHeader(doc, franchise, monthLabel, logoBase64);
          currentY = 76;
        }

        addSectionHeading(doc, probacSection.section_title, currentY);
        currentY += 5;

        autoTable(doc, {
          startY: currentY,
          head: [["Code", "Description", "Price"]],
          body: probacRows.map((row: any) => [
            row.item_code,
            row.description,
            `R ${Number(row.price || 0).toFixed(2)}`,
          ]),
          theme: "grid",
          margin: {
            top: 76,
            bottom: 16,
            left: 14,
            right: 14,
          },
          styles: {
            fontSize: 7.5,
            cellPadding: 1.8,
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
            0: { cellWidth: 25, fontStyle: "bold" },
            1: { cellWidth: 125 },
            2: { cellWidth: 30, halign: "right", fontStyle: "bold" },
          },
          didDrawPage: () => {
            addPageHeader(doc, franchise, monthLabel, logoBase64);
          },
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;
      }
    }

    const deliverySection = staticSections.data?.find(
      (section: any) =>
        section.section_key === "pretoria_delivery" &&
        section.show_for_franchise_code === franchiseCode
    );

    if (deliverySection?.body_text) {
      addDeliveryPage(
        doc,
        franchise,
        monthLabel,
        logoBase64,
        deliverySection.body_text
      );
    }

    const pageCount = doc.getNumberOfPages();

    for (let page = 1; page <= pageCount; page++) {
      doc.setPage(page);
      addFooter(doc, page);
    }

    const pdfArrayBuffer = doc.output("arraybuffer");
    const buffer = Buffer.from(pdfArrayBuffer);

    const fileName = `CCD_PRICE_LIST_${franchiseCode.toUpperCase()}_${monthLabel.replace(
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
    console.error("CubeChem PDF export error:", error);

    const message =
      error instanceof Error ? error.message : "Could not export PDF price list.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}