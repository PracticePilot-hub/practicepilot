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

export async function GET(req: NextRequest) {
  try {
    const access = await verifyAccess(req);

    if (!access.allowed) {
      return access.response;
    }

    const supabase = getSupabaseAdmin();

    const result = await supabase
      .from("cubechem_sales_partners")
      .select(`
        id,
        partner_type,
        name,
        telephone,
        purchase_markup_percent,
        public_price_list_enabled,
        is_active,
        created_at,
        updated_at,
        cubechem_partner_products (
          id,
          item_code
        )
      `)
      .order("partner_type", { ascending: true })
      .order("name", { ascending: true });

    if (result.error) {
      throw result.error;
    }

    return NextResponse.json({
      partners: result.data || [],
    });
  } catch (error: unknown) {
    console.error("CubeChem partner list error:", error);

    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Could not load CubeChem partners."
        ),
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

    const partnerType = String(body.partnerType || "")
      .trim()
      .toUpperCase();

    const name = String(body.name || "").trim();
    const telephone = String(body.telephone || "").trim();

    const purchaseMarkupPercent =
      body.purchaseMarkupPercent === null ||
      body.purchaseMarkupPercent === undefined ||
      body.purchaseMarkupPercent === ""
        ? partnerType === "ALLIANCE_PARTNER"
          ? 20
          : null
        : Number(body.purchaseMarkupPercent);

    if (!["AGENT", "ALLIANCE_PARTNER"].includes(partnerType)) {
      return NextResponse.json(
        { error: "Please select a valid partner type." },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Partner name is required." },
        { status: 400 }
      );
    }

    if (
      purchaseMarkupPercent !== null &&
      !Number.isFinite(purchaseMarkupPercent)
    ) {
      return NextResponse.json(
        { error: "Please enter a valid purchase markup percentage." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const result = await supabase
      .from("cubechem_sales_partners")
      .insert({
        partner_type: partnerType,
        name,
        telephone: telephone || null,
        purchase_markup_percent: purchaseMarkupPercent,
        public_price_list_enabled:
          body.publicPriceListEnabled === undefined
            ? true
            : Boolean(body.publicPriceListEnabled),
        is_active:
          body.isActive === undefined
            ? true
            : Boolean(body.isActive),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (result.error) {
      throw result.error;
    }

    return NextResponse.json({
      partner: result.data,
      message: `${name} added successfully.`,
    });
  } catch (error: unknown) {
    console.error("CubeChem partner create error:", error);

    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Could not add CubeChem partner."
        ),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await verifyAccess(req);

    if (!access.allowed) {
      return access.response;
    }

    const body = await req.json();

    const id = String(body.id || "").trim();
    const name = String(body.name || "").trim();
    const telephone = String(body.telephone || "").trim();

    const partnerType = String(body.partnerType || "")
      .trim()
      .toUpperCase();

    const purchaseMarkupPercent =
      body.purchaseMarkupPercent === null ||
      body.purchaseMarkupPercent === undefined ||
      body.purchaseMarkupPercent === ""
        ? null
        : Number(body.purchaseMarkupPercent);

    if (!id) {
      return NextResponse.json(
        { error: "Partner ID is required." },
        { status: 400 }
      );
    }

    if (!["AGENT", "ALLIANCE_PARTNER"].includes(partnerType)) {
      return NextResponse.json(
        { error: "Please select a valid partner type." },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Partner name is required." },
        { status: 400 }
      );
    }

    if (
      purchaseMarkupPercent !== null &&
      !Number.isFinite(purchaseMarkupPercent)
    ) {
      return NextResponse.json(
        { error: "Please enter a valid purchase markup percentage." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const result = await supabase
      .from("cubechem_sales_partners")
      .update({
        partner_type: partnerType,
        name,
        telephone: telephone || null,
        purchase_markup_percent: purchaseMarkupPercent,
        public_price_list_enabled:
          body.publicPriceListEnabled === undefined
            ? true
            : Boolean(body.publicPriceListEnabled),
        is_active:
          body.isActive === undefined
            ? true
            : Boolean(body.isActive),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (result.error) {
      throw result.error;
    }

    return NextResponse.json({
      partner: result.data,
      message: `${name} updated successfully.`,
    });
  } catch (error: unknown) {
    console.error("CubeChem partner update error:", error);

    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Could not update CubeChem partner."
        ),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const access = await verifyAccess(req);

    if (!access.allowed) {
      return access.response;
    }

    const body = await req.json();
    const id = String(body.id || "").trim();

    if (!id) {
      return NextResponse.json(
        { error: "Partner ID is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const result = await supabase
      .from("cubechem_sales_partners")
      .delete()
      .eq("id", id);

    if (result.error) {
      throw result.error;
    }

    return NextResponse.json({
      message: "Partner deleted successfully.",
    });
  } catch (error: unknown) {
    console.error("CubeChem partner delete error:", error);

    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Could not delete CubeChem partner."
        ),
      },
      { status: 500 }
    );
  }
}