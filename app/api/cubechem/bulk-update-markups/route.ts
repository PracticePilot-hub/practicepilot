import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

function roundWholeRand(value: number) {
  return Math.round(value);
}

function calculatePricesFromCost(
  supplierExVat: number,
  hqMarkupPercent: number,
  branchMarkupPercent: number
) {
  const hqExVat = supplierExVat * (1 + hqMarkupPercent / 100);
  const hqIncVat = hqExVat * 1.15;
  const branchPrice = roundWholeRand(hqIncVat * (1 + branchMarkupPercent / 100));

  return {
    hqPrice: roundWholeRand(hqIncVat),
    branchPrice,
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

    const supabase = getSupabaseAdmin();

    const body = await req.json();

    const priceMonth = String(body.priceMonth || "");
    const itemCodes = Array.isArray(body.itemCodes)
      ? body.itemCodes.map((code: string) => String(code).toUpperCase())
      : [];

    const hqMarkupPercent = Number(body.hqMarkupPercent);
    const branchMarkupPercent = Number(body.branchMarkupPercent);

    if (!priceMonth || itemCodes.length === 0) {
      return NextResponse.json(
        { error: "Price month and selected item codes are required." },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(hqMarkupPercent) ||
      !Number.isFinite(branchMarkupPercent)
    ) {
      return NextResponse.json(
        { error: "Markup percentages must be valid numbers." },
        { status: 400 }
      );
    }

    const monthDate = toMonthDate(priceMonth);

    const reviewRows = await supabase
      .from("cubechem_price_review_items")
      .select("*")
      .eq("price_month", monthDate)
      .in("ccd_item_code", itemCodes);

    if (reviewRows.error) throw reviewRows.error;

    const rowsToUpdate = (reviewRows.data || []).filter(
      (row: any) => Number(row.supplier_ex_vat || 0) > 0
    );

    if (rowsToUpdate.length === 0) {
      return NextResponse.json(
        { error: "No selected items had supplier costs to recalculate from." },
        { status: 400 }
      );
    }

    const updatedRows = rowsToUpdate.map((row: any) => {
      const supplierExVat = Number(row.supplier_ex_vat || 0);
      const previousPrice = Number(row.previous_approved_price || 0);

      const prices = calculatePricesFromCost(
        supplierExVat,
        hqMarkupPercent,
        branchMarkupPercent
      );

      const difference = prices.branchPrice - previousPrice;
      const differencePercent =
        previousPrice > 0 ? (difference / previousPrice) * 100 : 0;

      const status =
        difference > 0 ? "INCREASE" : difference < 0 ? "DECREASE" : "NO CHANGE";

      return {
        price_month: monthDate,
        ccd_item_code: row.ccd_item_code,
        description: row.description,
        previous_approved_price: row.previous_approved_price,
        supplier_ex_vat: supplierExVat,
        hq_price: prices.hqPrice,
        calculated_price: prices.branchPrice,
        approved_price: prices.branchPrice,
        difference,
        difference_percent: differencePercent,
        status,
        pricing_method: row.pricing_method,
        missing_sources: row.missing_sources || [],
        category_name: row.category_name,
        category_sort: row.category_sort,
        item_sort: row.item_sort,
        accepted_increase: false,
        manually_adjusted: true,
        hq_markup_percent: hqMarkupPercent,
        branch_markup_percent: branchMarkupPercent,
        updated_at: new Date().toISOString(),
      };
    });

    const saveReview = await supabase
      .from("cubechem_price_review_items")
      .upsert(updatedRows, {
        onConflict: "price_month,ccd_item_code",
      });

    if (saveReview.error) throw saveReview.error;

    const approvedRows = updatedRows.map((row: any) => ({
      price_month: row.price_month,
      ccd_item_code: row.ccd_item_code,
      description: row.description,
      approved_price: row.approved_price,
      supplier_ex_vat: row.supplier_ex_vat,
      hq_price: row.hq_price,
      pricing_method: row.pricing_method,
      source_status: row.status,
      accepted_increase: false,
      manually_adjusted: true,
      hq_markup_percent: row.hq_markup_percent,
      branch_markup_percent: row.branch_markup_percent,
      updated_at: row.updated_at,
    }));

    const saveApproved = await supabase
      .from("cubechem_approved_prices")
      .upsert(approvedRows, {
        onConflict: "price_month,ccd_item_code",
      });

    if (saveApproved.error) throw saveApproved.error;

    return NextResponse.json({
      message: "Bulk markup update saved.",
      updatedCount: updatedRows.length,
      rows: updatedRows.map((row: any) => ({
        itemCode: row.ccd_item_code,
        hqMarkupPercent: row.hq_markup_percent,
        branchMarkupPercent: row.branch_markup_percent,
        hqPrice: row.hq_price,
        finalPrice: row.approved_price,
        difference: row.difference,
        differencePercent: row.difference_percent,
        status: row.status,
      })),
    });
  } catch (error) {
    console.error("CubeChem bulk update markups error:", error);

    const message =
      error instanceof Error ? error.message : "Could not bulk update markups.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}