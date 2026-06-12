import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

function roundRand(value: number) {
  return Math.round(value);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
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

    const priceMonth = String(body.priceMonth || "");
    const hqMarkupPercent = Number(body.hqMarkupPercent ?? 15);

    if (!priceMonth) {
      return NextResponse.json(
        { error: "Price month is required." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(hqMarkupPercent)) {
      return NextResponse.json(
        { error: "HQ markup percentage must be valid." },
        { status: 400 }
      );
    }

    const monthDate = toMonthDate(priceMonth);
    const supabase = getSupabaseAdmin();

    const uploadResult = await supabase
      .from("cubechem_price_uploads")
      .select("id, price_month, file_name, uploaded_at")
      .eq("price_month", monthDate)
      .order("uploaded_at", { ascending: false })
      .limit(1);

    if (uploadResult.error) {
      return NextResponse.json(
        { error: uploadResult.error.message },
        { status: 500 }
      );
    }

    const upload = uploadResult.data?.[0];

    if (!upload) {
      return NextResponse.json(
        { error: `No Abyx supplier upload found for ${monthDate}.` },
        { status: 400 }
      );
    }

    const itemsResult = await supabase
      .from("cubechem_price_items")
      .select("item_code, description, supplier_ex_vat")
      .eq("upload_id", upload.id)
      .order("item_code", { ascending: true });

    if (itemsResult.error) {
      return NextResponse.json(
        { error: itemsResult.error.message },
        { status: 500 }
      );
    }

    const frequentResult = await supabase
      .from("cubechem_price_review_items")
      .select("ccd_item_code")
      .eq("price_month", monthDate);

    if (frequentResult.error) {
      return NextResponse.json(
        { error: frequentResult.error.message },
        { status: 500 }
      );
    }

    const frequentCodes = new Set(
      (frequentResult.data || []).map((item: any) =>
        String(item.ccd_item_code || "").toUpperCase()
      )
    );

    const rows = (itemsResult.data || []).map((item: any) => {
      const itemCode = String(item.item_code || "").toUpperCase();
      const supplierExVat = Number(item.supplier_ex_vat || 0);

      const abyxPackAmount = roundMoney(supplierExVat * 1.15);
      const ccdPretoriaAmount = roundRand(
        abyxPackAmount * (1 + hqMarkupPercent / 100)
      );

      const isFrequent = frequentCodes.has(itemCode);

      return {
        itemCode,
        description: item.description,
        isFrequent,
        groupName: isFrequent ? "Frequent Items" : "Rest of Items",
        abyxPackAmount,
        hqMarkupPercent,
        ccdPretoriaAmount,
      };
    });

    const sortedRows = rows.sort((a: any, b: any) => {
      if (a.isFrequent !== b.isFrequent) {
        return a.isFrequent ? -1 : 1;
      }

      return String(a.itemCode).localeCompare(String(b.itemCode));
    });

    return NextResponse.json({
      upload,
      priceMonth: monthDate,
      hqMarkupPercent,
      itemCount: sortedRows.length,
      frequentCount: sortedRows.filter((row: any) => row.isFrequent).length,
      restCount: sortedRows.filter((row: any) => !row.isFrequent).length,
      rows: sortedRows,
    });
  } catch (error) {
    console.error("CubeChem HQ order route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load HQ supplier order list.",
      },
      { status: 500 }
    );
  }
}