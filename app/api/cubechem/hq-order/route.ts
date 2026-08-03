import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  checkCubeChemAccess,
  getRequestEmail,
} from "../lib/checkCubeChemAccess";

export const dynamic = "force-dynamic";

type PriceListType = "BULK" | "INDIVIDUAL";

type UploadRow = {
  id: string;
  price_month: string;
  file_name: string;
  uploaded_at: string;
  price_list_type: PriceListType;
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

function roundRand(value: number) {
  return Math.round(value);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

async function getLatestUpload(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  monthDate: string,
  priceListType: PriceListType
) {
  const result = await supabase
    .from("cubechem_price_uploads")
    .select("id, price_month, file_name, uploaded_at, price_list_type")
    .eq("price_month", monthDate)
    .eq("price_list_type", priceListType)
    .order("uploaded_at", { ascending: false })
    .limit(1);

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data?.[0] || null) as UploadRow | null;
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

    const [bulkUpload, individualUpload] = await Promise.all([
      getLatestUpload(supabase, monthDate, "BULK"),
      getLatestUpload(supabase, monthDate, "INDIVIDUAL"),
    ]);

    if (!bulkUpload && !individualUpload) {
      return NextResponse.json(
        { error: `No Abyx supplier uploads found for ${monthDate}.` },
        { status: 400 }
      );
    }

    const uploadIds = [bulkUpload?.id, individualUpload?.id].filter(
      (value): value is string => Boolean(value)
    );

    const itemsResult = await supabase
      .from("cubechem_price_items")
      .select("upload_id, item_code, description, supplier_ex_vat")
      .in("upload_id", uploadIds)
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

    const uploadTypeById = new Map<string, PriceListType>();

    if (bulkUpload) {
      uploadTypeById.set(bulkUpload.id, "BULK");
    }

    if (individualUpload) {
      uploadTypeById.set(individualUpload.id, "INDIVIDUAL");
    }

    const rows = (itemsResult.data || []).map((item: any) => {
      const itemCode = String(item.item_code || "").toUpperCase();
      const supplierExVat = Number(item.supplier_ex_vat || 0);
      const priceListType =
        uploadTypeById.get(String(item.upload_id)) || "BULK";

      const abyxPackAmount = roundMoney(supplierExVat * 1.15);
      const ccdPretoriaAmount = roundRand(
        abyxPackAmount * (1 + hqMarkupPercent / 100)
      );

      const isFrequent =
        priceListType === "BULK" && frequentCodes.has(itemCode);

      return {
        rowId: `${priceListType}-${itemCode}`,
        itemCode,
        description: item.description,
        priceListType,
        purchaseOption:
          priceListType === "INDIVIDUAL" ? "Individual Unit" : "Bulk / Case",
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

      if (a.priceListType !== b.priceListType) {
        return a.priceListType === "BULK" ? -1 : 1;
      }

      return String(a.description).localeCompare(String(b.description));
    });

    return NextResponse.json({
      uploads: {
        bulk: bulkUpload,
        individual: individualUpload,
      },
      priceMonth: monthDate,
      hqMarkupPercent,
      itemCount: sortedRows.length,
      bulkCount: sortedRows.filter(
        (row: any) => row.priceListType === "BULK"
      ).length,
      individualCount: sortedRows.filter(
        (row: any) => row.priceListType === "INDIVIDUAL"
      ).length,
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
