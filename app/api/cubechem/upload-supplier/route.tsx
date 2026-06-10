import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { checkCubeChemAccess, getRequestEmail } from "../lib/checkCubeChemAccess";

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

function cleanText(value: any) {
  return String(value || "").trim();
}

function toNumber(value: any) {
  if (value === null || value === undefined || value === "") return 0;

  const cleaned = String(value)
    .replace(/R/gi, "")
    .replace(/\s/g, "")
    .replace(/,/g, "");

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : 0;
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

    const formData = await req.formData();

    const file = formData.get("file") as File | null;
    const priceMonth = String(formData.get("priceMonth") || "");

    if (!file || !priceMonth) {
      return NextResponse.json(
        { error: "File and price month are required." },
        { status: 400 }
      );
    }

    const monthDate = toMonthDate(priceMonth);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const safeFileName = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const storagePath = `supplier/${priceMonth}/${safeFileName}`;

    const uploadFile = await supabase.storage
      .from("cubechem-price-files")
      .upload(storagePath, buffer, {
        contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });

    if (uploadFile.error) throw uploadFile.error;

    const uploadRecord = await supabase
      .from("cubechem_price_uploads")
      .insert({
        price_month: monthDate,
        file_name: file.name,
        storage_path: storagePath,
        uploaded_by: requestEmail,
      })
      .select("id")
      .single();

    if (uploadRecord.error) throw uploadRecord.error;

    const workbook = XLSX.read(buffer, { type: "buffer" });
    const rowsToInsert: any[] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, {
        header: 1,
        defval: "",
      });

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        const itemCode = cleanText(row[0]);
        const description = cleanText(row[1]);
        const supplierExVat = toNumber(row[3]);
        const supplierIncVat = toNumber(row[4]);

        if (!itemCode || !description) continue;
        if (itemCode.toLowerCase().includes("item code")) continue;
        if (description.toLowerCase().includes("item description")) continue;
        if (supplierExVat <= 0 && supplierIncVat <= 0) continue;

        rowsToInsert.push({
          upload_id: uploadRecord.data.id,
          sheet_name: sheetName,
          item_code: itemCode.toUpperCase(),
          description,
          supplier_ex_vat: supplierExVat,
          supplier_inc_vat: supplierIncVat,
        });
      }
    }

    if (rowsToInsert.length > 0) {
      const insertItems = await supabase
        .from("cubechem_price_items")
        .insert(rowsToInsert);

      if (insertItems.error) throw insertItems.error;
    }

    return NextResponse.json({
      message: "Supplier price list uploaded.",
      uploadId: uploadRecord.data.id,
      itemCount: rowsToInsert.length,
    });
  } catch (error) {
    console.error("CubeChem supplier upload error:", error);

    const message =
      error instanceof Error ? error.message : "Could not upload supplier file.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}