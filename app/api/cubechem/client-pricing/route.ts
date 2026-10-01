import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  checkCubeChemAccess,
  getRequestEmail,
} from "../lib/checkCubeChemAccess";

export const dynamic = "force-dynamic";

type ReviewRow = {
  ccd_item_code: string;
  description: string | null;
  supplier_ex_vat: number | null;
  hq_price: number | null;
  calculated_price: number | null;
  approved_price: number | null;
  hq_markup_percent: number | null;
  branch_markup_percent: number | null;
  category_name: string | null;
  category_sort: number | null;
  item_sort: number | null;
  status: string | null;
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

function roundWholeRand(value: number) {
  return Math.round(value);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function calculateScenario(
  supplierCostExVat: number,
  hqMarkupPercent: number,
  ptaMarkupPercent: number
) {
  const hqExVat = supplierCostExVat * (1 + hqMarkupPercent / 100);
  const hqIncVat = hqExVat * 1.15;
  const clientPrice = roundWholeRand(
    hqIncVat * (1 + ptaMarkupPercent / 100)
  );

  return {
    hqPrice: roundWholeRand(hqIncVat),
    clientPrice,
  };
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
    const ptaMarkupPercent = Number(body.ptaMarkupPercent ?? 45);

    if (!priceMonth) {
      return NextResponse.json(
        { error: "Price month is required." },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(hqMarkupPercent) ||
      !Number.isFinite(ptaMarkupPercent)
    ) {
      return NextResponse.json(
        { error: "HQ and PTA markup percentages must be valid." },
        { status: 400 }
      );
    }

    const monthDate = toMonthDate(priceMonth);
    const supabase = getSupabaseAdmin();

    const reviewResult = await supabase
      .from("cubechem_price_review_items")
      .select(
        "ccd_item_code, description, supplier_ex_vat, hq_price, calculated_price, approved_price, hq_markup_percent, branch_markup_percent, category_name, category_sort, item_sort, status"
      )
      .eq("price_month", monthDate)
      .not("approved_price", "is", null)
      .order("category_sort", { ascending: true })
      .order("item_sort", { ascending: true })
      .order("ccd_item_code", { ascending: true });

    if (reviewResult.error) {
      throw reviewResult.error;
    }

    const sourceRows = (reviewResult.data || []) as ReviewRow[];

    const usableRows = sourceRows.filter((row) => {
      if (
        row.status === "NOT FOUND" ||
        row.status === "RULE SOURCE MISSING"
      ) {
        return false;
      }

      return (
        row.supplier_ex_vat !== null &&
        row.supplier_ex_vat !== undefined &&
        Number.isFinite(Number(row.supplier_ex_vat)) &&
        row.approved_price !== null &&
        row.approved_price !== undefined &&
        Number.isFinite(Number(row.approved_price))
      );
    });

    if (usableRows.length === 0) {
      return NextResponse.json(
        {
          error: `No completed CubeChem client prices found for ${monthDate}. Please complete the price review for this month first.`,
        },
        { status: 400 }
      );
    }

    const rows = usableRows.map((row) => {
      const supplierCostExVat = roundMoney(Number(row.supplier_ex_vat || 0));
      const normalClientPrice = Number(row.approved_price || 0);

      const currentHqMarkupPercent =
        row.hq_markup_percent !== null &&
        row.hq_markup_percent !== undefined
          ? Number(row.hq_markup_percent)
          : 15;

      const currentPtaMarkupPercent =
        row.branch_markup_percent !== null &&
        row.branch_markup_percent !== undefined
          ? Number(row.branch_markup_percent)
          : 45;

      const normalHqPrice =
        row.hq_price !== null &&
        row.hq_price !== undefined
          ? Number(row.hq_price)
          : calculateScenario(
              supplierCostExVat,
              currentHqMarkupPercent,
              currentPtaMarkupPercent
            ).hqPrice;

      const scenario = calculateScenario(
        supplierCostExVat,
        hqMarkupPercent,
        ptaMarkupPercent
      );

      return {
        itemCode: String(row.ccd_item_code || "").toUpperCase(),
        description: String(row.description || ""),
        categoryName: row.category_name || "Other",
        categorySort: Number(row.category_sort ?? 999),
        itemSort: Number(row.item_sort ?? 9999),
        supplierCostExVat,
        currentHqMarkupPercent,
        currentPtaMarkupPercent,
        normalHqPrice,
        normalClientPrice,
        scenarioHqPrice: scenario.hqPrice,
        scenarioClientPrice: scenario.clientPrice,
      };
    });

    rows.sort((a, b) => {
      if (a.categorySort !== b.categorySort) {
        return a.categorySort - b.categorySort;
      }

      if (a.itemSort !== b.itemSort) {
        return a.itemSort - b.itemSort;
      }

      return a.itemCode.localeCompare(b.itemCode);
    });

    return NextResponse.json({
      priceMonth: monthDate,
      hqMarkupPercent,
      ptaMarkupPercent,
      itemCount: rows.length,
      rows,
    });
  } catch (error) {
    console.error("CubeChem client pricing route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load CubeChem client pricing.",
      },
      { status: 500 }
    );
  }
}
