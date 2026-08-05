import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

async function getProposalId(context: any) {
  const params = await context.params;
  return String(params.id || "");
}

export async function GET(_req: Request, context: any) {
  try {
    const proposalId = await getProposalId(context);

    if (!proposalId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing proposal id.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .select(`
        id,
        proposal_number,
        client_id,
        client_name,
        contact_name,
        contact_email,
        prospect_company_name,
        prospect_contact_name,
        prospect_contact_email,
        prospect_contact_number,
        status,
        proposal_date,
        valid_until,
        package_code,
        package_name,
        package_description,
        package_monthly_fee,
        fee_is_exclusive_vat,
        monthly_fee,
        annual_fee,
        once_off_fee,
        introduction,
        notes,
        created_at,
        updated_at
      `)
      .eq("id", proposalId)
      .single();

    if (proposalError) throw proposalError;

    const { data: services, error: servicesError } = await supabase
      .from("proposal_services")
      .select(`
        id,
        service_code,
        category,
        service_name,
        description,
        fee_type,
        amount,
        included_in_package,
        scope_quantity,
        scope_unit,
        client_facing_note,
        sort_order
      `)
      .eq("proposal_id", proposalId)
      .order("sort_order", { ascending: true });

    if (servicesError) throw servicesError;

    return NextResponse.json({
      success: true,
      proposal,
      services: services || [],
    });
  } catch (error: any) {
    console.error("LOAD PROPOSAL ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unable to load proposal.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, context: any) {
  try {
    const proposalId = await getProposalId(context);
    const body = await req.json();

    if (!proposalId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing proposal id.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    if (body?.mode === "edit") {
      const {
        clientName,
        contactName,
        contactEmail,
        contactNumber,
        validUntil,
        packageCode,
        packageName,
        packageDescription,
        packageMonthlyFee,
        services,
      } = body;

      if (!String(clientName || "").trim()) {
        return NextResponse.json(
          {
            success: false,
            error: "Please enter the prospective client's name.",
          },
          { status: 400 }
        );
      }

      if (!String(packageName || "").trim()) {
        return NextResponse.json(
          {
            success: false,
            error: "Please enter a package name.",
          },
          { status: 400 }
        );
      }

      const selectedServices = Array.isArray(services) ? services : [];

      if (selectedServices.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Please select at least one service.",
          },
          { status: 400 }
        );
      }

      const monthlyFee = Number(packageMonthlyFee || 0);

      const { error: proposalUpdateError } = await supabase
        .from("proposals")
        .update({
          client_name: String(clientName).trim(),
          contact_name: String(contactName || "").trim() || null,
          contact_email: String(contactEmail || "").trim() || null,
          prospect_company_name: String(clientName).trim(),
          prospect_contact_name: String(contactName || "").trim() || null,
          prospect_contact_email: String(contactEmail || "").trim() || null,
          prospect_contact_number: String(contactNumber || "").trim() || null,
          valid_until: validUntil || null,
          package_code: packageCode || "custom",
          package_name: String(packageName).trim(),
          package_description: String(packageDescription || "").trim() || null,
          package_monthly_fee: Number.isFinite(monthlyFee) ? monthlyFee : 0,
          monthly_fee: Number.isFinite(monthlyFee) ? monthlyFee : 0,
          fee_is_exclusive_vat: true,
        })
        .eq("id", proposalId);

      if (proposalUpdateError) throw proposalUpdateError;

      const { error: deleteError } = await supabase
        .from("proposal_services")
        .delete()
        .eq("proposal_id", proposalId);

      if (deleteError) throw deleteError;

      const serviceRows = selectedServices.map((service: any, index: number) => ({
        proposal_id: proposalId,
        service_code: service.id || service.service_code || null,
        category: service.category || "Other Services",
        service_name: service.name || service.service_name || "Service",
        description: service.description || null,
        fee_type: service.feeType || service.fee_type || "Monthly",
        amount: 0,
        included_in_package: true,
        scope_quantity:
          service.scopeQuantity === "" ||
          service.scopeQuantity === null ||
          service.scopeQuantity === undefined
            ? null
            : Number(service.scopeQuantity),
        scope_unit: service.scopeUnit || null,
        client_facing_note: service.clientFacingNote || null,
        sort_order: index,
      }));

      const { error: servicesInsertError } = await supabase
        .from("proposal_services")
        .insert(serviceRows);

      if (servicesInsertError) throw servicesInsertError;

      return NextResponse.json({
        success: true,
        proposal_id: proposalId,
      });
    }

    const allowedStatuses = ["Draft", "Sent", "Accepted", "Declined"];
    const nextStatus = String(body?.status || "");

    if (!allowedStatuses.includes(nextStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid proposal status.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("proposals")
      .update({
        status: nextStatus,
      })
      .eq("id", proposalId)
      .select("id, status")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      proposal: data,
    });
  } catch (error: any) {
    console.error("UPDATE PROPOSAL ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unable to update proposal.",
      },
      { status: 500 }
    );
  }
}
