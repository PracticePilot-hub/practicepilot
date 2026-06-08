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

type RelationValue<T> = T | T[] | null | undefined;

type ClientRelation = {
  client_name: string | null;
};

type ServiceRelation = {
  service_name: string | null;
};

type ClientServiceRow = {
  id: string;
  client_id: string;
  service_id: string;
  frequency: string | null;
  start_date: string | null;
  service_settings: Record<string, any> | null;
  task_generation_enabled: boolean | null;
  crm_clients: RelationValue<ClientRelation>;
  crm_services: RelationValue<ServiceRelation>;
};

type TaskPlan = {
  serviceName: string;
  titleServiceName: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
};

function getSingleRelation<T>(value: RelationValue<T>): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getDueDateAfterPeriod(periodEnd: Date, monthsAfter: number, dueDay: number) {
  const dueBase = addMonths(new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1), monthsAfter);
  return new Date(dueBase.getFullYear(), dueBase.getMonth(), dueDay);
}

function getVatTask(startDate: Date, serviceName: string, settings: Record<string, any>): TaskPlan {
  const frequency = settings?.frequency || "bi_monthly";
  const dueDay = Number(settings?.due_day || 25);

  let monthsInPeriod = 2;

  if (frequency === "monthly") monthsInPeriod = 1;
  if (frequency === "six_monthly") monthsInPeriod = 6;

  const periodStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const periodEnd = getMonthEnd(addMonths(periodStart, monthsInPeriod - 1));
  const dueDate = getDueDateAfterPeriod(periodEnd, 1, dueDay);

  return {
    serviceName,
    titleServiceName: serviceName,
    periodStart,
    periodEnd,
    dueDate,
  };
}

function getMonthlyTask(startDate: Date, serviceName: string, dueDay: number): TaskPlan {
  const periodStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const periodEnd = getMonthEnd(periodStart);
  const dueDate = getDueDateAfterPeriod(periodEnd, 1, dueDay);

  return {
    serviceName,
    titleServiceName: serviceName,
    periodStart,
    periodEnd,
    dueDate,
  };
}

function getAnnualTask(startDate: Date, serviceName: string): TaskPlan {
  const year = startDate.getFullYear();
  const periodStart = new Date(year, 0, 1);
  const periodEnd = new Date(year, 11, 31);
  const dueDate = new Date(year + 1, 0, 31);

  return {
    serviceName,
    titleServiceName: serviceName,
    periodStart,
    periodEnd,
    dueDate,
  };
}

function getFinancialStatementsTask(startDate: Date, serviceName: string): TaskPlan {
  const year = startDate.getFullYear();
  const periodStart = new Date(year, 0, 1);
  const periodEnd = new Date(year, 11, 31);
  const dueDate = new Date(year + 1, 5, 30);

  return {
    serviceName,
    titleServiceName: serviceName,
    periodStart,
    periodEnd,
    dueDate,
  };
}

function getProvisionalTaxTask(startDate: Date, serviceName: string): TaskPlan {
  const year = startDate.getFullYear();
  const month = startDate.getMonth();

  const isFirstPayment = month < 8;

  const periodStart = new Date(year, isFirstPayment ? 2 : 8, 1);
  const periodEnd = new Date(year, isFirstPayment ? 7 : 1, isFirstPayment ? 31 : 28);
  const dueDate = new Date(year, isFirstPayment ? 7 : 1, isFirstPayment ? 31 : 28);

  return {
    serviceName,
    titleServiceName: isFirstPayment ? "Provisional Tax 1" : "Provisional Tax 2",
    periodStart,
    periodEnd,
    dueDate,
  };
}

function getEmp501Task(startDate: Date, serviceName: string): TaskPlan {
  const year = startDate.getFullYear();
  const month = startDate.getMonth();

  const isInterim = month < 9;

  const periodStart = new Date(year, isInterim ? 2 : 8, 1);
  const periodEnd = new Date(year, isInterim ? 7 : 1, isInterim ? 31 : 28);
  const dueDate = new Date(year, isInterim ? 9 : 4, isInterim ? 31 : 31);

  return {
    serviceName,
    titleServiceName: isInterim ? "EMP501 Interim" : "EMP501 Annual",
    periodStart,
    periodEnd,
    dueDate,
  };
}

function buildTaskPlan(serviceName: string, startDate: Date, settings: Record<string, any>): TaskPlan | null {
  if (serviceName === "VAT201") return getVatTask(startDate, serviceName, settings);

  if (serviceName === "EMP201") return getMonthlyTask(startDate, serviceName, Number(settings?.due_day || 7));

  if (serviceName === "Payroll") return getMonthlyTask(startDate, serviceName, 25);

  if (serviceName === "UIF") return getMonthlyTask(startDate, serviceName, 7);

  if (serviceName === "Accounting") return getMonthlyTask(startDate, serviceName, 25);

  if (serviceName === "Management Reports") return getMonthlyTask(startDate, serviceName, 10);

  if (serviceName === "EMP501") return getEmp501Task(startDate, serviceName);

  if (serviceName === "Provisional Tax") return getProvisionalTaxTask(startDate, serviceName);

  if (serviceName === "Financial Statements") return getFinancialStatementsTask(startDate, serviceName);

  if (serviceName === "Income Tax") return getAnnualTask(startDate, serviceName);

  if (serviceName === "CIPC Annual Return") return getAnnualTask(startDate, serviceName);

  if (serviceName === "Beneficial Ownership Declaration") return getAnnualTask(startDate, serviceName);

  if (serviceName === "Workmans Compensation") return getAnnualTask(startDate, serviceName);

  return null;
}

export async function POST() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("crm_client_services")
      .select(
        `
        id,
        client_id,
        service_id,
        frequency,
        start_date,
        service_settings,
        task_generation_enabled,
        crm_clients (
          client_name
        ),
        crm_services (
          service_name
        )
      `
      )
      .eq("is_active", true)
      .eq("task_generation_enabled", true);

    if (error) throw error;

    const clientServices = (data || []) as ClientServiceRow[];
    const createdTasks = [];

    for (const clientService of clientServices) {
      const client = getSingleRelation(clientService.crm_clients);
      const service = getSingleRelation(clientService.crm_services);

      const serviceName = service?.service_name;
      const clientName = client?.client_name;

      if (!serviceName || !clientName || !clientService.start_date) continue;

      const settings = clientService.service_settings || {};
      const startDate = parseDateOnly(clientService.start_date);
      const taskPlan = buildTaskPlan(serviceName, startDate, settings);

      if (!taskPlan) continue;

      const periodStartKey = formatDateOnly(taskPlan.periodStart);
      const periodEndKey = formatDateOnly(taskPlan.periodEnd);

      const { data: existingTask, error: existingError } = await supabase
        .from("crm_tasks")
        .select("id")
        .eq("client_service_id", clientService.id)
        .eq("period_start", periodStartKey)
        .eq("period_end", periodEndKey)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existingTask) continue;

      const { data: insertedTask, error: insertError } = await supabase
        .from("crm_tasks")
        .insert({
          client_id: clientService.client_id,
          client_service_id: clientService.id,
          service_name: serviceName,
          task_title: `${taskPlan.titleServiceName} - ${clientName} - Period ${periodStartKey} to ${periodEndKey}`,
          task_status: "Open",
          due_date: formatDateOnly(taskPlan.dueDate),
          period_start: periodStartKey,
          period_end: periodEndKey,
          has_deadline: true,
          is_manual_task: false,
        })
        .select("id, task_title")
        .single();

      if (insertError) throw insertError;

      createdTasks.push(insertedTask);
    }

    return NextResponse.json({
      success: true,
      created_count: createdTasks.length,
      created_tasks: createdTasks,
    });
  } catch (error: any) {
    console.error("Task generation failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Task generation failed.",
      },
      { status: 500 }
    );
  }
}