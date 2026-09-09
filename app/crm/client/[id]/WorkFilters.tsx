"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

type PracticeUser = {
  user_id: string;
  full_name: string | null;
  email: string | null;
};

type Props = {
  clientId: string;
  services: string[];
  taskServices: string[];
  users: PracticeUser[];
  status: string;
  service: string;
  sort: string;
  search: string;
};

const CHECKLIST_STARTERS: Record<string, string[]> = {
  Accounting: [
    "All bank statements received",
    "Bank reconciliations completed",
    "Control accounts checked",
    "Review completed",
    "Queries cleared",
  ],
  VAT201: [
    "Accounting for the VAT period completed",
    "Sales reconciled to VAT output",
    "Purchases reconciled to VAT input",
    "VAT control account reconciled",
    "Return reviewed",
    "Submitted and proof filed",
  ],
  Payroll: [
    "Payroll inputs received",
    "Payroll processed",
    "Net pay and deductions verified",
    "Payroll reviewed",
  ],
  "Ad Hoc Work": [
    "Work completed",
    "Work reviewed / checked",
    "Supporting evidence / communication filed",
  ],
};

export default function WorkFilters({
  clientId,
  services,
  taskServices,
  users,
  status,
  service,
  sort,
  search,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchText, setSearchText] = useState(search);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskService, setTaskService] = useState("Ad Hoc Work");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskPriority, setTaskPriority] = useState("normal");
  const [taskAssignedUserId, setTaskAssignedUserId] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskChecklist, setTaskChecklist] = useState(
    CHECKLIST_STARTERS["Ad Hoc Work"].join("\n")
  );

  const sortedTaskServices = useMemo(
    () => Array.from(new Set(["Ad Hoc Work", ...taskServices])).sort(),
    [taskServices]
  );

  useEffect(() => {
    setSearchText(search);
  }, [search]);

  function updateParam(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "work");

    if (
      !value ||
      value === "all" ||
      (name === "workStatus" && value === "open") ||
      (name === "workSort" && value === "due_asc")
    ) {
      params.delete(name);
    } else {
      params.set(name, value);
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    updateParam("workSearch", searchText.trim());
  }

  function resetFilters() {
    const params = new URLSearchParams();
    params.set("tab", "work");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setSearchText("");
  }

  function changeTaskService(value: string) {
    setTaskService(value);
    const starter =
      CHECKLIST_STARTERS[value] || CHECKLIST_STARTERS["Ad Hoc Work"];
    setTaskChecklist(starter.join("\n"));
  }

  async function createTask(event: FormEvent) {
    event.preventDefault();
    setSaveError("");

    if (!taskTitle.trim()) {
      setSaveError("Task title is required.");
      return;
    }

    if (!supabase) {
      setSaveError("Supabase client is not configured.");
      return;
    }

    try {
      setSaving(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("You are not signed in.");
      }

      const response = await fetch("/api/crm/work", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          clientId,
          title: taskTitle.trim(),
          description: taskDescription.trim(),
          serviceCode: taskService,
          dueDate: taskDueDate || null,
          priority: taskPriority,
          assignedUserId: taskAssignedUserId || null,
          checklist: taskChecklist
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Could not create task.");
      }

      setShowAdd(false);
      setTaskTitle("");
      setTaskDueDate("");
      setTaskPriority("normal");
      setTaskAssignedUserId("");
      setTaskDescription("");
      setTaskService("Ad Hoc Work");
      setTaskChecklist(CHECKLIST_STARTERS["Ad Hoc Work"].join("\n"));

      router.refresh();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Could not create task."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div style={bar}>
        <div style={field}>
          <label style={label}>Status</label>
          <select
            value={status}
            onChange={(event) => updateParam("workStatus", event.target.value)}
            style={select}
          >
            <option value="open">Open work</option>
            <option value="overdue">Overdue</option>
            <option value="next7">Next 7 days</option>
            <option value="next31">Next 31 days</option>
            <option value="in_progress">In progress</option>
            <option value="waiting">Waiting</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div style={field}>
          <label style={label}>Service</label>
          <select
            value={service}
            onChange={(event) => updateParam("workService", event.target.value)}
            style={select}
          >
            <option value="all">All services</option>
            {services.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div style={field}>
          <label style={label}>Sort</label>
          <select
            value={sort}
            onChange={(event) => updateParam("workSort", event.target.value)}
            style={select}
          >
            <option value="due_asc">Due date · earliest first</option>
            <option value="due_desc">Due date · latest first</option>
            <option value="service">Service</option>
            <option value="status">Status</option>
          </select>
        </div>

        <form onSubmit={submitSearch} style={searchForm}>
          <label style={label}>Search</label>
          <div style={searchRow}>
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search work..."
              style={input}
            />
            <button type="submit" style={applyButton}>
              Go
            </button>
          </div>
        </form>

        <button type="button" onClick={resetFilters} style={resetButton}>
          Reset
        </button>

        <button
          type="button"
          onClick={() => {
            setSaveError("");
            setShowAdd(true);
          }}
          style={addButton}
        >
          + Add Task
        </button>
      </div>

      {showAdd ? (
        <div style={modalBackdrop}>
          <form onSubmit={createTask} style={modal}>
            <div style={modalHeader}>
              <div>
                <div style={modalTitle}>Add client task</div>
                <div style={modalSubtitle}>
                  Manual work is never changed by the recurring task generator.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                style={closeButton}
              >
                ×
              </button>
            </div>

            <div style={modalGrid}>
              <div style={wideField}>
                <label style={modalLabel}>Task *</label>
                <input
                  value={taskTitle}
                  onChange={(event) => setTaskTitle(event.target.value)}
                  placeholder="e.g. Reconcile Salaries Payable"
                  style={modalInput}
                  autoFocus
                />
              </div>

              <div style={modalField}>
                <label style={modalLabel}>Service</label>
                <select
                  value={taskService}
                  onChange={(event) => changeTaskService(event.target.value)}
                  style={modalInput}
                >
                  {sortedTaskServices.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div style={modalField}>
                <label style={modalLabel}>Assigned to</label>
                <select
                  value={taskAssignedUserId}
                  onChange={(event) =>
                    setTaskAssignedUserId(event.target.value)
                  }
                  style={modalInput}
                >
                  <option value="">Unassigned</option>
                  {users.map((user) => (
                    <option key={user.user_id} value={user.user_id}>
                      {user.full_name || user.email || "Practice user"}
                    </option>
                  ))}
                </select>
              </div>

              <div style={modalField}>
                <label style={modalLabel}>Due date</label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(event) => setTaskDueDate(event.target.value)}
                  style={modalInput}
                />
              </div>

              <div style={modalField}>
                <label style={modalLabel}>Priority</label>
                <select
                  value={taskPriority}
                  onChange={(event) => setTaskPriority(event.target.value)}
                  style={modalInput}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div style={wideField}>
                <label style={modalLabel}>Notes / instructions</label>
                <textarea
                  value={taskDescription}
                  onChange={(event) => setTaskDescription(event.target.value)}
                  rows={3}
                  style={modalTextarea}
                  placeholder="What must be done?"
                />
              </div>

              <div style={wideField}>
                <label style={modalLabel}>Checklist · one item per line</label>
                <textarea
                  value={taskChecklist}
                  onChange={(event) => setTaskChecklist(event.target.value)}
                  rows={7}
                  style={modalTextarea}
                />
              </div>
            </div>

            {saveError ? <div style={errorBox}>{saveError}</div> : null}

            <div style={modalActions}>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                style={secondaryButton}
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} style={primaryButton}>
                {saving ? "Saving..." : "Create Task"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

const bar: React.CSSProperties = {
  padding: "10px 12px",
  display: "flex",
  alignItems: "flex-end",
  gap: "8px",
  flexWrap: "wrap",
  borderBottom: "1px solid #dde5ec",
  background: "#f7fafc",
};

const field: React.CSSProperties = {
  display: "grid",
  gap: "4px",
  flex: "0 1 170px",
};

const label: React.CSSProperties = {
  color: "#607180",
  fontSize: "9px",
  fontWeight: 800,
};

const select: React.CSSProperties = {
  height: "32px",
  padding: "0 8px",
  border: "1px solid #cfd9e3",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "10px",
  fontWeight: 700,
};

const searchForm: React.CSSProperties = {
  display: "grid",
  gap: "4px",
  flex: "1 1 180px",
};

const searchRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 42px",
  gap: "5px",
};

const input: React.CSSProperties = {
  height: "32px",
  padding: "0 9px",
  border: "1px solid #cfd9e3",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "10px",
};

const applyButton: React.CSSProperties = {
  height: "32px",
  border: "1px solid #183c5c",
  background: "#183c5c",
  color: "#ffffff",
  fontSize: "10px",
  fontWeight: 850,
  cursor: "pointer",
};

const resetButton: React.CSSProperties = {
  height: "32px",
  padding: "0 9px",
  border: "none",
  background: "transparent",
  color: "#2457d6",
  fontSize: "10px",
  fontWeight: 800,
  cursor: "pointer",
};

const addButton: React.CSSProperties = {
  height: "32px",
  padding: "0 12px",
  border: "1px solid #10233a",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "10px",
  fontWeight: 850,
  cursor: "pointer",
  marginLeft: "auto",
};

const modalBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 5000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  background: "rgba(15, 35, 58, 0.34)",
};

const modal: React.CSSProperties = {
  width: "min(760px, 96vw)",
  maxHeight: "90vh",
  overflow: "auto",
  background: "#ffffff",
  border: "1px solid #cfd9e3",
  boxShadow: "0 22px 70px rgba(15,35,58,.24)",
};

const modalHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  padding: "16px 18px",
  borderBottom: "1px solid #dbe4ec",
};

const modalTitle: React.CSSProperties = {
  color: "#10233a",
  fontSize: "18px",
  fontWeight: 900,
};

const modalSubtitle: React.CSSProperties = {
  marginTop: "3px",
  color: "#71808c",
  fontSize: "10px",
};

const closeButton: React.CSSProperties = {
  width: "30px",
  height: "30px",
  border: "none",
  background: "transparent",
  color: "#506375",
  fontSize: "24px",
  cursor: "pointer",
};

const modalGrid: React.CSSProperties = {
  padding: "16px 18px",
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px",
};

const modalField: React.CSSProperties = {
  display: "grid",
  gap: "5px",
};

const wideField: React.CSSProperties = {
  ...modalField,
  gridColumn: "1 / -1",
};

const modalLabel: React.CSSProperties = {
  color: "#506375",
  fontSize: "10px",
  fontWeight: 800,
};

const modalInput: React.CSSProperties = {
  width: "100%",
  minHeight: "36px",
  padding: "7px 9px",
  border: "1px solid #cdd8e2",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "11px",
  boxSizing: "border-box",
};

const modalTextarea: React.CSSProperties = {
  ...modalInput,
  minHeight: "84px",
  resize: "vertical",
  fontFamily: "inherit",
};

const errorBox: React.CSSProperties = {
  margin: "0 18px 12px",
  padding: "8px 10px",
  border: "1px solid #efb4ab",
  background: "#fff2ef",
  color: "#9c3f34",
  fontSize: "10px",
  fontWeight: 700,
};

const modalActions: React.CSSProperties = {
  padding: "12px 18px 16px",
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  borderTop: "1px solid #dbe4ec",
};

const secondaryButton: React.CSSProperties = {
  minHeight: "34px",
  padding: "0 13px",
  border: "1px solid #cbd6df",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "10px",
  fontWeight: 800,
  cursor: "pointer",
};

const primaryButton: React.CSSProperties = {
  minHeight: "34px",
  padding: "0 14px",
  border: "1px solid #1769e0",
  background: "#1769e0",
  color: "#ffffff",
  fontSize: "10px",
  fontWeight: 850,
  cursor: "pointer",
};
