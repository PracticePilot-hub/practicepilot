import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    const supabase = getSupabaseAdmin();

    const body = await req.json();

    const priceMonth = String(body.priceMonth || "");
    const itemCode = String(body.itemCode || "").toUpperCase();
    const hqMarkupPercent = Number(body.hqMarkupPercent);
    const branchMarkupPercent = Number(body.branchMarkupPercent);

    if (!priceMonth || !itemCode) {
      return NextResponse.json(
        { error: "Price month and item code are required." },
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

    const reviewRow = await supabase
      .from("cubechem_price_review_items")
      .select("*")
      .eq("price_month", monthDate)
      .eq("ccd_item_code", itemCode)
      .single();

    if (reviewRow.error) throw reviewRow.error;

    const supplierExVat = Number(reviewRow.data.supplier_ex_vat || 0);

    if (!supplierExVat || supplierExVat <= 0) {
      return NextResponse.json(
        { error: "This item has no supplier cost to recalculate from." },
        { status: 400 }
      );
    }

    const prices = calculatePricesFromCost(
      supplierExVat,
      hqMarkupPercent,
      branchMarkupPercent
    );

    const previousPrice = Number(reviewRow.data.previous_approved_price || 0);
    const difference = prices.branchPrice - previousPrice;
    const differencePercent =
      previousPrice > 0 ? (difference / previousPrice) * 100 : 0;

    const status =
      difference > 0 ? "INCREASE" : difference < 0 ? "DECREASE" : "NO CHANGE";

    const updateReview = await supabase
      .from("cubechem_price_review_items")
      .update({
        hq_markup_percent: hqMarkupPercent,
        branch_markup_percent: branchMarkupPercent,
        hq_price: prices.hqPrice,
        calculated_price: prices.branchPrice,
        approved_price: prices.branchPrice,
        difference,
        difference_percent: differencePercent,
        status,
        accepted_increase: false,
        manually_adjusted: true,
        updated_at: new Date().toISOString(),
      })
      .eq("price_month", monthDate)
      .eq("ccd_item_code", itemCode);

    if (updateReview.error) throw updateReview.error;

    const saveApproved = await supabase
      .from("cubechem_approved_prices")
      .upsert(
        {
          price_month: monthDate,
          ccd_item_code: itemCode,
          description: reviewRow.data.description,
          approved_price: prices.branchPrice,
          supplier_ex_vat: supplierExVat,
          hq_price: prices.hqPrice,
          pricing_method: reviewRow.data.pricing_method,
          source_status: status,
          accepted_increase: false,
          manually_adjusted: true,
          hq_markup_percent: hqMarkupPercent,
          branch_markup_percent: branchMarkupPercent,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "price_month,ccd_item_code",
        }
      );

    if (saveApproved.error) throw saveApproved.error;

    return NextResponse.json({
      message: "Markup percentages saved.",
      itemCode,
      hqMarkupPercent,
      branchMarkupPercent,
      hqPrice: prices.hqPrice,
      finalPrice: prices.branchPrice,
      difference,
      differencePercent,
      status,
    });
  } catch (error) {
    console.error("CubeChem update markups error:", error);

    const message =
      error instanceof Error ? error.message : "Could not update markups.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}