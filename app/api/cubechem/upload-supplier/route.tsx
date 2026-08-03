import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import {
  checkCubeChemAccess,
  getRequestEmail,
} from "../lib/checkCubeChemAccess";

export const dynamic = "force-dynamic";

type PriceListType = "BULK" | "INDIVIDUAL";

type ExtractedItem = {
  item_code: string;
  description: string;
  supplier_ex_vat: number;
};

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

function normaliseDescriptionKey(value: string) {
  return cleanText(value)
    .toLowerCase()
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

function normalisePriceListType(value: FormDataEntryValue | null): PriceListType {
  return String(value || "BULK").trim().toUpperCase() === "INDIVIDUAL"
    ? "INDIVIDUAL"
    : "BULK";
}

function findHeaderRow(rows: any[][], priceListType: PriceListType) {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 40); rowIndex++) {
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

    if (
      hasDescription &&
      hasPrice &&
      (priceListType === "INDIVIDUAL" || hasCode)
    ) {
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

function buildIndividualInternalCode(
  description: string,
  sheetIndex: number,
  rowIndex: number
) {
  const descriptionKey = normaliseDescriptionKey(description)
    .slice(0, 18)
    .toUpperCase();

  return `IND-${descriptionKey || "ITEM"}-${sheetIndex + 1}-${rowIndex + 1}`;
}

function extractItemsFromWorkbook(
  workbook: XLSX.WorkBook,
  priceListType: PriceListType
) {
  const allItems: ExtractedItem[] = [];

  workbook.SheetNames.forEach((sheetName, sheetIndex) => {
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    if (!rows || rows.length === 0) return;

    const headerRowIndex = findHeaderRow(rows, priceListType);

    if (headerRowIndex < 0) return;

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

    if (descriptionIndex < 0) return;
    if (priceListType === "BULK" && codeIndex < 0) return;

    for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];

      const description = cleanText(row[descriptionIndex]);
      const suppliedCode =
        codeIndex >= 0 ? cleanText(row[codeIndex]).toUpperCase() : "";

      if (!description) continue;
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
      if (priceListType === "BULK" && !suppliedCode) continue;

      const itemCode =
        priceListType === "INDIVIDUAL"
          ? suppliedCode ||
            buildIndividualInternalCode(description, sheetIndex, rowIndex)
          : suppliedCode;

      allItems.push({
        item_code: itemCode,
        description,
        supplier_ex_vat: Math.round(supplierExVat * 100) / 100,
      });
    }
  });

  const deduped = new Map<string, ExtractedItem>();

  for (const item of allItems) {
    const dedupeKey =
      priceListType === "INDIVIDUAL"
        ? normaliseDescriptionKey(item.description)
        : item.item_code;

    deduped.set(dedupeKey, item);
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
    const priceListType = normalisePriceListType(
      formData.get("priceListType")
    );

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

    const items = extractItemsFromWorkbook(workbook, priceListType);

    if (items.length === 0) {
      const expectedColumns =
        priceListType === "INDIVIDUAL"
          ? "Item Description and Pricing exclVAT or Pricing INCL VAT."
          : "Item Code, Item Description, and Pricing exclVAT or Pricing INCL VAT.";

      return NextResponse.json(
        {
          error: `No supplier items found. Expected columns: ${expectedColumns}`,
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
        price_list_type: priceListType,
      })
      .select("id, price_month, file_name, price_list_type")
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
      await supabase
        .from("cubechem_price_uploads")
        .delete()
        .eq("id", uploadId);

      return NextResponse.json(
        { error: insertResult.error.message },
        { status: 500 }
      );
    }

    const typeLabel =
      priceListType === "INDIVIDUAL" ? "individual" : "bulk";

    return NextResponse.json({
      upload: uploadResult.data,
      itemCount: rowsToInsert.length,
      priceListType,
      message: `${rowsToInsert.length} ${typeLabel} supplier items uploaded for ${monthDate}.`,
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
