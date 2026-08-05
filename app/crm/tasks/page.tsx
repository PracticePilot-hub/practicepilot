"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type TaskRow = {
  id: string;
  task_title: string;
  service_name: string | null;
  task_status: string | null;
  due_date: string | null;
  period_start: string | null;
  period_end: string | null;
  client_id: string | null;
  crm_clients?: { client_name: string | null } | null;
};

type ServiceColourRow = {
  service_name: string;
  colour_hex: string | null;
  text_colour_hex: string | null;
};

const modeFilters = [
  { label: "All Tasks", value: "all" },
  { label: "Work Tasks", value: "work" },
  { label: "Review Tasks", value: "review" },
  { label: "Completed", value: "completed" },
];

const serviceFilters = [
  { label: "All", value: "all" },
  { label: "VAT", value: "VAT201" },
  { label: "EMP201", value: "EMP201" },
  { label: "EMP501", value: "EMP501" },
  { label: "Payroll", value: "Payroll" },
  { label: "Accounting", value: "Accounting" },
  { label: "Financials", value: "Financial Statements" },
  { label: "Income Tax", value: "Income Tax" },
  { label: "Provisional Tax", value: "Provisional Tax" },
  { label: "CIPC", value: "CIPC Annual Return" },
  { label: "BO", value: "Beneficial Ownership Declaration" },
  { label: "Workmans", value: "Workmans Compensation" },
];

function formatPeriod(start: string | null, end: string | null) {
  if (!start && !end) return "No period";
  if (!end) return start;
  return `${start} to ${end}`;
}

function statusLabel(status: string | null) {
  return status || "Open";
}

function normalStatus(status: string | null) {
  return statusLabel(status).toLowerCase();
}

function isWorkTask(task: TaskRow) {
  const status = normalStatus(task.task_status);

  return (
    status === "open" ||
    status === "correction required" ||
    status === "approved for submission"
  );
}

function isReviewTask(task: TaskRow) {
  return normalStatus(task.task_status) === "ready for review";
}

function isCompletedTask(task: TaskRow) {
  return normalStatus(task.task_status) === "submitted / complete";
}

function taskMatchesMode(task: TaskRow, mode: string) {
  if (mode === "all") return true;
  if (mode === "work") return isWorkTask(task);
  if (mode === "review") return isReviewTask(task);
  if (mode === "completed") return isCompletedTask(task);

  return true;
}

function getModeCount(tasks: TaskRow[], modeValue: string) {
  return tasks.filter((task) => taskMatchesMode(task, modeValue)).length;
}

function getServiceCount(tasks: TaskRow[], serviceValue: string, modeValue: string) {
  const modeTasks = tasks.filter((task) => taskMatchesMode(task, modeValue));

  if (serviceValue === "all") return modeTasks.length;

  return modeTasks.filter((task) => task.service_name === serviceValue).length;
}

function getServiceColours(
  serviceName: string | null,
  serviceColours: Record<string, ServiceColourRow>
) {
  if (!serviceName || !serviceColours[serviceName]) {
    return {
      background: "#0b5cab",
      text: "#ffffff",
    };
  }

  return {
    background: serviceColours[serviceName].colour_hex || "#0b5cab",
    text: serviceColours[serviceName].text_colour_hex || "#ffffff",
  };
}

export default function CRMTasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [serviceColours, setServiceColours] = useState<Record<string, ServiceColourRow>>({});
  const [loading, setLoading] = useState(true);
  const [modeFilter, setModeFilter] = useState("work");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadServiceColours() {
    const response = await fetch("/api/settings/services");
    const result = await response.json();

    if (!result.success) {
      console.error(result.error || "Could not load service colours.");
      setServiceColours({});
      return;
    }

    const colourMap: Record<string, ServiceColourRow> = {};

    for (const service of result.services || []) {
      colourMap[service.service_name] = {
        service_name: service.service_name,
        colour_hex: service.colour_hex,
        text_colour_hex: service.text_colour_hex,
      };
    }

    setServiceColours(colourMap);
  }

  async function loadTasks() {
    setLoading(true);

    await loadServiceColours();

    const { data, error } = await supabase
      .from("crm_tasks")
      .select(
        `
        id,
        task_title,
        service_name,
        task_status,
        due_date,
        period_start,
        period_end,
        client_id,
        crm_clients ( client_name )
      `
      )
      .order("due_date", { ascending: true });

    if (error) {
      console.error(error);
      alert("Could not load CRM tasks.");
      setTasks([]);
      setLoading(false);
      return;
    }

    setTasks((data || []) as unknown as TaskRow[]);
    setLoading(false);
  }

  async function generateTasks() {
    setGenerating(true);

    const response = await fetch("/api/crm/tasks/generate", {
      method: "POST",
    });

    const result = await response.json();
    setGenerating(false);

    if (!result.success) {
      alert(result.error || "Could not generate tasks.");
      return;
    }

    alert(`Generated ${result.created_count} task(s).`);
    await loadTasks();
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const rawStatus = normalStatus(task.task_status);
      const clientName = task.crm_clients?.client_name || "";
      const haystack = `${task.task_title} ${task.service_name || ""} ${clientName}`.toLowerCase();

      if (!taskMatchesMode(task, modeFilter)) return false;

      if (serviceFilter !== "all" && task.service_name !== serviceFilter) return false;

      if (statusFilter !== "all" && rawStatus !== statusFilter.toLowerCase()) return false;

      if (search.trim() && !haystack.includes(search.trim().toLowerCase())) return false;

      return true;
    });
  }, [tasks, modeFilter, statusFilter, serviceFilter, search]);

  return (
    <main style={styles.page}>
      <section style={styles.workingFileBar}>
        <div style={styles.workingFileLabel}>CRM WORKING FILE</div>
        <div style={styles.divider}>|</div>
        <div style={styles.workingFileTitle}>Task Engine</div>
        <div style={styles.divider}>|</div>
        <div style={styles.workingFileMeta}>Practice work control</div>
        <div style={styles.countBadge}>{tasks.length} tasks</div>
      </section>

      <section style={styles.sectionTopBar}>
        <div>
          <div style={styles.sectionTitle}>Task Engine</div>
          <div style={styles.sectionSubtitle}>
            Work, review and completed tasks generated from client services.
          </div>
        </div>

        <div style={styles.headerActions}>
          <button style={styles.primaryButton} onClick={generateTasks} disabled={generating}>
            {generating ? "Generating..." : "Generate Tasks"}
          </button>
        </div>
      </section>

      <section style={styles.modeCard}>
        {modeFilters.map((filter) => {
          const isActive = modeFilter === filter.value;

          return (
            <button
              key={filter.value}
              type="button"
              style={{
                ...styles.modeButton,
                ...(isActive ? styles.modeButtonActive : {}),
              }}
              onClick={() => {
                setModeFilter(filter.value);
                setStatusFilter("all");
              }}
            >
              <span>{filter.label}</span>
              <span style={isActive ? styles.modeCountActive : styles.modeCount}>
                {getModeCount(tasks, filter.value)}
              </span>
            </button>
          );
        })}
      </section>

      <section style={styles.quickFilterCard}>
        {serviceFilters.map((filter) => {
          const isActive = serviceFilter === filter.value;

          return (
            <button
              key={filter.value}
              type="button"
              style={{
                ...styles.quickFilterButton,
                ...(isActive ? styles.quickFilterButtonActive : {}),
              }}
              onClick={() => setServiceFilter(filter.value)}
            >
              <span>{filter.label}</span>
              <span style={isActive ? styles.quickFilterCountActive : styles.quickFilterCount}>
                {getServiceCount(tasks, filter.value, modeFilter)}
              </span>
            </button>
          );
        })}
      </section>

      <section style={styles.toolbar}>
        <input
          style={styles.searchInput}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search task, client or service..."
        />

        <select
          style={styles.select}
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="ready for review">Ready for review</option>
          <option value="correction required">Correction required</option>
          <option value="approved for submission">Approved for submission</option>
          <option value="submitted / complete">Submitted / Complete</option>
        </select>
      </section>

      <section style={styles.summaryLine}>
        Showing <strong>{filteredTasks.length}</strong> of <strong>{tasks.length}</strong> tasks
      </section>

      <section style={styles.card}>
        <div style={styles.tableHeader}>
          <span>Task</span>
          <span>Client</span>
          <span>Service</span>
          <span>Period</span>
          <span>Due date</span>
          <span>Status</span>
        </div>

        {loading && <div style={styles.emptyState}>Loading tasks...</div>}

        {!loading && filteredTasks.length === 0 && (
          <div style={styles.emptyState}>No tasks found.</div>
        )}

        {!loading &&
          filteredTasks.map((task) => {
            const colours = getServiceColours(task.service_name, serviceColours);

            return (
              <Link key={task.id} href={`/crm/tasks/${task.id}`} style={styles.tableRow}>
                <strong>{task.task_title}</strong>
                <span>{task.crm_clients?.client_name || "No client"}</span>

                <span
                  style={{
                    ...styles.servicePill,
                    background: colours.background,
                    color: colours.text,
                  }}
                >
                  {task.service_name || "Task"}
                </span>

                <span>{formatPeriod(task.period_start, task.period_end)}</span>
                <span>{task.due_date || "No date"}</span>
                <span style={styles.statusPill}>{statusLabel(task.task_status)}</span>
              </Link>
            );
          })}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#eef2f5",
    padding: "8px 10px 28px",
    color: "#10233a",
  },
  workingFileBar: {
    minHeight: "42px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "0 10px",
    border: "1px solid #d2d9e2",
    background: "#ffffff",
  },
  workingFileLabel: {
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "0.08em",
    color: "#1d4ed8",
  },
  divider: {
    color: "#94a3b8",
  },
  workingFileTitle: {
    fontWeight: 800,
    color: "#111827",
  },
  workingFileMeta: {
    color: "#64748b",
    fontSize: "12px",
  },
  countBadge: {
    marginLeft: "auto",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#e8eefc",
    color: "#1d4ed8",
    fontSize: "11px",
    fontWeight: 800,
  },
  sectionTopBar: {
    minHeight: "58px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    marginTop: "8px",
    padding: "10px 12px",
    border: "1px solid #d2d9e2",
    background: "#ffffff",
  },
  sectionTitle: {
    fontSize: "15px",
    fontWeight: 800,
    color: "#111827",
  },
  sectionSubtitle: {
    marginTop: "3px",
    fontSize: "12px",
    color: "#64748b",
  },
  headerActions: {
    display: "flex",
    gap: "8px",
  },
  primaryButton: {
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    borderRadius: 0,
    padding: "10px 16px",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
  },
  modeCard: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "0",
    marginTop: "8px",
    border: "1px solid #d2d9e2",
    background: "#ffffff",
  },
  modeButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#ffffff",
    color: "#10233a",
    border: "none",
    borderRight: "1px solid #d2d9e2",
    borderRadius: 0,
    padding: "12px",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
  },
  modeButtonActive: {
    background: "#0f172a",
    color: "#ffffff",
  },
  modeCount: {
    background: "#f1f5f9",
    color: "#334155",
    borderRadius: 999,
    padding: "3px 7px",
    fontSize: "11px",
    fontWeight: 800,
  },
  modeCountActive: {
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 999,
    padding: "3px 7px",
    fontSize: "11px",
    fontWeight: 800,
  },
  quickFilterCard: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    background: "#ffffff",
    border: "1px solid #d2d9e2",
    borderTop: "none",
    borderRadius: 0,
    padding: "8px 10px",
    marginBottom: "8px",
  },
  quickFilterButton: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "#f8fafc",
    color: "#334155",
    border: "1px solid #cfd7e1",
    borderRadius: 0,
    padding: "6px 8px",
    fontSize: "11px",
    fontWeight: 800,
    cursor: "pointer",
  },
  quickFilterButtonActive: {
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
  },
  quickFilterCount: {
    background: "#e2e8f0",
    color: "#334155",
    borderRadius: 999,
    padding: "1px 5px",
    fontSize: "10px",
    fontWeight: 800,
  },
  quickFilterCountActive: {
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 999,
    padding: "1px 5px",
    fontSize: "10px",
    fontWeight: 800,
  },
  toolbar: {
    display: "grid",
    gridTemplateColumns: "1fr 220px",
    gap: "8px",
    marginBottom: "6px",
  },
  searchInput: {
    height: "38px",
    border: "1px solid #cfd7e1",
    borderRadius: 0,
    padding: "0 10px",
    fontSize: "13px",
    background: "#ffffff",
  },
  select: {
    height: "38px",
    border: "1px solid #cfd7e1",
    borderRadius: 0,
    padding: "0 10px",
    fontSize: "13px",
    background: "#ffffff",
  },
  summaryLine: {
    marginBottom: "6px",
    color: "#64748b",
    fontSize: "12px",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #d2d9e2",
    borderRadius: 0,
    overflow: "hidden",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "2.2fr 1.2fr 1fr 1.2fr 0.8fr 1fr",
    gap: "10px",
    padding: "10px 12px",
    background: "#f7f8fa",
    color: "#475569",
    fontSize: "11px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "2.2fr 1.2fr 1fr 1.2fr 0.8fr 1fr",
    gap: "10px",
    padding: "10px 12px",
    borderTop: "1px solid #e5eaf0",
    color: "#10233a",
    textDecoration: "none",
    alignItems: "center",
    fontSize: "13px",
  },
  servicePill: {
    justifySelf: "start",
    borderRadius: 0,
    padding: "4px 7px",
    fontSize: "10px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  statusPill: {
    justifySelf: "start",
    background: "#f1f5f9",
    color: "#334155",
    border: "1px solid #cfd7e1",
    borderRadius: 0,
    padding: "4px 7px",
    fontSize: "10px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  emptyState: {
    padding: "24px",
    textAlign: "center",
    color: "#64748b",
  },
};
 