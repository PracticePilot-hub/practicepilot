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
    const accepted = Boolean(body.accepted);

    if (!priceMonth || !itemCode) {
      return NextResponse.json(
        { error: "Price month and item code are required." },
        { status: 400 }
      );
    }

    const monthDate = toMonthDate(priceMonth);

    const updateReview = await supabase
      .from("cubechem_price_review_items")
      .update({
        accepted_increase: accepted,
        manually_adjusted: false,
        updated_at: new Date().toISOString(),
      })
      .eq("price_month", monthDate)
      .eq("ccd_item_code", itemCode);

    if (updateReview.error) throw updateReview.error;

    const updateApproved = await supabase
      .from("cubechem_approved_prices")
      .update({
        accepted_increase: accepted,
        manually_adjusted: false,
        updated_at: new Date().toISOString(),
      })
      .eq("price_month", monthDate)
      .eq("ccd_item_code", itemCode);

    if (updateApproved.error) throw updateApproved.error;

    return NextResponse.json({
      message: "Increase acceptance saved.",
      itemCode,
      accepted,
    });
  } catch (error) {
    console.error("CubeChem accept increase error:", error);

    const message =
      error instanceof Error ? error.message : "Could not save accept increase.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}