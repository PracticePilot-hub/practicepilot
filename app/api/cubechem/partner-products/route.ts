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

function normaliseCodes(values: unknown) {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

export async function GET(req: NextRequest) {
  try {
    const access = await verifyAccess(req);

    if (!access.allowed) {
      return access.response;
    }

    const partnerId = String(
      req.nextUrl.searchParams.get("partnerId") || ""
    ).trim();

    if (!partnerId) {
      return NextResponse.json(
        { error: "Partner ID is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const partnerResult = await supabase
      .from("cubechem_sales_partners")
      .select("id, partner_type, name, telephone, purchase_markup_percent")
      .eq("id", partnerId)
      .maybeSingle();

    if (partnerResult.error) {
      throw partnerResult.error;
    }

    if (!partnerResult.data) {
      return NextResponse.json(
        { error: "Partner could not be found." },
        { status: 404 }
      );
    }

    const productsResult = await supabase
      .from("cubechem_partner_products")
      .select("id, item_code")
      .eq("partner_id", partnerId)
      .order("item_code", { ascending: true });

    if (productsResult.error) {
      throw productsResult.error;
    }

    return NextResponse.json({
      partner: partnerResult.data,
      itemCodes: (productsResult.data || []).map((row) => row.item_code),
      products: productsResult.data || [],
    });
  } catch (error) {
    console.error("CubeChem partner products load error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load partner products.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await verifyAccess(req);

    if (!access.allowed) {
      return access.response;
    }

    const body = await req.json();

    const partnerId = String(body.partnerId || "").trim();
    const itemCodes = normaliseCodes(body.itemCodes);

    if (!partnerId) {
      return NextResponse.json(
        { error: "Partner ID is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const partnerResult = await supabase
      .from("cubechem_sales_partners")
      .select("id, partner_type, name")
      .eq("id", partnerId)
      .maybeSingle();

    if (partnerResult.error) {
      throw partnerResult.error;
    }

    if (!partnerResult.data) {
      return NextResponse.json(
        { error: "Partner could not be found." },
        { status: 404 }
      );
    }

    if (partnerResult.data.partner_type !== "ALLIANCE_PARTNER") {
      return NextResponse.json(
        {
          error:
            "Product selection currently applies only to Alliance Partners.",
        },
        { status: 400 }
      );
    }

    const deleteResult = await supabase
      .from("cubechem_partner_products")
      .delete()
      .eq("partner_id", partnerId);

    if (deleteResult.error) {
      throw deleteResult.error;
    }

    if (itemCodes.length > 0) {
      const rowsToInsert = itemCodes.map((itemCode) => ({
        partner_id: partnerId,
        item_code: itemCode,
      }));

      const insertResult = await supabase
        .from("cubechem_partner_products")
        .insert(rowsToInsert);

      if (insertResult.error) {
        throw insertResult.error;
      }
    }

    return NextResponse.json({
      partnerId,
      itemCodes,
      selectedCount: itemCodes.length,
      message: `${itemCodes.length} products saved for ${partnerResult.data.name}.`,
    });
  } catch (error) {
    console.error("CubeChem partner products save error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not save partner products.",
      },
      { status: 500 }
    );
  }
}