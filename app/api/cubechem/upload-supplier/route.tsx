import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import {
  checkCubeChemAccess,
  getRequestEmail,
} from "../lib/checkCubeChemAccess";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function toMonthDate(value: string) {
  return `${value}-01`;
}

function cleanText(value: any) {
  return String(value || "").trim();
}

function normaliseHeader(value: any) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function parseMoney(value: any) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const cleaned = String(value)
    .replace(/r/gi, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .trim();

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : null;
}

function findHeaderRow(rows: any[][]) {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 30); rowIndex++) {
    const normalised = rows[rowIndex].map(normaliseHeader);

    const hasCode = normalised.some(
      (cell) =>
        cell === "itemcode" ||
        cell === "code" ||
        cell === "item" ||
        cell === "stockcode"
    );

    const hasDescription = normalised.some(
      (cell) =>
        cell === "itemdescription" ||
        cell === "description" ||
        cell === "productdescription"
    );

    const hasPrice = normalised.some(
      (cell) =>
        cell.includes("pricingexcl") ||
        cell.includes("priceexcl") ||
        cell.includes("exclvat") ||
        cell.includes("excludingvat") ||
        cell.includes("supplierexvat") ||
        cell.includes("pricingincl") ||
        cell.includes("inclvat")
    );

    if (hasCode && hasDescription && hasPrice) {
      return rowIndex;
    }
  }

  return -1;
}

function findColumnIndex(headers: any[], candidates: string[]) {
  const normalisedHeaders = headers.map(normaliseHeader);

  for (const candidate of candidates) {
    const normalisedCandidate = normaliseHeader(candidate);
    const exactIndex = normalisedHeaders.findIndex(
      (header) => header === normalisedCandidate
    );

    if (exactIndex >= 0) return exactIndex;
  }

  for (const candidate of candidates) {
    const normalisedCandidate = normaliseHeader(candidate);
    const containsIndex = normalisedHeaders.findIndex((header) =>
      header.includes(normalisedCandidate)
    );

    if (containsIndex >= 0) return containsIndex;
  }

  return -1;
}

function extractItemsFromWorkbook(workbook: XLSX.WorkBook) {
  const allItems: {
    item_code: string;
    description: string;
    supplier_ex_vat: number;
  }[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    if (!rows || rows.length === 0) continue;

    const headerRowIndex = findHeaderRow(rows);

    if (headerRowIndex < 0) continue;

    const headers = rows[headerRowIndex];

    const codeIndex = findColumnIndex(headers, [
      "Item Code",
      "Code",
      "Item",
      "Stock Code",
    ]);

    const descriptionIndex = findColumnIndex(headers, [
      "Item Description",
      "Description",
      "Product Description",
    ]);

    const exclVatIndex = findColumnIndex(headers, [
      "Pricing exclVAT",
      "Pricing excl VAT",
      "Price excl VAT",
      "Excl VAT",
      "Supplier Ex VAT",
    ]);

    const inclVatIndex = findColumnIndex(headers, [
      "Pricing INCL VAT",
      "Pricing incl VAT",
      "Price incl VAT",
      "Incl VAT",
      "Supplier Inc VAT",
    ]);

    if (codeIndex < 0 || descriptionIndex < 0) continue;

    for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];

      const itemCode = cleanText(row[codeIndex]).toUpperCase();
      const description = cleanText(row[descriptionIndex]);

      if (!itemCode || !description) continue;
      if (itemCode.toLowerCase().includes("item")) continue;
      if (description.toLowerCase().includes("description")) continue;

      const exclVatAmount =
        exclVatIndex >= 0 ? parseMoney(row[exclVatIndex]) : null;

      const inclVatAmount =
        inclVatIndex >= 0 ? parseMoney(row[inclVatIndex]) : null;

      let supplierExVat: number | null = null;

      if (exclVatAmount !== null) {
        supplierExVat = exclVatAmount;
      } else if (inclVatAmount !== null) {
        supplierExVat = inclVatAmount / 1.15;
      }

      if (supplierExVat === null || supplierExVat <= 0) continue;

      allItems.push({
        item_code: itemCode,
        description,
        supplier_ex_vat: Math.round(supplierExVat * 100) / 100,
      });
    }
  }

  const deduped = new Map<string, {
    item_code: string;
    description: string;
    supplier_ex_vat: number;
  }>();

  for (const item of allItems) {
    deduped.set(item.item_code, item);
  }

  return Array.from(deduped.values());
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

    const formData = await req.formData();

    const file = formData.get("file");
    const priceMonth = String(formData.get("priceMonth") || "");

    if (!priceMonth) {
      return NextResponse.json(
        { error: "Upload month is required." },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please select a valid Excel file." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    const items = extractItemsFromWorkbook(workbook);

    if (items.length === 0) {
      return NextResponse.json(
        {
          error:
            "No supplier items found. Expected columns: Item Code, Item Description, Pricing exclVAT or Pricing INCL VAT.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const monthDate = toMonthDate(priceMonth);

    const uploadResult = await supabase
      .from("cubechem_price_uploads")
      .insert({
        price_month: monthDate,
        file_name: file.name,
      })
      .select("id, price_month, file_name")
      .single();

    if (uploadResult.error) {
      return NextResponse.json(
        { error: uploadResult.error.message },
        { status: 500 }
      );
    }

    const uploadId = uploadResult.data.id;

    const rowsToInsert = items.map((item) => ({
      upload_id: uploadId,
      item_code: item.item_code,
      description: item.description,
      supplier_ex_vat: item.supplier_ex_vat,
    }));

    const insertResult = await supabase
      .from("cubechem_price_items")
      .insert(rowsToInsert);

    if (insertResult.error) {
      return NextResponse.json(
        { error: insertResult.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      upload: uploadResult.data,
      itemCount: rowsToInsert.length,
      message: `${rowsToInsert.length} supplier items uploaded for ${monthDate}.`,
    });
  } catch (error) {
    console.error("CubeChem supplier upload error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not upload supplier file.",
      },
      { status: 500 }
    );
  }
}