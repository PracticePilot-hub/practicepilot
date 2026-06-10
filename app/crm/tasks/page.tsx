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
      <section style={styles.header}>
        <div>
          <p style={styles.eyebrow}>CRM Tasks</p>
          <h1 style={styles.title}>Task Engine</h1>
          <p style={styles.subtitle}>
            Main CRM task list. Split between work, review and completed tasks.
          </p>
        </div>

        <div style={styles.headerActions}>
          <button style={styles.primaryButton} onClick={generateTasks} disabled={generating}>
            {generating ? "Generating..." : "Generate Tasks"}
          </button>
          <Link href="/dashboard" style={styles.secondaryButton}>
            Back to PilotHub
          </Link>
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
    background: "#f3f8fc",
    padding: "36px",
    color: "#0b2f4f",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "20px",
  },
  headerActions: {
    display: "flex",
    gap: "10px",
  },
  eyebrow: {
    margin: 0,
    color: "#00a6b4",
    fontSize: "12px",
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  title: {
    margin: "6px 0 0",
    fontSize: "34px",
    letterSpacing: "-0.04em",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#526173",
    fontSize: "15px",
  },
  primaryButton: {
    background: "#0b5cab",
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryButton: {
    background: "#ffffff",
    color: "#0b5cab",
    textDecoration: "none",
    border: "1px solid #dbe5ee",
    borderRadius: "12px",
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: 900,
  },
  modeCard: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "12px",
    marginBottom: "14px",
  },
  modeButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#ffffff",
    color: "#0b2f4f",
    border: "1px solid #dbe5ee",
    borderRadius: "16px",
    padding: "16px",
    fontSize: "15px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 28px rgba(11,47,79,0.06)",
  },
  modeButtonActive: {
    background: "#0b5cab",
    color: "#ffffff",
    border: "1px solid #0b5cab",
  },
  modeCount: {
    background: "#eaf8fa",
    color: "#007986",
    borderRadius: "999px",
    padding: "4px 9px",
    fontSize: "12px",
    fontWeight: 900,
  },
  modeCountActive: {
    background: "#ffffff",
    color: "#0b5cab",
    borderRadius: "999px",
    padding: "4px 9px",
    fontSize: "12px",
    fontWeight: 900,
  },
  quickFilterCard: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    background: "#ffffff",
    border: "1px solid #dbe5ee",
    borderRadius: "18px",
    padding: "14px",
    marginBottom: "16px",
    boxShadow: "0 10px 28px rgba(11,47,79,0.06)",
  },
  quickFilterButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "#f8fbfd",
    color: "#0b2f4f",
    border: "1px solid #dbe5ee",
    borderRadius: "999px",
    padding: "9px 13px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
  },
  quickFilterButtonActive: {
    background: "#0b5cab",
    color: "#ffffff",
    border: "1px solid #0b5cab",
  },
  quickFilterCount: {
    background: "#eaf8fa",
    color: "#007986",
    borderRadius: "999px",
    padding: "2px 7px",
    fontSize: "11px",
    fontWeight: 900,
  },
  quickFilterCountActive: {
    background: "#ffffff",
    color: "#0b5cab",
    borderRadius: "999px",
    padding: "2px 7px",
    fontSize: "11px",
    fontWeight: 900,
  },
  toolbar: {
    display: "grid",
    gridTemplateColumns: "1fr 240px",
    gap: "12px",
    marginBottom: "10px",
  },
  searchInput: {
    height: "44px",
    border: "1px solid #d5dde6",
    borderRadius: "12px",
    padding: "0 14px",
    fontSize: "14px",
  },
  select: {
    height: "44px",
    border: "1px solid #d5dde6",
    borderRadius: "12px",
    padding: "0 12px",
    fontSize: "14px",
    background: "#ffffff",
  },
  summaryLine: {
    marginBottom: "12px",
    color: "#526173",
    fontSize: "13px",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #dbe5ee",
    borderRadius: "20px",
    overflow: "hidden",
    boxShadow: "0 16px 40px rgba(11,47,79,0.08)",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1.2fr 0.8fr 1fr",
    gap: "12px",
    padding: "14px 18px",
    background: "#f8fbfd",
    color: "#526173",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1.2fr 0.8fr 1fr",
    gap: "12px",
    padding: "16px 18px",
    borderTop: "1px solid #eef3f7",
    color: "#0b2f4f",
    textDecoration: "none",
    alignItems: "center",
    fontSize: "14px",
  },
  servicePill: {
    justifySelf: "start",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "11px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  statusPill: {
    justifySelf: "start",
    background: "#eaf8fa",
    color: "#007986",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "11px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  emptyState: {
    padding: "28px",
    textAlign: "center",
    color: "#7b8794",
  },
};