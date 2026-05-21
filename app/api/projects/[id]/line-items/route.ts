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

type PhaseInput = {
  phaseNumber: number;
  percentage: number;
};

function calculateTotal(amount: number, vatMode: string) {
  if (vatMode === "Inclusive") {
    return amount;
  }

  return amount * 1.15;
}

function validateLineItemInput(body: any) {
  const description = String(body.description || "").trim();
  const amount = Number(body.amount || 0);
  const vatMode = String(body.vatMode || "");
  const phases = body.phases || [];

  if (!description) {
    return { error: "Description is required" };
  }

  if (!amount || amount <= 0) {
    return { error: "Amount is required" };
  }

  if (!["Inclusive", "Exclusive"].includes(vatMode)) {
    return { error: "VAT mode is invalid" };
  }

  if (!Array.isArray(phases) || phases.length === 0) {
    return { error: "Phase split is required" };
  }

  const totalPercentage = phases.reduce(
    (total: number, phase: PhaseInput) => total + Number(phase.percentage || 0),
    0
  );

  if (totalPercentage !== 0 && totalPercentage !== 100) {
  return { error: "Phase percentages must add up to 0% or 100%." };
}

  return {
    description,
    amount,
    vatMode,
    phases,
    contractorId: String(body.contractorId || "").trim() || null,
  };
}

export async function GET(req: Request, context: RouteContext) {
  const { id } = await context.params;

  const { data: lineItems, error } = await supabase
    .from("project_line_items")
.select(`
  id,
  project_id,
  description,
  amount,
  vat_mode,
  contractor_id,
  created_at,
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
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lineItems });
}

export async function POST(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await req.json();

  const validation = validateLineItemInput(body);

  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { description, amount, vatMode, phases, contractorId } = validation;

  const { data: lineItem, error: lineItemError } = await supabase
    .from("project_line_items")
    .insert([
      {
        project_id: id,
        description,
        amount,
        vat_mode: vatMode,
        contractor_id: contractorId,
      },
    ])
    .select(`
  *,
  project_contractors (
    id,
    contractor_name,
    trade_category
  )
`)
    .single();

  if (lineItemError) {
    return NextResponse.json({ error: lineItemError.message }, { status: 500 });
  }

  const totalIncludingVat = calculateTotal(amount, vatMode);

  const phaseRows = phases.map((phase: PhaseInput) => ({
    line_item_id: lineItem.id,
    phase_number: Number(phase.phaseNumber),
    percentage: Number(phase.percentage),
    calculated_amount: totalIncludingVat * (Number(phase.percentage) / 100),
    override_amount: null,
  }));

  const { error: phaseError } = await supabase
    .from("project_phase_splits")
    .insert(phaseRows);

  if (phaseError) {
    return NextResponse.json({ error: phaseError.message }, { status: 500 });
  }

  return NextResponse.json({ lineItem });
}

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await req.json();

  const lineItemId = String(body.lineItemId || "");

  if (!lineItemId) {
    return NextResponse.json({ error: "Line item ID is required" }, { status: 400 });
  }

  const validation = validateLineItemInput(body);

  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { description, amount, vatMode, phases, contractorId } = validation;

  const { data: lineItem, error: updateError } = await supabase
    .from("project_line_items")
    .update({
      description,
      amount,
      vat_mode: vatMode,
      contractor_id: contractorId,
    })
    .eq("id", lineItemId)
    .eq("project_id", id)
    .select(`
  *,
  project_contractors (
    id,
    contractor_name,
    trade_category
  )
`)
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: deletePhaseError } = await supabase
    .from("project_phase_splits")
    .delete()
    .eq("line_item_id", lineItemId);

  if (deletePhaseError) {
    return NextResponse.json({ error: deletePhaseError.message }, { status: 500 });
  }

  const totalIncludingVat = calculateTotal(amount, vatMode);

  const phaseRows = phases.map((phase: PhaseInput) => ({
    line_item_id: lineItemId,
    phase_number: Number(phase.phaseNumber),
    percentage: Number(phase.percentage),
    calculated_amount: totalIncludingVat * (Number(phase.percentage) / 100),
    override_amount: null,
  }));

  const { error: insertPhaseError } = await supabase
    .from("project_phase_splits")
    .insert(phaseRows);

  if (insertPhaseError) {
    return NextResponse.json({ error: insertPhaseError.message }, { status: 500 });
  }

  return NextResponse.json({ lineItem });
}

export async function PUT(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await req.json();

  const phaseSplitId = String(body.phaseSplitId || "").trim();
  const overrideAmount =
    body.overrideAmount === null || body.overrideAmount === ""
    
    
      ? null
      : Number(body.overrideAmount);

      const overrideType =
  overrideAmount === null ? null : String(body.overrideType || "manual");



  if (!phaseSplitId) {
    return NextResponse.json({ error: "Phase split ID is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("project_phase_splits")
.update({
  override_amount: overrideAmount,
  override_type: overrideType,
})
    .eq("id", phaseSplitId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await req.json();

  if (body.action === "delete-all") {
  const { error } = await supabase
    .from("project_line_items")
    .delete()
    .eq("project_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

  const lineItemId = String(body.lineItemId || "");

  if (!lineItemId) {
    return NextResponse.json({ error: "Line item ID is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("project_line_items")
    .delete()
    .eq("id", lineItemId)
    .eq("project_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}