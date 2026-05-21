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

async function getProjectId(context: any) {
  const params = await context.params;
  return String(params.id || "");
}

export async function GET(req: Request, context: any) {
  const id = await getProjectId(context);

  const { data, error } = await supabase
    .from("project_invoices")
    .select(`
      *,
      project_payments (
        id,
        payment_date,
        paid_amount
      )
    `)
    .eq("project_id", id)
    .order("phase_number", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invoices: data });
}

export async function POST(req: Request, context: any) {
  const id = await getProjectId(context);
  const body = await req.json();

  const phaseNumber = Number(body.phaseNumber || 0);
  const invoiceNumber = String(body.invoiceNumber || "").trim();
  const expectedAmount = Number(body.expectedAmount || 0);

  const invoiceDateRaw = body.invoiceDate;
  const invoicedAmountRaw = body.invoicedAmount;
  const paidAmountRaw = body.paidAmount;
  const paymentDateRaw = body.paymentDate;

  const invoiceDate =
    invoiceDateRaw === "" || invoiceDateRaw === null || invoiceDateRaw === undefined
      ? null
      : String(invoiceDateRaw);

  const invoicedAmount =
    invoicedAmountRaw === "" || invoicedAmountRaw === null || invoicedAmountRaw === undefined
      ? null
      : Number(invoicedAmountRaw);

  const paidAmount =
    paidAmountRaw === "" || paidAmountRaw === null || paidAmountRaw === undefined
      ? null
      : Number(paidAmountRaw);

  const paymentDate =
    paymentDateRaw === "" || paymentDateRaw === null || paymentDateRaw === undefined
      ? null
      : String(paymentDateRaw);

  if (!phaseNumber || phaseNumber <= 0) {
    return NextResponse.json({ error: "Phase number is required" }, { status: 400 });
  }

  if (!expectedAmount || expectedAmount <= 0) {
    return NextResponse.json({ error: "Expected amount is required" }, { status: 400 });
  }

  let status = "Not Invoiced";

  if (invoiceNumber && invoicedAmount !== null) {
    status = Math.abs(invoicedAmount - expectedAmount) < 0.01 ? "Matched" : "Difference";
  }

  const { data: existingInvoice, error: existingError } = await supabase
    .from("project_invoices")
    .select("id")
    .eq("project_id", id)
    .eq("phase_number", phaseNumber)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  let invoiceId = "";

  if (existingInvoice) {
    const { data, error } = await supabase
      .from("project_invoices")
      .update({
        invoice_number: invoiceNumber || null,
        invoice_date: invoiceDate,
        expected_amount: expectedAmount,
        invoiced_amount: invoicedAmount,
        status,
      })
      .eq("id", existingInvoice.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invoiceId = data.id;
  } else {
    const { data, error } = await supabase
      .from("project_invoices")
      .insert([
        {
          project_id: id,
          phase_number: phaseNumber,
          invoice_number: invoiceNumber || null,
          invoice_date: invoiceDate,
          expected_amount: expectedAmount,
          invoiced_amount: invoicedAmount,
          status,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invoiceId = data.id;
  }

  const { error: deletePaymentError } = await supabase
    .from("project_payments")
    .delete()
    .eq("invoice_id", invoiceId);

  if (deletePaymentError) {
    return NextResponse.json({ error: deletePaymentError.message }, { status: 500 });
  }

  if (paidAmount !== null) {
    const { error: paymentError } = await supabase
      .from("project_payments")
      .insert([
        {
          invoice_id: invoiceId,
          payment_date: paymentDate,
          paid_amount: paidAmount,
        },
      ]);

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }
  }

  const { data: invoice, error: finalError } = await supabase
    .from("project_invoices")
    .select(`
      *,
      project_payments (
        id,
        payment_date,
        paid_amount
      )
    `)
    .eq("id", invoiceId)
    .single();

  if (finalError) {
    return NextResponse.json({ error: finalError.message }, { status: 500 });
  }

  return NextResponse.json({ invoice });
}