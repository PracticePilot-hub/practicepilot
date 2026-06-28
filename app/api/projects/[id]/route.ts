import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseSecretKey) {
  throw new Error("Missing SUPABASE_SECRET_KEY");
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(req: Request, context: RouteContext) {
  const { id } = await context.params;

  const { data, error } = await supabase
    .from("projects")
    .select(`
      *,
      organisations (
        id,
        name,
        logo_url
      )
    `)
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ project: data });
}

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await req.json();

  const updateData: Record<string, any> = {};

  if ("clientIncomeTotal" in body) {
    const value = Number(body.clientIncomeTotal || 0);

    if (!value || value <= 0) {
      return NextResponse.json(
        { error: "Client income total is required." },
        { status: 400 }
      );
    }

    updateData.client_income_total = value;
  }

  if ("clientIncomeVatMode" in body) {
    const vatMode = String(body.clientIncomeVatMode || "");

    if (!["Inclusive", "Exclusive", "No VAT"].includes(vatMode)) {
      return NextResponse.json(
        { error: "Client income VAT mode is invalid." },
        { status: 400 }
      );
    }

    updateData.client_income_vat_mode = vatMode;
  }

  if ("clientPaymentCount" in body) {
    const paymentCount = Number(body.clientPaymentCount || 0);

    if (!paymentCount || paymentCount <= 0) {
      return NextResponse.json(
        { error: "Client payment count is required." },
        { status: 400 }
      );
    }

    updateData.client_payment_count = paymentCount;
  }

  if ("clientPaymentPercentages" in body) {
    const percentages = Array.isArray(body.clientPaymentPercentages)
      ? body.clientPaymentPercentages.map((value: any) => Number(value || 0))
      : [];

    const totalPercentage = percentages.reduce((total: number, value: number) => total + value, 0);

    if (percentages.length === 0 || Math.abs(totalPercentage - 100) > 0.01) {
      return NextResponse.json(
        { error: "Client payment percentages must add up to 100%." },
        { status: 400 }
      );
    }

    updateData.client_payment_percentages = percentages;
  }

  if ("currentSupplierPhase" in body) {
    const currentSupplierPhase = Number(body.currentSupplierPhase || 0);

    if (!currentSupplierPhase || currentSupplierPhase <= 0) {
      return NextResponse.json(
        { error: "Current supplier phase is required." },
        { status: 400 }
      );
    }

    updateData.current_supplier_phase = currentSupplierPhase;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "No valid project fields supplied." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("projects")
    .update(updateData)
    .eq("id", id)
    .select(`
      *,
      organisations (
        id,
        name,
        logo_url
      )
    `)
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ project: data });
}
