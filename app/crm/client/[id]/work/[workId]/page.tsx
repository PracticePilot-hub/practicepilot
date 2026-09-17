import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { TaskDetailClient } from "./TaskDetailClient";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase admin environment variables.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function parseStage(stage: string | null | undefined) {
  const [start, end] = String(stage || "").split(":");
  return {
    start: start || "",
    end: end || "",
  };
}

function periodsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
) {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

function monthKeysBetween(start: string, end: string) {
  if (!start || !end) return [] as string[];

  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return [] as string[];
  }

  const result: string[] = [];
  let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (cursor.getTime() <= last.getTime()) {
    result.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`
    );
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return result;
}

function candidateCoversMonth(candidateStart: string, candidateEnd: string, monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return false;

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEndDate = new Date(year, month, 0);
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(
    monthEndDate.getDate()
  ).padStart(2, "0")}`;

  return periodsOverlap(candidateStart, candidateEnd, monthStart, monthEnd);
}

export default async function WorkItemPage({
  params,
}: {
  params: Promise<{ id: string; workId: string }>;
}) {
  const { id: clientId, workId } = await params;

  const { data: work, error: workError } = await supabase
    .from("crm_work_items")
    .select("*")
    .eq("id", workId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (workError || !work) notFound();

  const [
    clientResult,
    checklistResult,
    activityResult,
    usersResult,
    relatedWorkResult,
  ] = await Promise.all([
    supabase
      .from("crm_clients")
      .select("id, client_name, organisation_id, registration_number")
      .eq("id", clientId)
      .maybeSingle(),

    supabase
      .from("crm_work_item_checklist")
      .select(
        "id, item_order, label, status, notes, item_type, template_key, dependency_service_code, dependency_rule"
      )
      .eq("work_item_id", workId)
      .order("item_order"),

    supabase
      .from("crm_work_item_activity")
      .select(
        "id, action_type, action_summary, from_status, to_status, performed_by_user_id, created_at"
      )
      .eq("work_item_id", workId)
      .order("created_at", { ascending: false })
      .limit(30),

    supabase
      .from("user_profiles")
      .select("user_id, full_name, email, access_enabled")
      .eq("organisation_id", work.organisation_id)
      .eq("access_enabled", true)
      .order("full_name"),

    supabase
      .from("crm_work_items")
      .select(
        "id, title, status, completed_at, service_code, workflow_stage, due_date"
      )
      .eq("client_id", clientId)
      .eq("workflow_type", "recurring_client_service")
      .neq("status", "cancelled"),
  ]);

  const client = clientResult.data;
  if (!client) notFound();

  const relatedWork = relatedWorkResult.data || [];
  const currentPeriod = parseStage(work.workflow_stage);

  const checklist = (checklistResult.data || []).map((item: any) => {
    if (item.item_type !== "dependency" || !item.dependency_service_code) {
      return {
        ...item,
        dependency_complete: null,
        dependency_summary: null,
      };
    }

    const candidates = relatedWork.filter((candidate: any) => {
      if (candidate.service_code !== item.dependency_service_code) return false;

      const dependencyPeriod = parseStage(candidate.workflow_stage);

      if (item.dependency_rule === "same_period_all_completed") {
        return (
          dependencyPeriod.start === currentPeriod.start &&
          dependencyPeriod.end === currentPeriod.end
        );
      }

      return periodsOverlap(
        dependencyPeriod.start,
        dependencyPeriod.end,
        currentPeriod.start,
        currentPeriod.end
      );
    });

    const isCandidateCompleted = (candidate: any) =>
      candidate.status === "completed" || Boolean(candidate.completed_at);

    if (item.dependency_rule === "covered_period_all_completed") {
      const expectedMonths = monthKeysBetween(currentPeriod.start, currentPeriod.end);
      const completedMonths = expectedMonths.filter((monthKey) =>
        candidates.some((candidate: any) => {
          if (!isCandidateCompleted(candidate)) return false;
          const dependencyPeriod = parseStage(candidate.workflow_stage);
          return candidateCoversMonth(
            dependencyPeriod.start,
            dependencyPeriod.end,
            monthKey
          );
        })
      );

      const complete =
        expectedMonths.length > 0 && completedMonths.length === expectedMonths.length;

      return {
        ...item,
        dependency_complete: complete,
        dependency_summary: `${completedMonths.length}/${expectedMonths.length} ${item.dependency_service_code} month${expectedMonths.length === 1 ? "" : "s"} complete for this period`,
      };
    }

    const complete =
      candidates.length > 0 && candidates.every(isCandidateCompleted);

    const completedCount = candidates.filter(isCandidateCompleted).length;

    return {
      ...item,
      dependency_complete: complete,
      dependency_summary: candidates.length
        ? `${completedCount}/${candidates.length} linked ${item.dependency_service_code} task${candidates.length === 1 ? "" : "s"} complete`
        : `No linked ${item.dependency_service_code} work found for this period`,
    };
  });

  return (
    <main style={page}>
      <div style={crumbBar}>
        <Link href={`/crm/client/${clientId}?tab=work`} style={backLink}>
          ← Back to client work
        </Link>
      </div>

      <section style={hero}>
        <div>
          <h1 style={title}>{work.title}</h1>
          <div style={meta}>
            Due {formatDate(work.due_date)}
            <span>·</span>
            {String(work.status || "not_started").replaceAll("_", " ")}
            <span>·</span>
            {work.workflow_type === "manual_client_work"
              ? "Manual task"
              : "Generated task"}
          </div>
        </div>

        <Link href={`/crm/client/${clientId}?tab=work`} style={secondaryAction}>
          Client Work
        </Link>
      </section>

      {currentPeriod.start && currentPeriod.end ? (
        <div style={periodStrip}>
          <strong>Work period</strong>
          <span>
            {formatDate(currentPeriod.start)} → {formatDate(currentPeriod.end)}
          </span>
        </div>
      ) : null}

      <div style={contentGrid}>
        <TaskDetailClient
          clientId={clientId}
          workId={workId}
          status={work.status || "not_started"}
          priority={work.priority || "normal"}
          assignedUserId={work.assigned_user_id || null}
          dueDate={work.due_date || null}
          description={work.description || null}
          users={(usersResult.data || []).map((user: any) => ({
            user_id: user.user_id,
            full_name: user.full_name,
            email: user.email,
          }))}
          checklist={checklist}
        />

        <aside style={activityPanel}>
          <div style={activityHeader}>
            <div style={activityTitle}>Activity</div>
            <div style={activitySub}>Audit trail for this work item.</div>
          </div>

          {(activityResult.data || []).length ? (
            (activityResult.data || []).map((item: any) => (
              <div key={item.id} style={activityRow}>
                <strong style={activitySummary}>
                  {item.action_summary || item.action_type}
                </strong>
                <div style={activityDate}>{formatDateTime(item.created_at)}</div>
              </div>
            ))
          ) : (
            <div style={empty}>No activity recorded yet.</div>
          )}
        </aside>
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  padding: "8px 10px 24px",
  color: "#10233a",
  fontFamily: "'Aptos', 'Segoe UI', Arial, sans-serif",
};

const crumbBar: React.CSSProperties = {
  minHeight: "32px",
  display: "flex",
  alignItems: "center",
  padding: "0 10px",
  border: "1px solid #d7e0e8",
  background: "#ffffff",
  fontSize: "12px",
};

const backLink: React.CSSProperties = {
  color: "#174ea6",
  textDecoration: "none",
  fontSize: "9px",
  fontWeight: 700,
  letterSpacing: 0,
};

const hero: React.CSSProperties = {
  marginTop: "6px",
  minHeight: "64px",
  padding: "9px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "14px",
  border: "1px solid #d7e0e8",
  background: "#ffffff",
};

const title: React.CSSProperties = {
  margin: "2px 0 3px",
  color: "#10233a",
  fontSize: "19px",
  lineHeight: 1.15,
  fontWeight: 900,
};

const meta: React.CSSProperties = {
  display: "flex",
  gap: "6px",
  color: "#687b8b",
  fontSize: "9px",
};

const secondaryAction: React.CSSProperties = {
  minHeight: "28px",
  padding: "0 9px",
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid #cbd6df",
  background: "#ffffff",
  color: "#10233a",
  textDecoration: "none",
  fontSize: "9px",
  fontWeight: 850,
};

const periodStrip: React.CSSProperties = {
  minHeight: "30px",
  marginTop: "6px",
  padding: "0 10px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  border: "1px solid #d6e1e9",
  background: "#f4f8fb",
  color: "#526779",
  fontSize: "9.5px",
};

const contentGrid: React.CSSProperties = {
  marginTop: "6px",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 235px",
  gap: "8px",
  alignItems: "start",
};

const activityPanel: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d7e0e8",
};

const activityHeader: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #e0e7ed",
};

const activityTitle: React.CSSProperties = {
  color: "#10233a",
  fontSize: "11px",
  fontWeight: 900,
};

const activitySub: React.CSSProperties = {
  marginTop: "2px",
  color: "#798893",
  fontSize: "9px",
};

const activityRow: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #e6ebef",
};

const activitySummary: React.CSSProperties = {
  color: "#32495b",
  fontSize: "9.5px",
};

const activityDate: React.CSSProperties = {
  marginTop: "3px",
  color: "#8a969f",
  fontSize: "8px",
};

const empty: React.CSSProperties = {
  padding: "20px 12px",
  color: "#84919b",
  fontSize: "9px",
};
