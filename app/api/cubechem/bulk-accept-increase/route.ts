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

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const body = await req.json();

    const priceMonth = String(body.priceMonth || "");
    const itemCodes = Array.isArray(body.itemCodes)
      ? body.itemCodes.map((code: string) => String(code).toUpperCase())
      : [];

    if (!priceMonth || itemCodes.length === 0) {
      return NextResponse.json(
        { error: "Price month and selected item codes are required." },
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

    const rowsToAccept = (reviewRows.data || []).filter(
      (row: any) =>
        row.status === "INCREASE" &&
        row.manually_adjusted !== true &&
        row.approved_price !== null
    );

    if (rowsToAccept.length === 0) {
      return NextResponse.json(
        {
          error:
            "No selected items can be accepted. Only unadjusted increases can be bulk accepted.",
        },
        { status: 400 }
      );
    }

    const updatedReviewRows = rowsToAccept.map((row: any) => ({
      ...row,
      accepted_increase: true,
      manually_adjusted: false,
      updated_at: new Date().toISOString(),
    }));

    const saveReview = await supabase
      .from("cubechem_price_review_items")
      .upsert(updatedReviewRows, {
        onConflict: "price_month,ccd_item_code",
      });

    if (saveReview.error) throw saveReview.error;

    const approvedRows = updatedReviewRows.map((row: any) => ({
      price_month: row.price_month,
      ccd_item_code: row.ccd_item_code,
      description: row.description,
      approved_price: row.approved_price,
      supplier_ex_vat: row.supplier_ex_vat,
      hq_price: row.hq_price,
      pricing_method: row.pricing_method,
      source_status: row.status,
      accepted_increase: true,
      manually_adjusted: false,
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
      message: "Selected increases accepted.",
      acceptedCount: updatedReviewRows.length,
      rows: updatedReviewRows.map((row: any) => ({
        itemCode: row.ccd_item_code,
        acceptedIncrease: true,
        manuallyAdjusted: false,
      })),
    });
  } catch (error) {
    console.error("CubeChem bulk accept increase error:", error);

    const message =
      error instanceof Error ? error.message : "Could not bulk accept increases.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}