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

async function getProjectId(context: RouteContext) {
  const params = await context.params;
  return String(params.id || "");
}

export async function GET(req: Request, context: RouteContext) {
  const projectId = await getProjectId(context);

  const { data, error } = await supabase
    .from("project_supplier_payments")
    .select(`
      *,
      project_line_items (
        id,
        description,
        amount,
        vat_mode
      ),
      project_contractors (
        id,
        contractor_name,
        trade_category
      ),
      project_phase_splits (
        id,
        phase_number,
        percentage,
        calculated_amount,
        override_amount,
        override_type
      )
    `)
    .eq("project_id", projectId)
    .order("supplier_phase_number", { ascending: true })
    .order("payment_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ supplierPayments: data || [] });
}

export async function POST(req: Request, context: RouteContext) {
  const projectId = await getProjectId(context);
  const body = await req.json();

  const lineItemId = String(body.lineItemId || "").trim();
  const phaseSplitId = String(body.phaseSplitId || "").trim() || null;
  const contractorId = String(body.contractorId || "").trim() || null;
  const supplierPhaseNumber = Number(body.supplierPhaseNumber || 0);
  const paidAmount = Number(body.paidAmount || 0);

  const paymentDate =
    body.paymentDate === "" || body.paymentDate === null || body.paymentDate === undefined
      ? null
      : String(body.paymentDate);

  const popFilePath =
    body.popFilePath === "" || body.popFilePath === null || body.popFilePath === undefined
      ? null
      : String(body.popFilePath);

  const popFileName =
    body.popFileName === "" || body.popFileName === null || body.popFileName === undefined
      ? null
      : String(body.popFileName);

  const notes =
    body.notes === "" || body.notes === null || body.notes === undefined
      ? null
      : String(body.notes);

  if (!lineItemId) {
    return NextResponse.json({ error: "Line item is required." }, { status: 400 });
  }

  if (!supplierPhaseNumber || supplierPhaseNumber <= 0) {
    return NextResponse.json({ error: "Supplier phase number is required." }, { status: 400 });
  }

  if (!paidAmount || paidAmount <= 0) {
    return NextResponse.json({ error: "Paid amount is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("project_supplier_payments")
    .insert([
      {
        project_id: projectId,
        line_item_id: lineItemId,
        phase_split_id: phaseSplitId,
        contractor_id: contractorId,
        supplier_phase_number: supplierPhaseNumber,
        paid_amount: paidAmount,
        payment_date: paymentDate,
        pop_file_path: popFilePath,
        pop_file_name: popFileName,
        notes,
      },
    ])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ supplierPayment: data });
}

export async function PATCH(req: Request, context: RouteContext) {
  const projectId = await getProjectId(context);
  const body = await req.json();

  const supplierPaymentId = String(body.supplierPaymentId || "").trim();

  if (!supplierPaymentId) {
    return NextResponse.json({ error: "Supplier payment ID is required." }, { status: 400 });
  }

  const paidAmount =
    body.paidAmount === "" || body.paidAmount === null || body.paidAmount === undefined
      ? null
      : Number(body.paidAmount);

  const paymentDate =
    body.paymentDate === "" || body.paymentDate === null || body.paymentDate === undefined
      ? null
      : String(body.paymentDate);

  const notes =
    body.notes === "" || body.notes === null || body.notes === undefined
      ? null
      : String(body.notes);

  const popFilePath =
    body.popFilePath === "" || body.popFilePath === null || body.popFilePath === undefined
      ? null
      : String(body.popFilePath);

  const popFileName =
    body.popFileName === "" || body.popFileName === null || body.popFileName === undefined
      ? null
      : String(body.popFileName);

  const { data, error } = await supabase
    .from("project_supplier_payments")
    .update({
      paid_amount: paidAmount,
      payment_date: paymentDate,
      notes,
      pop_file_path: popFilePath,
      pop_file_name: popFileName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", supplierPaymentId)
    .eq("project_id", projectId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ supplierPayment: data });
}

export async function DELETE(req: Request, context: RouteContext) {
  const projectId = await getProjectId(context);
  const body = await req.json();

  const supplierPaymentId = String(body.supplierPaymentId || "").trim();

  if (!supplierPaymentId) {
    return NextResponse.json({ error: "Supplier payment ID is required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("project_supplier_payments")
    .delete()
    .eq("id", supplierPaymentId)
    .eq("project_id", projectId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}