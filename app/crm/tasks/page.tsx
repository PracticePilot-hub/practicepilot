"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";

const supabaseAny = supabase as any;

type ServiceColourRow = {
  service_name: string;
  colour_hex: string | null;
  text_colour_hex: string | null;
};

type ClientRow = {
  id: string;
  client_name: string;
};

type WorkItem = {
  id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  work_type: string;
  status: string;
  priority: string;
  assigned_user_id: string | null;
  due_date: string | null;
  start_at: string | null;
  end_at: string | null;
  is_all_day: boolean;
  is_personal: boolean;
  waiting_on: string | null;
  waiting_since: string | null;
  workflow_type: string | null;
  workflow_stage: string | null;
  service_code: string | null;
  source_module: string | null;
  completed_at: string | null;
  created_at?: string | null;
  crm_clients: ClientRow | null;
};

type QueueView =
  | "open"
  | "today"
  | "overdue"
  | "waiting"
  | "personal"
  | "completed";

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function humanise(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Date(year, month - 1, day).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function isComplete(item: WorkItem) {
  return item.status === "completed" || item.status === "cancelled";
}

function getClientName(item: WorkItem) {
  if (item.is_personal) return "Personal";
  return item.crm_clients?.client_name || "Practice";
}

function normaliseServiceKey(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export default function CRMMyWorkPage() {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [serviceColours, setServiceColours] = useState<
    Record<string, ServiceColourRow>
  >({});
  const [userId, setUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [queueView, setQueueView] = useState<QueueView>("open");
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("mine_and_unassigned");

  const [selectedWorkItem, setSelectedWorkItem] = useState<WorkItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editWaitingOn, setEditWaitingOn] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    loadMyWork();
  }, []);

  async function loadMyWork() {
    setLoading(true);
    setLoadError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabaseAny.auth.getUser();

      if (userError || !user) {
        throw new Error("Your PracticePilot login could not be confirmed.");
      }

      setUserId(user.id);

      const { data: profile, error: profileError } = await supabaseAny
        .from("user_profiles")
        .select("organisation_id, access_enabled")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.access_enabled) {
        throw new Error("Your PracticePilot access is disabled.");
      }

      if (!profile?.organisation_id) {
        throw new Error("Your user profile is not linked to an organisation.");
      }

      const [clientsResult, workResult] = await Promise.all([
        supabaseAny
          .from("crm_clients")
          .select("id, client_name")
          .eq("organisation_id", profile.organisation_id)
          .order("client_name", { ascending: true }),

        supabaseAny
          .from("crm_work_items")
          .select(`
            id,
            client_id,
            title,
            description,
            work_type,
            status,
            priority,
            assigned_user_id,
            due_date,
            start_at,
            end_at,
            is_all_day,
            is_personal,
            waiting_on,
            waiting_since,
            workflow_type,
            workflow_stage,
            service_code,
            source_module,
            completed_at,
            created_at
          `)
          .eq("organisation_id", profile.organisation_id)
          .neq("status", "cancelled")
          .order("due_date", { ascending: true, nullsFirst: false })
          .order("start_at", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false }),
      ]);

      if (clientsResult.error) throw clientsResult.error;
      if (workResult.error) throw workResult.error;

      const clientRows = (clientsResult.data || []) as ClientRow[];
      setClients(clientRows);

      const clientMap = Object.fromEntries(
        clientRows.map((client) => [client.id, client])
      ) as Record<string, ClientRow>;

      const hydrated = (workResult.data || []).map((item: any) => ({
        ...item,
        crm_clients: item.client_id ? clientMap[item.client_id] || null : null,
      })) as WorkItem[];

      setWorkItems(hydrated);

      try {
        const colourResponse = await fetch("/api/settings/services", {
          cache: "no-store",
        });
        const colourResult = await colourResponse.json();

        if (colourResult?.success && Array.isArray(colourResult.services)) {
          const colourMap: Record<string, ServiceColourRow> = {};

          for (const service of colourResult.services as ServiceColourRow[]) {
            const key = normaliseServiceKey(service.service_name);
            if (key) colourMap[key] = service;
          }

          setServiceColours(colourMap);
        }
      } catch (colourError) {
        console.error("Could not load service colours:", colourError);
      }
    } catch (error) {
      console.error("Could not load My Work:", error);
      setLoadError(
        error instanceof Error ? error.message : "Could not load My Work."
      );
      setWorkItems([]);
    } finally {
      setLoading(false);
    }
  }

  const todayKey = localDateKey();

  const activeItems = useMemo(
    () => workItems.filter((item) => !isComplete(item)),
    [workItems]
  );

  const dueTodayCount = useMemo(
    () =>
      activeItems.filter(
        (item) =>
          item.due_date === todayKey ||
          (!!item.start_at &&
            localDateKey(new Date(item.start_at)) === todayKey)
      ).length,
    [activeItems, todayKey]
  );

  const overdueCount = useMemo(
    () =>
      activeItems.filter(
        (item) => !!item.due_date && item.due_date < todayKey
      ).length,
    [activeItems, todayKey]
  );

  const waitingCount = useMemo(
    () =>
      activeItems.filter(
        (item) =>
          item.status === "waiting" ||
          !!item.waiting_on ||
          !!item.waiting_since
      ).length,
    [activeItems]
  );

  const personalCount = useMemo(
    () => activeItems.filter((item) => item.is_personal).length,
    [activeItems]
  );

  const completedCount = useMemo(
    () => workItems.filter((item) => item.status === "completed").length,
    [workItems]
  );

  const serviceOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        workItems
          .map((item) => item.service_code || item.work_type)
          .filter(Boolean)
      )
    ) as string[];

    return values.sort((a, b) => humanise(a).localeCompare(humanise(b)));
  }, [workItems]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return workItems
      .filter((item) => {
        if (queueView === "open" && isComplete(item)) return false;

        if (
          queueView === "today" &&
          !(
            item.due_date === todayKey ||
            (!!item.start_at &&
              localDateKey(new Date(item.start_at)) === todayKey)
          )
        ) {
          return false;
        }

        if (
          queueView === "overdue" &&
          !(
            !isComplete(item) &&
            !!item.due_date &&
            item.due_date < todayKey
          )
        ) {
          return false;
        }

        if (
          queueView === "waiting" &&
          !(
            !isComplete(item) &&
            (item.status === "waiting" ||
              !!item.waiting_on ||
              !!item.waiting_since)
          )
        ) {
          return false;
        }

        if (
          queueView === "personal" &&
          !(!isComplete(item) && item.is_personal)
        ) {
          return false;
        }

        if (queueView === "completed" && item.status !== "completed") {
          return false;
        }

        if (
          assignmentFilter === "mine_and_unassigned" &&
          item.assigned_user_id &&
          item.assigned_user_id !== userId
        ) {
          return false;
        }

        if (
          assignmentFilter === "mine" &&
          item.assigned_user_id !== userId
        ) {
          return false;
        }

        if (
          assignmentFilter === "unassigned" &&
          item.assigned_user_id
        ) {
          return false;
        }

        if (
          clientFilter !== "all" &&
          (clientFilter === "personal"
            ? !item.is_personal
            : item.client_id !== clientFilter)
        ) {
          return false;
        }

        const serviceValue = normaliseServiceKey(
          item.service_code || item.work_type
        );

        if (
          serviceFilter !== "all" &&
          serviceValue !== normaliseServiceKey(serviceFilter)
        ) {
          return false;
        }

        if (query) {
          const haystack = [
            item.title,
            item.description,
            getClientName(item),
            humanise(item.service_code || item.work_type),
            item.waiting_on,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          if (!haystack.includes(query)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const aCompleted = isComplete(a);
        const bCompleted = isComplete(b);

        if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;

        const aDate = a.start_at || a.due_date || "9999-12-31";
        const bDate = b.start_at || b.due_date || "9999-12-31";

        return aDate.localeCompare(bDate);
      });
  }, [
    workItems,
    queueView,
    search,
    clientFilter,
    serviceFilter,
    assignmentFilter,
    userId,
    todayKey,
  ]);

  function getServiceColours(item: WorkItem) {
    const key = normaliseServiceKey(item.service_code || item.work_type);
    const row = serviceColours[key];

    return {
      background: row?.colour_hex || "#53657A",
      text: row?.text_colour_hex || "#FFFFFF",
    };
  }

  function openWorkItem(item: WorkItem) {
    setSelectedWorkItem(item);
    setEditTitle(item.title || "");
    setEditDescription(item.description || "");
    setEditDate(
      item.start_at
        ? localDateKey(new Date(item.start_at))
        : item.due_date || ""
    );
    setEditStartTime(item.start_at ? formatTime(item.start_at) : "");
    setEditEndTime(item.end_at ? formatTime(item.end_at) : "");
    setEditStatus(item.status || "not_started");
    setEditWaitingOn(item.waiting_on || "");
  }

  function closeWorkItem() {
    setSelectedWorkItem(null);
    setEditSaving(false);
  }

  function patchWorkItem(itemId: string, patch: Partial<WorkItem>) {
    setWorkItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item
      )
    );
  }

  async function saveWorkItem() {
    if (!selectedWorkItem) return;

    setEditSaving(true);

    try {
      const startAt =
        editDate && editStartTime
          ? new Date(`${editDate}T${editStartTime}:00`).toISOString()
          : null;

      const endAt =
        editDate && editEndTime
          ? new Date(`${editDate}T${editEndTime}:00`).toISOString()
          : null;

      const patch = {
        title: editTitle.trim() || selectedWorkItem.title,
        description: editDescription.trim() || null,
        due_date: editDate || null,
        start_at: startAt,
        end_at: endAt,
        status: editStatus,
        waiting_on:
          editStatus === "waiting" ? editWaitingOn.trim() || null : null,
        waiting_since:
          editStatus === "waiting"
            ? selectedWorkItem.waiting_since || new Date().toISOString()
            : null,
      };

      const { error } = await supabaseAny
        .from("crm_work_items")
        .update(patch)
        .eq("id", selectedWorkItem.id);

      if (error) throw error;

      patchWorkItem(selectedWorkItem.id, patch);
      closeWorkItem();
    } catch (error: any) {
      alert(error?.message || "Could not save this work item.");
      setEditSaving(false);
    }
  }

  async function markComplete(item: WorkItem) {
    try {
      const completedAt = new Date().toISOString();

      const { error } = await supabaseAny
        .from("crm_work_items")
        .update({
          status: "completed",
          completed_at: completedAt,
          waiting_on: null,
          waiting_since: null,
        })
        .eq("id", item.id);

      if (error) throw error;

      patchWorkItem(item.id, {
        status: "completed",
        completed_at: completedAt,
        waiting_on: null,
        waiting_since: null,
      });

      closeWorkItem();
    } catch (error: any) {
      alert(error?.message || "Could not mark this item complete.");
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div style={styles.eyebrow}>My Work</div>
          <h1 style={styles.title}>Work Queue</h1>
          <p style={styles.subtitle}>
            Everything assigned, due, waiting or still needing attention.
          </p>
        </div>

        <a href="/crm" style={styles.backButton}>
          Back to My Day
        </a>
      </section>

      <section style={styles.summaryStrip}>
        <SummaryCell
          label="Open"
          value={activeItems.length}
          active={queueView === "open"}
          onClick={() => setQueueView("open")}
        />
        <SummaryCell
          label="Due today"
          value={dueTodayCount}
          active={queueView === "today"}
          onClick={() => setQueueView("today")}
        />
        <SummaryCell
          label="Overdue"
          value={overdueCount}
          active={queueView === "overdue"}
          onClick={() => setQueueView("overdue")}
        />
        <SummaryCell
          label="Waiting"
          value={waitingCount}
          active={queueView === "waiting"}
          onClick={() => setQueueView("waiting")}
        />
        <SummaryCell
          label="Personal"
          value={personalCount}
          active={queueView === "personal"}
          onClick={() => setQueueView("personal")}
        />
        <SummaryCell
          label="Completed"
          value={completedCount}
          active={queueView === "completed"}
          onClick={() => setQueueView("completed")}
        />
      </section>

      <section style={styles.filterPanel}>
        <div style={styles.searchWrap}>
          <label style={styles.filterLabel}>Search</label>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search work, client or service..."
            style={styles.searchInput}
          />
        </div>

        <div>
          <label style={styles.filterLabel}>Client</label>
          <select
            value={clientFilter}
            onChange={(event) => setClientFilter(event.target.value)}
            style={styles.select}
          >
            <option value="all">All clients</option>
            <option value="personal">Personal</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.client_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={styles.filterLabel}>Service</label>
          <select
            value={serviceFilter}
            onChange={(event) => setServiceFilter(event.target.value)}
            style={styles.select}
          >
            <option value="all">All services</option>
            {serviceOptions.map((service) => (
              <option key={service} value={service}>
                {humanise(service)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={styles.filterLabel}>Assignment</label>
          <select
            value={assignmentFilter}
            onChange={(event) => setAssignmentFilter(event.target.value)}
            style={styles.select}
          >
            <option value="mine_and_unassigned">Mine + unassigned</option>
            <option value="mine">Mine only</option>
            <option value="unassigned">Unassigned</option>
            <option value="all">Everyone</option>
          </select>
        </div>

        <button
          type="button"
          style={styles.clearButton}
          onClick={() => {
            setSearch("");
            setClientFilter("all");
            setServiceFilter("all");
            setAssignmentFilter("mine_and_unassigned");
            setQueueView("open");
          }}
        >
          Clear filters
        </button>
      </section>

      {loadError ? <div style={styles.errorBox}>{loadError}</div> : null}

      <section style={styles.workPanel}>
        <div style={styles.workPanelHeader}>
          <div>
            <h2 style={styles.workPanelTitle}>
              {queueView === "open"
                ? "Open work"
                : queueView === "today"
                ? "Due today"
                : queueView === "overdue"
                ? "Overdue work"
                : queueView === "waiting"
                ? "Waiting / follow-up"
                : queueView === "personal"
                ? "Personal work"
                : "Completed work"}
            </h2>
            <p style={styles.workPanelSubtitle}>
              {loading
                ? "Loading..."
                : `${filteredItems.length} item${
                    filteredItems.length === 1 ? "" : "s"
                  } shown`}
            </p>
          </div>

          <div style={styles.queueHint}>
            {queueView === "open"
              ? "Everything still needing action."
              : queueView === "today"
              ? "Work that needs attention today."
              : queueView === "overdue"
              ? "Past due and still incomplete."
              : queueView === "waiting"
              ? "Blocked until someone responds."
              : queueView === "personal"
              ? "Your personal reminders and follow-ups."
              : "Recorded as complete."}
          </div>
        </div>

        <div style={styles.tableHeader}>
          <span>Work item</span>
          <span>Client / context</span>
          <span>Service</span>
          <span>Status</span>
          <span>Due / scheduled</span>
          <span />
        </div>

        {loading ? (
          <div style={styles.emptyState}>Loading your work...</div>
        ) : filteredItems.length === 0 ? (
          <div style={styles.emptyState}>
            No work matches the current filters.
          </div>
        ) : (
          filteredItems.map((item) => {
            const colours = getServiceColours(item);
            const overdue =
              !isComplete(item) &&
              !!item.due_date &&
              item.due_date < todayKey;

            const dueToday =
              !isComplete(item) &&
              (item.due_date === todayKey ||
                (!!item.start_at &&
                  localDateKey(new Date(item.start_at)) === todayKey));

            const waiting =
              !isComplete(item) &&
              (item.status === "waiting" || !!item.waiting_on || !!item.waiting_since);

            return (
              <button
                type="button"
                key={item.id}
                onClick={() => openWorkItem(item)}
                style={{
                  ...styles.tableRow,
                  ...(overdue
                    ? styles.tableRowOverdue
                    : dueToday
                    ? styles.tableRowToday
                    : waiting
                    ? styles.tableRowWaiting
                    : {}),
                }}
              >
                <span style={styles.workCell}>
                  <span
                    style={{
                      ...styles.serviceMarker,
                      background: colours.background,
                    }}
                  />
                  <span>
                    <strong style={styles.workTitle}>{item.title}</strong>
                    <span style={styles.workContextLine}>
                      {item.description
                        ? item.description
                        : item.workflow_stage
                        ? `Stage: ${humanise(item.workflow_stage)}`
                        : item.source_module
                        ? `From ${humanise(item.source_module)}`
                        : "No additional note"}
                    </span>
                  </span>
                </span>

                <span style={styles.clientCell}>
                  <strong style={styles.clientName}>{getClientName(item)}</strong>
                  <span style={styles.clientMeta}>
                    {item.is_personal
                      ? "Personal"
                      : item.assigned_user_id === userId
                      ? "Assigned to you"
                      : item.assigned_user_id
                      ? "Assigned"
                      : "Unassigned"}
                  </span>
                </span>

                <span>
                  <span
                    style={{
                      ...styles.serviceTag,
                      background: colours.background,
                      color: colours.text,
                    }}
                  >
                    {humanise(item.service_code || item.work_type)}
                  </span>
                </span>

                <span>
                  <span
                    style={{
                      ...styles.statusTag,
                      ...(item.status === "completed"
                        ? styles.statusComplete
                        : waiting
                        ? styles.statusWaiting
                        : item.status === "in_progress"
                        ? styles.statusProgress
                        : styles.statusOpen),
                    }}
                  >
                    {waiting && item.waiting_on
                      ? `Waiting on ${item.waiting_on}`
                      : humanise(item.status || "not_started")}
                  </span>
                </span>

                <span style={styles.whenCell}>
                  {item.start_at ? (
                    <>
                      <strong style={styles.whenPrimary}>
                        {formatDate(localDateKey(new Date(item.start_at)))}
                      </strong>
                      <span style={styles.whenSecondary}>
                        {formatTime(item.start_at)}
                        {item.end_at ? ` – ${formatTime(item.end_at)}` : ""}
                      </span>
                    </>
                  ) : (
                    <>
                      <strong
                        style={{
                          ...styles.whenPrimary,
                          color: overdue
                            ? "#A43D2F"
                            : dueToday
                            ? "#B26316"
                            : "#10233A",
                        }}
                      >
                        {item.due_date ? formatDate(item.due_date) : "No date"}
                      </strong>
                      {overdue ? (
                        <span style={styles.overdueText}>Overdue</span>
                      ) : dueToday ? (
                        <span style={styles.todayText}>Today</span>
                      ) : (
                        <span style={styles.whenSecondary}>Due date</span>
                      )}
                    </>
                  )}
                </span>

                <span style={styles.openText}>Open →</span>
              </button>
            );
          })
        )}
      </section>

      {selectedWorkItem ? (
        <div style={styles.overlay} onClick={closeWorkItem}>
          <div
            style={styles.dialog}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={styles.dialogHeader}>
              <div>
                <div style={styles.dialogEyebrow}>
                  {humanise(
                    selectedWorkItem.service_code ||
                      selectedWorkItem.work_type
                  )}
                </div>
                <h2 style={styles.dialogTitle}>Work item</h2>
              </div>

              <button
                type="button"
                style={styles.closeButton}
                onClick={closeWorkItem}
              >
                ×
              </button>
            </div>

            <div style={styles.dialogBody}>
              <label style={styles.field}>
                <span style={styles.label}>Title</span>
                <input
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Notes</span>
                <textarea
                  value={editDescription}
                  onChange={(event) =>
                    setEditDescription(event.target.value)
                  }
                  style={styles.textarea}
                />
              </label>

              <div style={styles.fieldGrid}>
                <label style={styles.field}>
                  <span style={styles.label}>Date</span>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(event) => setEditDate(event.target.value)}
                    style={styles.input}
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Start</span>
                  <input
                    type="time"
                    value={editStartTime}
                    onChange={(event) =>
                      setEditStartTime(event.target.value)
                    }
                    style={styles.input}
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>End</span>
                  <input
                    type="time"
                    value={editEndTime}
                    onChange={(event) =>
                      setEditEndTime(event.target.value)
                    }
                    style={styles.input}
                  />
                </label>
              </div>

              <div style={styles.fieldGridTwo}>
                <label style={styles.field}>
                  <span style={styles.label}>Status</span>
                  <select
                    value={editStatus}
                    onChange={(event) =>
                      setEditStatus(event.target.value)
                    }
                    style={styles.input}
                  >
                    <option value="not_started">Not started</option>
                    <option value="in_progress">In progress</option>
                    <option value="waiting">Waiting</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Waiting on</span>
                  <input
                    value={editWaitingOn}
                    onChange={(event) =>
                      setEditWaitingOn(event.target.value)
                    }
                    disabled={editStatus !== "waiting"}
                    placeholder={
                      editStatus === "waiting"
                        ? "Client, SARS, colleague..."
                        : "Set status to Waiting first"
                    }
                    style={{
                      ...styles.input,
                      opacity: editStatus === "waiting" ? 1 : 0.55,
                    }}
                  />
                </label>
              </div>

              <div style={styles.dialogMeta}>
                <span>{getClientName(selectedWorkItem)}</span>
                <span>•</span>
                <span>
                  {humanise(
                    selectedWorkItem.service_code ||
                      selectedWorkItem.work_type
                  )}
                </span>
              </div>
            </div>

            <div style={styles.dialogFooter}>
              <button
                type="button"
                style={styles.completeButton}
                onClick={() => markComplete(selectedWorkItem)}
              >
                Mark complete
              </button>

              <div style={styles.dialogFooterRight}>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={closeWorkItem}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  style={styles.primaryButton}
                  onClick={saveWorkItem}
                  disabled={editSaving}
                >
                  {editSaving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SummaryCell({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.summaryCell,
        ...(active ? styles.summaryCellActive : {}),
      }}
    >
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f4f6f5",
    padding: "24px 24px 40px",
    color: "#10233a",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "18px",
  },

  eyebrow: {
    color: "#54766f",
    fontSize: "13px",
    fontWeight: 850,
  },

  title: {
    margin: "4px 0 0",
    fontSize: "32px",
    lineHeight: 1.05,
    letterSpacing: "-0.035em",
  },

  subtitle: {
    margin: "7px 0 0",
    color: "#65717d",
    fontSize: "14px",
  },

  backButton: {
    minHeight: "38px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 14px",
    border: "1px solid #cfd8d7",
    background: "#ffffff",
    color: "#10233a",
    textDecoration: "none",
    fontSize: "12px",
    fontWeight: 850,
  },

  summaryStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    border: "1px solid #d7dfde",
    background: "#ffffff",
    marginBottom: "14px",
  },

  summaryCell: {
    minHeight: "68px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "10px 16px",
    border: "none",
    borderRight: "1px solid #e6ebea",
    background: "#ffffff",
    color: "#10233a",
    cursor: "pointer",
    textAlign: "left",
  },

  summaryCellActive: {
    background: "#eef5f3",
    boxShadow: "inset 0 -3px 0 #54766f",
  },

  summaryLabel: {
    color: "#53616d",
    fontSize: "12px",
    fontWeight: 800,
  },

  summaryValue: {
    marginTop: "2px",
    fontSize: "23px",
    lineHeight: 1,
  },

  filterPanel: {
    display: "grid",
    gridTemplateColumns:
      "minmax(260px, 1.6fr) minmax(180px, 0.9fr) minmax(180px, 0.9fr) minmax(190px, 0.9fr) auto",
    gap: "10px",
    alignItems: "end",
    padding: "13px",
    border: "1px solid #d7dfde",
    background: "#ffffff",
    marginBottom: "14px",
  },

  searchWrap: {
    minWidth: 0,
  },

  filterLabel: {
    display: "block",
    marginBottom: "5px",
    color: "#53616d",
    fontSize: "11px",
    fontWeight: 800,
  },

  searchInput: {
    width: "100%",
    height: "38px",
    boxSizing: "border-box",
    border: "1px solid #ccd6d5",
    background: "#ffffff",
    color: "#10233a",
    padding: "0 10px",
    fontSize: "13px",
    outline: "none",
  },

  select: {
    width: "100%",
    height: "38px",
    border: "1px solid #ccd6d5",
    background: "#ffffff",
    color: "#10233a",
    padding: "0 9px",
    fontSize: "12px",
    fontWeight: 700,
    outline: "none",
  },

  clearButton: {
    height: "38px",
    padding: "0 12px",
    border: "1px solid #ccd6d5",
    background: "#f8faf9",
    color: "#41515c",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },

  workPanel: {
    border: "1px solid #d7dfde",
    background: "#ffffff",
  },

  workPanelHeader: {
    minHeight: "68px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
    padding: "12px 16px",
    borderBottom: "1px solid #e3e8e7",
  },

  queueHint: {
    maxWidth: "360px",
    color: "#65717d",
    fontSize: "11px",
    textAlign: "right",
  },

  workPanelTitle: {
    margin: 0,
    fontSize: "18px",
    lineHeight: 1.2,
  },

  workPanelSubtitle: {
    margin: "3px 0 0",
    color: "#6a7580",
    fontSize: "11px",
  },

  tableHeader: {
    display: "grid",
    gridTemplateColumns:
      "minmax(300px, 2.2fr) minmax(180px, 1.1fr) minmax(150px, 0.9fr) minmax(150px, 0.9fr) minmax(150px, 0.9fr) 56px",
    gap: "10px",
    alignItems: "center",
    padding: "9px 14px",
    background: "#f5f7f7",
    borderBottom: "1px solid #dfe5e4",
    color: "#53616d",
    fontSize: "11px",
    fontWeight: 850,
  },

  tableRow: {
    width: "100%",
    display: "grid",
    gridTemplateColumns:
      "minmax(300px, 2.2fr) minmax(180px, 1.1fr) minmax(150px, 0.9fr) minmax(150px, 0.9fr) minmax(150px, 0.9fr) 68px",
    gap: "10px",
    alignItems: "center",
    minHeight: "70px",
    padding: "10px 14px",
    border: "none",
    borderBottom: "1px solid #e7eceb",
    background: "#ffffff",
    color: "#10233a",
    textAlign: "left",
    cursor: "pointer",
    font: "inherit",
  },

  tableRowToday: {
    background: "#fffdf8",
  },

  tableRowOverdue: {
    background: "#fff8f6",
  },

  tableRowWaiting: {
    background: "#fffaf1",
  },

  workCell: {
    minWidth: 0,
    display: "grid",
    gridTemplateColumns: "5px minmax(0, 1fr)",
    gap: "10px",
    alignItems: "stretch",
  },

  serviceMarker: {
    width: "5px",
    minHeight: "42px",
  },

  workTitle: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "13px",
    fontWeight: 900,
  },

  workDescription: {
    display: "block",
    marginTop: "3px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#6b7680",
    fontSize: "11px",
  },

  workContextLine: {
    display: "block",
    marginTop: "4px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#6b7680",
    fontSize: "10px",
  },

  clientCell: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },

  clientName: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#344854",
    fontSize: "12px",
    fontWeight: 800,
  },

  clientMeta: {
    color: "#7a858d",
    fontSize: "10px",
  },

  cellText: {
    color: "#344854",
    fontSize: "12px",
    fontWeight: 700,
  },

  serviceTag: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "25px",
    padding: "0 8px",
    fontSize: "10px",
    fontWeight: 850,
    whiteSpace: "nowrap",
  },

  statusTag: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "25px",
    padding: "0 8px",
    border: "1px solid #d7dfde",
    fontSize: "10px",
    fontWeight: 850,
  },

  statusOpen: {
    background: "#f4f6f5",
    color: "#475662",
  },

  statusWaiting: {
    background: "#fff7e8",
    color: "#8f5a12",
    borderColor: "#efd4a5",
  },

  statusComplete: {
    background: "#edf7f0",
    color: "#2e7148",
    borderColor: "#cce4d3",
  },

  statusProgress: {
    background: "#eef3f9",
    color: "#2d5577",
    borderColor: "#ccd9e6",
  },

  whenCell: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    color: "#53616d",
    fontSize: "10px",
  },

  whenPrimary: {
    color: "#10233a",
    fontSize: "11px",
    fontWeight: 850,
  },

  whenSecondary: {
    color: "#76818a",
    fontSize: "10px",
  },

  overdueText: {
    color: "#a43d2f",
    fontWeight: 850,
  },

  todayText: {
    color: "#b26316",
    fontWeight: 850,
  },

  openText: {
    justifySelf: "end",
    color: "#2457d6",
    fontSize: "11px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  emptyState: {
    padding: "42px 20px",
    color: "#72808a",
    textAlign: "center",
    fontSize: "13px",
  },

  errorBox: {
    marginBottom: "14px",
    padding: "12px 14px",
    border: "1px solid #e1b6ad",
    background: "#fff4f2",
    color: "#8a3428",
    fontSize: "12px",
    fontWeight: 700,
  },

  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: "rgba(16,35,58,0.38)",
  },

  dialog: {
    width: "min(680px, 100%)",
    background: "#ffffff",
    border: "1px solid #cfd8d7",
    boxShadow: "0 24px 70px rgba(16,35,58,0.18)",
  },

  dialogHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    padding: "18px 20px",
    borderBottom: "1px solid #e2e8e7",
  },

  dialogEyebrow: {
    color: "#59726d",
    fontSize: "11px",
    fontWeight: 850,
  },

  dialogTitle: {
    margin: "2px 0 0",
    fontSize: "21px",
  },

  closeButton: {
    width: "32px",
    height: "32px",
    border: "1px solid #cfd8d7",
    background: "#ffffff",
    color: "#10233a",
    fontSize: "20px",
    lineHeight: 1,
    cursor: "pointer",
  },

  dialogBody: {
    display: "grid",
    gap: "14px",
    padding: "18px 20px",
  },

  field: {
    display: "grid",
    gap: "6px",
  },

  label: {
    color: "#4d5e69",
    fontSize: "11px",
    fontWeight: 850,
  },

  input: {
    width: "100%",
    minHeight: "38px",
    boxSizing: "border-box",
    border: "1px solid #cfd8d7",
    background: "#ffffff",
    color: "#10233a",
    padding: "0 10px",
    fontSize: "13px",
    fontWeight: 700,
    outline: "none",
  },

  textarea: {
    width: "100%",
    minHeight: "82px",
    boxSizing: "border-box",
    resize: "vertical",
    border: "1px solid #cfd8d7",
    background: "#ffffff",
    color: "#10233a",
    padding: "9px 10px",
    fontSize: "13px",
    lineHeight: 1.4,
    outline: "none",
  },

  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.9fr 0.9fr",
    gap: "10px",
  },

  fieldGridTwo: {
    display: "grid",
    gridTemplateColumns: "0.8fr 1.2fr",
    gap: "10px",
  },

  dialogMeta: {
    display: "flex",
    gap: "7px",
    color: "#6b7780",
    fontSize: "11px",
  },

  dialogFooter: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "14px 20px",
    borderTop: "1px solid #e2e8e7",
    background: "#f8faf9",
  },

  dialogFooterRight: {
    display: "flex",
    gap: "8px",
  },

  completeButton: {
    minHeight: "36px",
    padding: "0 12px",
    border: "1px solid #b9d7c3",
    background: "#edf7f0",
    color: "#2e7148",
    fontSize: "12px",
    fontWeight: 850,
    cursor: "pointer",
  },

  secondaryButton: {
    minHeight: "36px",
    padding: "0 12px",
    border: "1px solid #c8d2d1",
    background: "#ffffff",
    color: "#314651",
    fontSize: "12px",
    fontWeight: 850,
    cursor: "pointer",
  },

  primaryButton: {
    minHeight: "36px",
    padding: "0 14px",
    border: "1px solid #10233a",
    background: "#10233a",
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: 850,
    cursor: "pointer",
  },
};
