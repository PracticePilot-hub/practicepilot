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
    const itemCode = String(body.itemCode || "").toUpperCase();
    const finalPrice = Number(body.finalPrice);

    const calculatedPrice =
      body.calculatedPrice === null || body.calculatedPrice === undefined
        ? null
        : Number(body.calculatedPrice);

    if (!priceMonth || !itemCode) {
      return NextResponse.json(
        { error: "Price month and item code are required." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(finalPrice)) {
      return NextResponse.json(
        { error: "Final price must be a valid number." },
        { status: 400 }
      );
    }

    const monthDate = toMonthDate(priceMonth);

    const isManualAdjustment =
      calculatedPrice !== null && finalPrice !== calculatedPrice;

    const overrideReason =
      calculatedPrice !== null && finalPrice < calculatedPrice
        ? `Save R ${(calculatedPrice - finalPrice).toFixed(2)}`
        : null;

    const updateReview = await supabase
      .from("cubechem_price_review_items")
      .update({
        approved_price: finalPrice,
        override_reason: overrideReason,
        manually_adjusted: isManualAdjustment,
        accepted_increase: isManualAdjustment ? false : true,
        updated_at: new Date().toISOString(),
      })
      .eq("price_month", monthDate)
      .eq("ccd_item_code", itemCode)
      .select("id")
      .single();

    if (updateReview.error) {
      throw updateReview.error;
    }

    const reviewRow = await supabase
      .from("cubechem_price_review_items")
      .select("*")
      .eq("price_month", monthDate)
      .eq("ccd_item_code", itemCode)
      .single();

    if (reviewRow.error) {
      throw reviewRow.error;
    }

    const saveFinal = await supabase
      .from("cubechem_approved_prices")
      .upsert(
        {
          price_month: monthDate,
          ccd_item_code: itemCode,
          description: reviewRow.data.description,
          approved_price: finalPrice,
          supplier_ex_vat: reviewRow.data.supplier_ex_vat,
          hq_price: reviewRow.data.hq_price,
          pricing_method: reviewRow.data.pricing_method,
          source_status: reviewRow.data.status,
          accepted_increase: isManualAdjustment ? false : true,
          manually_adjusted: isManualAdjustment,
          hq_markup_percent: reviewRow.data.hq_markup_percent,
          branch_markup_percent: reviewRow.data.branch_markup_percent,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "price_month,ccd_item_code",
        }
      );

    if (saveFinal.error) {
      throw saveFinal.error;
    }

    return NextResponse.json({
      message: "Final price saved.",
      itemCode,
      finalPrice,
      overrideReason,
      manuallyAdjusted: isManualAdjustment,
      acceptedIncrease: isManualAdjustment ? false : true,
    });
  } catch (error) {
    console.error("CubeChem update final price error:", error);

    const message =
      error instanceof Error ? error.message : "Could not save final price.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}