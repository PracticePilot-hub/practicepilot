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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const organisationId = searchParams.get("organisationId");
  const projectId = searchParams.get("projectId");

  let query = supabase
    .from("project_contractors")
    .select("*")
    .order("contractor_name", { ascending: true });

  if (organisationId) {
    query = query.eq("organisation_id", organisationId);
  }

if (projectId) {
  query = query.eq("project_id", projectId);
}
  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contractors: data || [] });
}

export async function POST(req: Request) {
  const body = await req.json();

if (String(body.action || "").trim() === "delete") {
  const contractorId = String(body.contractorId || "").trim();

  if (!contractorId) {
    return NextResponse.json({ error: "Contractor ID is required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("project_contractors")
    .delete()
    .eq("id", contractorId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}


  if (body.action === "update") {
  const contractorId = String(body.contractorId || "").trim();

  if (!contractorId) {
    return NextResponse.json({ error: "Contractor ID is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("project_contractors")
    .update({
      contractor_name: String(body.contractorName || "").trim(),
      contact_person: String(body.contactPerson || "").trim() || null,
      email: String(body.email || "").trim() || null,
      phone: String(body.phone || "").trim() || null,
      trade_category: String(body.tradeCategory || "").trim() || null,
      vat_number: String(body.vatNumber || "").trim() || null,
      address: String(body.address || "").trim() || null,
      bank_details: String(body.bankDetails || "").trim() || null,
      payment_terms: String(body.paymentTerms || "").trim() || null,
    })
    .eq("id", contractorId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contractor: data });
}

  const organisationId = String(body.organisationId || "").trim();
  const projectId = String(body.projectId || "").trim() || null;
  const contractorName = String(body.contractorName || "").trim();
  const address = String(body.address || "").trim() || null;
const bankDetails = String(body.bankDetails || "").trim() || null;
const vatNumber = String(body.vatNumber || "").trim() || null;
const paymentTerms = String(body.paymentTerms || "").trim() || null;

  if (!organisationId) {
    return NextResponse.json({ error: "Organisation is required." }, { status: 400 });
  }

  if (!contractorName) {
    return NextResponse.json({ error: "Contractor name is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("project_contractors")
    .insert({
        organisation_id: organisationId,
  contractor_name: contractorName,
  contact_person: String(body.contactPerson || "").trim() || null,
  email: String(body.email || "").trim() || null,
  phone: String(body.phone || "").trim() || null,
  trade_category: String(body.tradeCategory || "").trim() || null,
  vat_number: vatNumber,
  address,
  bank_details: bankDetails,
  payment_terms: paymentTerms,
  notes: String(body.notes || "").trim() || null,
  access_enabled: true,
  project_id: projectId,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contractor: data });
}

