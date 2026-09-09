import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) throw new Error("Missing Supabase admin environment variables.");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type StepInput = {
  label: string;
  item_type?: "manual" | "dependency" | "review" | "submission";
  is_active?: boolean;
  is_required?: boolean;
  allow_not_applicable?: boolean;
  dependency_service_code?: string | null;
  dependency_rule?: string | null;
};

const SYSTEM_DEFAULTS: Record<string, StepInput[]> = {
  Accounting: [
    { label: "All bank statements received" },
    { label: "Bank reconciliations completed" },
    { label: "Debtors / creditors reviewed where applicable" },
    { label: "Control accounts reconciled" },
    { label: "Unusual / suspense items cleared" },
    { label: "Accounting reviewed", item_type: "review" },
  ],
  Payroll: [
    { label: "Payroll input / changes received" },
    { label: "New employees / terminations checked" },
    { label: "Payroll processed" },
    { label: "Deductions and employer contributions checked" },
    { label: "Payroll reviewed", item_type: "review" },
    { label: "Payslips / payment information issued", item_type: "submission" },
  ],
  EMP201: [
    {
      label: "Payroll for the month completed",
      item_type: "dependency",
      dependency_service_code: "Payroll",
      dependency_rule: "covered_period_all_completed",
      allow_not_applicable: false,
    },
    { label: "PAYE / UIF / SDL reconciled" },
    { label: "EMP201 reviewed", item_type: "review" },
    { label: "EMP201 submitted", item_type: "submission" },
    { label: "Payment instruction / proof filed", item_type: "submission" },
  ],
  UIF: [
    {
      label: "Payroll for the month completed",
      item_type: "dependency",
      dependency_service_code: "Payroll",
      dependency_rule: "covered_period_all_completed",
      allow_not_applicable: false,
    },
    { label: "UIF contributor information checked" },
    { label: "UIF declaration submitted", item_type: "submission" },
    { label: "Submission proof filed", item_type: "submission" },
  ],
  VAT201: [
    {
      label: "Accounting for the VAT period completed",
      item_type: "dependency",
      dependency_service_code: "Accounting",
      dependency_rule: "covered_period_all_completed",
      allow_not_applicable: false,
    },
    { label: "Bank reconciliations completed" },
    { label: "Sales reconciled to VAT output" },
    { label: "Purchases reconciled to VAT input" },
    { label: "Exceptions / unusual transactions checked" },
    { label: "VAT control account reconciled" },
    { label: "Supporting documents complete" },
    { label: "Return reviewed", item_type: "review" },
    { label: "Ready for submission" },
    { label: "Submitted and proof filed", item_type: "submission" },
  ],
  EMP501: [
    {
      label: "EMP201 periods for the reconciliation period completed",
      item_type: "dependency",
      dependency_service_code: "EMP201",
      dependency_rule: "covered_period_all_completed",
      allow_not_applicable: false,
    },
    { label: "Payroll reconciliation completed" },
    { label: "IRP5 / IT3(a) data checked" },
    { label: "ETI reviewed where applicable" },
    { label: "EasyFile / validation errors cleared" },
    { label: "EMP501 reviewed", item_type: "review" },
    { label: "Submitted and proof filed", item_type: "submission" },
  ],
  "Provisional Tax": [
    { label: "Latest accounting / management information available" },
    { label: "Estimated taxable income calculated" },
    { label: "Prior assessment / basic amount considered" },
    { label: "Provisional tax calculation reviewed", item_type: "review" },
    { label: "IRP6 submitted", item_type: "submission" },
    { label: "Payment instruction / proof filed", item_type: "submission" },
  ],
  "Financial Statements": [
    {
      label: "Accounting for the financial year completed",
      item_type: "dependency",
      dependency_service_code: "Accounting",
      dependency_rule: "covered_period_all_completed",
      allow_not_applicable: false,
    },
    { label: "Trial balance / import complete" },
    { label: "Mapping complete" },
    { label: "Lead schedules complete" },
    { label: "Financial statements prepared" },
    { label: "Tax balances reconciled" },
    { label: "Review points cleared" },
    { label: "Financial statements reviewed", item_type: "review" },
    { label: "Final sign-off complete", item_type: "submission" },
  ],
  "Income Tax": [
    {
      label: "Financial statements for the tax year completed",
      item_type: "dependency",
      dependency_service_code: "Financial Statements",
      dependency_rule: "same_period_all_completed",
      allow_not_applicable: false,
    },
    { label: "Tax computation completed" },
    { label: "Tax return prepared" },
    { label: "Tax return reviewed", item_type: "review" },
    { label: "Return submitted and proof filed", item_type: "submission" },
  ],
  "CIPC Annual Return": [
    { label: "Company information confirmed" },
    { label: "Turnover / annual return information confirmed" },
    { label: "Annual return filed", item_type: "submission" },
    { label: "Filing confirmation stored", item_type: "submission" },
  ],
  "Beneficial Ownership Declaration": [
    { label: "Shareholding information confirmed" },
    { label: "Beneficial ownership structure reviewed" },
    { label: "Beneficial owners confirmed" },
    { label: "Declaration filed", item_type: "submission" },
    { label: "Filing confirmation stored", item_type: "submission" },
  ],
  "Workmans Compensation": [
    { label: "Payroll / earnings information for the return period confirmed" },
    { label: "Return of Earnings information prepared" },
    { label: "Assessment / submission reviewed", item_type: "review" },
    { label: "Return submitted", item_type: "submission" },
    { label: "Submission proof filed", item_type: "submission" },
  ],
  "WCA Letter of Good Standing": [
    {
      label: "Workman's Compensation return / assessment up to date",
      item_type: "dependency",
      dependency_service_code: "Workmans Compensation",
      dependency_rule: "covered_period_all_completed",
      allow_not_applicable: false,
    },
    { label: "Outstanding assessment balance checked" },
    { label: "Letter of Good Standing requested / renewed", item_type: "submission" },
    { label: "Current Letter of Good Standing filed", item_type: "submission" },
  ],
  "Management Reports": [
    {
      label: "Accounting for the reporting period completed",
      item_type: "dependency",
      dependency_service_code: "Accounting",
      dependency_rule: "covered_period_all_completed",
      allow_not_applicable: false,
    },
    { label: "Management report pack prepared" },
    { label: "Material variances investigated" },
    { label: "Report reviewed", item_type: "review" },
    { label: "Report issued to client", item_type: "submission" },
  ],
};

function getBearerToken(request: Request) {
  return String(request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

async function currentProfile(request: Request, supabase: ReturnType<typeof getSupabaseAdmin>) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      profile: null as any,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return {
      profile: null as any,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("user_id, organisation_id, role, access_enabled, can_access_crm, can_manage_practice_users")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (error || !profile || profile.access_enabled === false) {
    return {
      profile: null as any,
      response: NextResponse.json({ error: "Access denied." }, { status: 403 }),
    };
  }

  return { profile, response: null as NextResponse | null };
}

function canManage(profile: any) {
  return (
    profile.role === "Super Admin" ||
    profile.role === "Admin" ||
    profile.role === "Client Manager" ||
    profile.can_manage_practice_users === true
  );
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { profile, response } = await currentProfile(request, supabase);
    if (response) return response;

    if (!profile.organisation_id && !["Super Admin", "Admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Your user is not linked to a practice." }, { status: 400 });
    }

    const organisationId = profile.organisation_id;

    if (!organisationId) {
      return NextResponse.json(
        { error: "Choose a practice before managing practice workflow settings." },
        { status: 400 }
      );
    }

    const [{ data: services, error: servicesError }, { data: templates, error: templatesError }] =
      await Promise.all([
        supabase
          .from("crm_services")
          .select("service_name, service_group, default_frequency, is_active")
          .eq("is_active", true)
          .order("service_group")
          .order("service_name"),
        supabase
          .from("crm_workflow_templates")
          .select("id, service_name, is_enabled")
          .eq("organisation_id", organisationId),
      ]);

    if (servicesError) throw servicesError;
    if (templatesError) throw templatesError;

    const templateIds = (templates || []).map((row: any) => row.id);

    let steps: any[] = [];
    if (templateIds.length) {
      const { data, error } = await supabase
        .from("crm_workflow_template_steps")
        .select(
          "id, template_id, item_order, label, item_type, is_active, is_required, allow_not_applicable, dependency_service_code, dependency_rule"
        )
        .in("template_id", templateIds)
        .order("item_order");

      if (error) throw error;
      steps = data || [];
    }

    const templateByService = new Map(
      (templates || []).map((row: any) => [String(row.service_name), row])
    );

    const result = (services || []).map((service: any) => {
      const custom = templateByService.get(String(service.service_name));
      const customSteps = custom
        ? steps
            .filter((step: any) => step.template_id === custom.id)
            .map((step: any) => ({
              id: step.id,
              item_order: step.item_order,
              label: step.label,
              item_type: step.item_type,
              is_active: step.is_active,
              is_required: step.is_required,
              allow_not_applicable: step.allow_not_applicable,
              dependency_service_code: step.dependency_service_code,
              dependency_rule: step.dependency_rule,
            }))
        : null;

      const defaults = (SYSTEM_DEFAULTS[String(service.service_name)] || []).map(
        (step, index) => ({
          item_order: index + 1,
          label: step.label,
          item_type: step.item_type || "manual",
          is_active: step.is_active !== false,
          is_required: step.is_required !== false,
          allow_not_applicable: step.allow_not_applicable !== false,
          dependency_service_code: step.dependency_service_code || null,
          dependency_rule: step.dependency_rule || null,
        })
      );

      return {
        service_name: service.service_name,
        service_group: service.service_group,
        frequency: service.default_frequency,
        source: custom ? "practice" : "system",
        is_enabled: custom ? custom.is_enabled !== false : true,
        steps: customSteps || defaults,
      };
    });

    return NextResponse.json({
      success: true,
      can_manage: canManage(profile),
      services: result,
    });
  } catch (error: any) {
    console.error("Workflow settings GET failed:", error);
    return NextResponse.json(
      { error: error?.message || "Could not load workflow settings." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { profile, response } = await currentProfile(request, supabase);
    if (response) return response;

    if (!canManage(profile)) {
      return NextResponse.json(
        { error: "You do not have permission to change practice workflow settings." },
        { status: 403 }
      );
    }

    const organisationId = profile.organisation_id;
    if (!organisationId) {
      return NextResponse.json({ error: "Your user is not linked to a practice." }, { status: 400 });
    }

    const body = await request.json();
    const action = String(body.action || "save");
    const serviceName = String(body.service_name || "").trim();

    if (!serviceName) {
      return NextResponse.json({ error: "Service is required." }, { status: 400 });
    }

    if (action === "reset") {
      const { data: existing } = await supabase
        .from("crm_workflow_templates")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("service_name", serviceName)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from("crm_workflow_templates")
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
      }

      return NextResponse.json({ success: true, source: "system" });
    }

    const suppliedSteps = Array.isArray(body.steps) ? body.steps : [];
    const cleanedSteps = suppliedSteps
      .map((step: StepInput, index: number) => ({
        item_order: index + 1,
        label: String(step.label || "").trim(),
        item_type:
          step.item_type === "dependency" ||
          step.item_type === "review" ||
          step.item_type === "submission"
            ? step.item_type
            : "manual",
        is_active: step.is_active !== false,
        is_required: step.is_required !== false,
        allow_not_applicable: step.allow_not_applicable !== false,
        dependency_service_code:
          step.item_type === "dependency"
            ? String(step.dependency_service_code || "").trim() || null
            : null,
        dependency_rule:
          step.item_type === "dependency"
            ? String(step.dependency_rule || "").trim() || "covered_period_all_completed"
            : null,
      }))
      .filter((step: any) => step.label);

    const { data: template, error: templateError } = await supabase
      .from("crm_workflow_templates")
      .upsert(
        {
          organisation_id: organisationId,
          service_name: serviceName,
          is_enabled: body.is_enabled !== false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organisation_id,service_name" }
      )
      .select("id")
      .single();

    if (templateError) throw templateError;

    const { error: deleteError } = await supabase
      .from("crm_workflow_template_steps")
      .delete()
      .eq("template_id", template.id);

    if (deleteError) throw deleteError;

    if (cleanedSteps.length) {
      const { error: insertError } = await supabase
        .from("crm_workflow_template_steps")
        .insert(
          cleanedSteps.map((step: any) => ({
            ...step,
            template_id: template.id,
            organisation_id: organisationId,
          }))
        );

      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true, source: "practice" });
  } catch (error: any) {
    console.error("Workflow settings PATCH failed:", error);
    return NextResponse.json(
      { error: error?.message || "Could not save workflow settings." },
      { status: 500 }
    );
  }
}
