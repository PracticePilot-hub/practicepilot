import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
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

function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "";
  }

  return Number(value);
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

    const rows = reviewItems.data
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

    const sheetRows: any[][] = [];

    sheetRows.push(["CUBE CHEM DISTRIBUTION"]);
    sheetRows.push([`PRICE LIST: ${monthLabel.toUpperCase()}`]);
    sheetRows.push([]);
    sheetRows.push(["Product/Service", "Description", "Price"]);

    let lastCategory = "";

    for (const row of rows) {
      const categoryName = row.category_name || "Other";

      if (categoryName !== lastCategory) {
        sheetRows.push([]);
        sheetRows.push([categoryName]);
        lastCategory = categoryName;
      }

      sheetRows.push([
        row.ccd_item_code,
        `${row.description}${
          row.saving > 0 ? `   ***SAVE R ${row.saving.toFixed(2)}` : ""
        }`,
        formatPrice(row.final_price),
      ]);
    }

    const probacSection = staticSections.data?.find(
      (section: any) => section.section_key === "probac"
    );

    if (probacSection) {
      const probacRows = (staticItems.data || []).filter(
        (item: any) => item.section_key === "probac"
      );

      if (probacRows.length > 0) {
        sheetRows.push([]);
        sheetRows.push([probacSection.section_title]);

        for (const row of probacRows) {
          sheetRows.push([
            row.item_code,
            row.description,
            formatPrice(Number(row.price || 0)),
          ]);
        }
      }
    }

    const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);

    worksheet["!cols"] = [
      { wch: 18 },
      { wch: 85 },
      { wch: 14 },
    ];

    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:C1");

    for (let rowNumber = range.s.r; rowNumber <= range.e.r; rowNumber++) {
      const priceCellAddress = XLSX.utils.encode_cell({ r: rowNumber, c: 2 });
      const priceCell = worksheet[priceCellAddress];

      if (priceCell && typeof priceCell.v === "number") {
        priceCell.t = "n";
        priceCell.z = '"R" #,##0.00';
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "CCD Price List");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    const fileName = `CCD_PRICE_LIST_${monthLabel.replace(/\s+/g, "_")}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("CubeChem Excel export error:", error);

    const message =
      error instanceof Error ? error.message : "Could not export Excel price list.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}