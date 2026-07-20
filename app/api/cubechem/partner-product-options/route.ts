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
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

async function verifyAccess(
  req: NextRequest
): Promise<
  | { allowed: true; response: null }
  | { allowed: false; response: NextResponse }
> {
  const requestEmail = getRequestEmail(req);
  const access = await checkCubeChemAccess(requestEmail);

  if (!access.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: "You do not have access to CubeChem." },
        { status: 403 }
      ),
    };
  }

  return {
    allowed: true,
    response: null,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String((error as { message: unknown }).message);
  }

  return fallback;
}

function toMonthDate(value: string) {
  return `${value}-01`;
}

export async function GET(req: NextRequest) {
  try {
    const access = await verifyAccess(req);

    if (!access.allowed) {
      return access.response;
    }

    const priceMonth = String(
      req.nextUrl.searchParams.get("priceMonth") || ""
    ).trim();

    if (!priceMonth) {
      return NextResponse.json(
        { error: "Price month is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const monthDate = toMonthDate(priceMonth);

    const uploadsResult = await supabase
      .from("cubechem_price_uploads")
      .select("id, price_month, file_name")
      .eq("price_month", monthDate)
      .limit(1);

    if (uploadsResult.error) {
      throw uploadsResult.error;
    }

    const upload = uploadsResult.data?.[0];

    if (!upload) {
      return NextResponse.json(
        {
          error: `No Abyx price list has been uploaded for ${priceMonth}.`,
        },
        { status: 404 }
      );
    }

    const itemsResult = await supabase
      .from("cubechem_price_items")
      .select("item_code, description, supplier_ex_vat")
      .eq("upload_id", upload.id)
      .order("description", { ascending: true });

    if (itemsResult.error) {
      throw itemsResult.error;
    }

    const products = (itemsResult.data || [])
      .filter(
        (item) =>
          item.item_code &&
          item.description &&
          item.supplier_ex_vat !== null
      )
      .map((item) => ({
        itemCode: String(item.item_code).trim().toUpperCase(),
        description: String(item.description).trim(),
        supplierExVat: Number(item.supplier_ex_vat),
      }));

    return NextResponse.json({
      priceMonth,
      upload,
      products,
      productCount: products.length,
    });
  } catch (error: unknown) {
    console.error("CubeChem partner product options error:", error);

    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Could not load available partner products."
        ),
      },
      { status: 500 }
    );
  }
}