"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const supabaseAny = supabase as any;

type ServiceColourRow = {
  service_name: string;
  colour_hex: string | null;
  text_colour_hex: string | null;
};

type QuickClient = {
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
  crm_clients:
    | {
        id: string;
        client_name: string;
      }
    | {
        id: string;
        client_name: string;
      }[]
    | null;
};

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getMonthTitle(date: Date) {
  return date.toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  });
}

function formatDayTitle(date: Date) {
  return date.toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatWeekTitle(date: Date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();

  if (sameMonth && sameYear) {
    return `${start.getDate()}–${end.getDate()} ${start.toLocaleDateString("en-ZA", {
      month: "long",
      year: "numeric",
    })}`;
  }

  return `${start.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  })} – ${end.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

function startOfWeek(date: Date) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function getMinutesFromMidnight(value: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}

function formatTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function humanise(value: string | null) {
  if (!value) return "";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getClientName(item: WorkItem) {
  if (!item.crm_clients) return item.is_personal ? "Personal" : "Practice";
  if (Array.isArray(item.crm_clients)) {
    return item.crm_clients[0]?.client_name || "Practice";
  }
  return item.crm_clients.client_name || "Practice";
}

function isComplete(item: WorkItem) {
  return item.status === "completed" || item.status === "cancelled";
}

export default function CRMMyDayPage() {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [firstName, setFirstName] = useState("there");
  const [userId, setUserId] = useState<string | null>(null);
  const [organisationId, setOrganisationId] = useState<string | null>(null);
  const [clients, setClients] = useState<QuickClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [serviceColours, setServiceColours] = useState<Record<string, ServiceColourRow>>({});

  const [quickOpen, setQuickOpen] = useState(false);
  const [selectedWorkItem, setSelectedWorkItem] = useState<WorkItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState("");
  const [quickType, setQuickType] = useState("task");
  const [quickTitle, setQuickTitle] = useState("");
  const [quickClientId, setQuickClientId] = useState("");
  const [quickService, setQuickService] = useState("");
  const [quickDate, setQuickDate] = useState(() => localDateKey());
  const [quickStartTime, setQuickStartTime] = useState("09:00");
  const [quickEndTime, setQuickEndTime] = useState("09:30");
  const [quickNotes, setQuickNotes] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [calendarView, setCalendarView] = useState<"month" | "week" | "day">("month");
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  useEffect(() => {
    async function loadMyDay() {
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

        const emailName =
          user.user_metadata?.first_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "there";

        setFirstName(String(emailName).split(" ")[0]);
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

        setOrganisationId(profile.organisation_id);

        const { data: clientDirectory, error: clientDirectoryError } =
          await supabaseAny
            .from("crm_clients")
            .select("id, client_name")
            .eq("organisation_id", profile.organisation_id)
            .order("client_name", { ascending: true });

        if (clientDirectoryError) {
          console.error("Could not load Quick Capture clients:", clientDirectoryError);
          setClients([]);
        } else {
          setClients((clientDirectory || []) as QuickClient[]);
        }

        try {
          const colourResponse = await fetch("/api/settings/services", {
            cache: "no-store",
          });
          const colourResult = await colourResponse.json();

          if (colourResult?.success && Array.isArray(colourResult.services)) {
            const nextColours: Record<string, ServiceColourRow> = {};

            for (const service of colourResult.services as ServiceColourRow[]) {
              const key = String(service.service_name || "").trim().toLowerCase();
              if (key) nextColours[key] = service;
            }

            setServiceColours(nextColours);
          } else {
            setServiceColours({});
          }
        } catch (colourError) {
          console.error("Could not load CRM service colours:", colourError);
          setServiceColours({});
        }

        // Load the work items with the simplest possible query.
        // Do NOT depend on an embedded crm_clients relationship here:
        // if that relationship or its RLS cannot be resolved, Supabase can
        // fail the whole calendar query even though crm_work_items itself
        // contains valid rows.
        const { data: workData, error: workError } = await supabaseAny
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
            completed_at
          `)
          .eq("organisation_id", profile.organisation_id)
          .neq("status", "cancelled")
          .order("due_date", { ascending: true, nullsFirst: false })
          .order("start_at", { ascending: true, nullsFirst: false });

        if (workError) throw workError;

        const rows = (workData || []) as Array<Omit<WorkItem, "crm_clients">>;

        // Client names are display-only. Load them separately so a client
        // relationship can never blank the calendar.
        const clientIds = Array.from(
          new Set(
            rows
              .map((item) => item.client_id)
              .filter((value): value is string => Boolean(value))
          )
        );

        let clientMap: Record<string, { id: string; client_name: string }> = {};

        if (clientIds.length > 0) {
          const { data: clientData, error: clientError } = await supabaseAny
            .from("crm_clients")
            .select("id, client_name")
            .in("id", clientIds);

          if (clientError) {
            console.error(
              "Could not load client names for My Day calendar:",
              clientError
            );
          } else {
            clientMap = Object.fromEntries(
              (clientData || []).map((client: any) => [
                client.id,
                {
                  id: client.id,
                  client_name: client.client_name || "Client",
                },
              ])
            );
          }
        }

        const hydratedRows: WorkItem[] = rows.map((item) => ({
          ...item,
          crm_clients: item.client_id ? clientMap[item.client_id] || null : null,
        }));

        // Calendar = organisation work calendar.
        // The My Day priority counters below can still decide what is
        // specifically assigned to the logged-in user, but the month view
        // must not silently hide valid firm work.
        setWorkItems(hydratedRows);
      } catch (error) {
        console.error("Could not load My Day:", error);
        setLoadError(
          error instanceof Error ? error.message : "Could not load My Day."
        );
        setWorkItems([]);
      } finally {
        setLoading(false);
      }
    }

    loadMyDay();
  }, []);

  const todayKey = localDateKey();

  const activeItems = useMemo(
    () =>
      workItems.filter(
        (item) =>
          !isComplete(item) &&
          (!item.assigned_user_id || item.assigned_user_id === userId)
      ),
    [workItems, userId]
  );

  const overdue = useMemo(
    () =>
      activeItems.filter(
        (item) => item.due_date && item.due_date < todayKey
      ),
    [activeItems, todayKey]
  );

  const dueToday = useMemo(
    () =>
      activeItems.filter(
        (item) =>
          item.due_date === todayKey ||
          (!!item.start_at && localDateKey(new Date(item.start_at)) === todayKey)
      ),
    [activeItems, todayKey]
  );

  const meetingsToday = useMemo(
    () =>
      activeItems.filter(
        (item) =>
          item.work_type === "meeting" &&
          !!item.start_at &&
          localDateKey(new Date(item.start_at)) === todayKey
      ),
    [activeItems, todayKey]
  );

  const waiting = useMemo(
    () =>
      activeItems.filter(
        (item) => item.status === "waiting" || !!item.waiting_on
      ),
    [activeItems]
  );

  const reminders = useMemo(
    () =>
      activeItems.filter(
        (item) =>
          item.is_personal ||
          item.work_type === "reminder" ||
          item.work_type === "follow_up"
      ),
    [activeItems]
  );

  const completedToday = useMemo(
    () =>
      workItems.filter(
        (item) =>
          item.status === "completed" &&
          !!item.completed_at &&
          localDateKey(new Date(item.completed_at)) === todayKey
      ),
    [workItems, todayKey]
  );

  function getItemColours(item: WorkItem) {
    const candidates = [
      item.service_code,
      humanise(item.service_code),
      item.work_type,
      humanise(item.work_type),
    ]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());

    for (const key of candidates) {
      const found = serviceColours[key];
      if (found) {
        return {
          background: found.colour_hex || "#4f8f86",
          text: found.text_colour_hex || "#ffffff",
        };
      }
    }

    return {
      background: "#4f8f86",
      text: "#ffffff",
    };
  }

  const calendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const mondayOffset = (firstDay.getDay() + 6) % 7;

    const days: Array<{
      day: number | null;
      date: string | null;
      items: WorkItem[];
    }> = [];

    for (let i = 0; i < mondayOffset; i += 1) {
      days.push({ day: null, date: null, items: [] });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = localDateKey(new Date(year, month, day));
      const items = workItems.filter((item) => {
        const dueMatch = item.due_date === date;
        const startMatch =
          !!item.start_at && localDateKey(new Date(item.start_at)) === date;
        return dueMatch || startMatch;
      });

      days.push({ day, date, items });
    }

    return days;
  }, [visibleMonth, workItems]);

  const selectedDateKey = localDateKey(selectedDate);

  const selectedDayItems = useMemo(
    () =>
      workItems
        .filter((item) => {
          const dueMatch = item.due_date === selectedDateKey;
          const startMatch =
            !!item.start_at &&
            localDateKey(new Date(item.start_at)) === selectedDateKey;
          return dueMatch || startMatch;
        })
        .sort((a, b) => {
          if (a.start_at && b.start_at) {
            return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
          }
          if (a.start_at) return -1;
          if (b.start_at) return 1;
          return a.title.localeCompare(b.title);
        }),
    [workItems, selectedDateKey]
  );

  const selectedDayTimed = useMemo(
    () => selectedDayItems.filter((item) => !!item.start_at),
    [selectedDayItems]
  );

  const selectedDayUntimed = useMemo(
    () => selectedDayItems.filter((item) => !item.start_at),
    [selectedDayItems]
  );

  const visibleWeekDays = useMemo(() => {
    const start = startOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index);
      const key = localDateKey(date);
      const items = workItems
        .filter((item) => {
          const dueMatch = item.due_date === key;
          const startMatch =
            !!item.start_at && localDateKey(new Date(item.start_at)) === key;
          return dueMatch || startMatch;
        })
        .sort((a, b) => {
          if (a.start_at && b.start_at) {
            return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
          }
          if (a.start_at) return -1;
          if (b.start_at) return 1;
          return a.title.localeCompare(b.title);
        });

      return { date, key, items };
    });
  }, [selectedDate, workItems]);

  const timelineStartHour = 6;
  const timelineEndHour = 20;
  const timelineHourHeight = 52;
  const timelineHours = Array.from(
    { length: timelineEndHour - timelineStartHour + 1 },
    (_, index) => timelineStartHour + index
  );

  function openDay(date: Date) {
    setSelectedDate(date);
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setCalendarView("day");
  }

  function moveCalendar(direction: -1 | 1) {
    if (calendarView === "month") {
      setVisibleMonth(
        new Date(
          visibleMonth.getFullYear(),
          visibleMonth.getMonth() + direction,
          1
        )
      );
      return;
    }

    const amount = calendarView === "week" ? 7 : 1;
    const next = addDays(selectedDate, amount * direction);
    setSelectedDate(next);
    setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  }

  function calendarToday() {
    const today = new Date();
    setSelectedDate(today);
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  function openWorkItem(item: WorkItem) {
    setSelectedWorkItem(item);
    setEditTitle(item.title || "");
    const itemDate = item.start_at
      ? localDateKey(new Date(item.start_at))
      : item.due_date || "";
    setEditDate(itemDate);
    setEditStartTime(item.start_at ? formatTime(item.start_at) : "");
    setEditEndTime(item.end_at ? formatTime(item.end_at) : "");
  }

  function closeWorkItem() {
    setSelectedWorkItem(null);
    setEditSaving(false);
  }

  function applyWorkItemPatch(itemId: string, patch: Partial<WorkItem>) {
    setWorkItems((current) =>
      current.map((row) => (row.id === itemId ? { ...row, ...patch } : row))
    );
  }

  async function saveWorkItemChanges() {
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
        due_date: editDate || null,
        start_at: startAt,
        end_at: endAt,
      };

      const { error } = await supabaseAny
        .from("crm_work_items")
        .update(patch)
        .eq("id", selectedWorkItem.id);

      if (error) throw error;

      applyWorkItemPatch(selectedWorkItem.id, patch);
      closeWorkItem();
    } catch (error: any) {
      alert(error?.message || "Could not update work item.");
      setEditSaving(false);
    }
  }

  async function markWorkItemComplete(item: WorkItem) {
    try {
      const completedAt = new Date().toISOString();

      const { error } = await supabaseAny
        .from("crm_work_items")
        .update({
          status: "completed",
          completed_at: completedAt,
        })
        .eq("id", item.id);

      if (error) throw error;

      applyWorkItemPatch(item.id, {
        status: "completed",
        completed_at: completedAt,
      });
      closeWorkItem();
    } catch (error: any) {
      alert(error?.message || "Could not complete work item.");
    }
  }

  function previousMonth() {
    setVisibleMonth(
      new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1)
    );
  }

  function nextMonth() {
    setVisibleMonth(
      new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1)
    );
  }

  function thisMonth() {
    const today = new Date();
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  const quickServiceOptions = useMemo(
    () =>
      Object.values(serviceColours)
        .filter((service) => service.service_name?.trim())
        .sort((a, b) => a.service_name.localeCompare(b.service_name)),
    [serviceColours]
  );

  function resetQuickCapture() {
    setQuickType("task");
    setQuickTitle("");
    setQuickClientId("");
    setQuickService("");
    setQuickDate(localDateKey());
    setQuickStartTime("09:00");
    setQuickEndTime("09:30");
    setQuickNotes("");
    setQuickError("");
  }

  function closeQuickCapture() {
    setQuickOpen(false);
    resetQuickCapture();
  }

  function quickTypeLabel(value: string) {
    const labels: Record<string, string> = {
      task: "Task",
      meeting: "Meeting",
      reminder: "Reminder",
      follow_up: "Follow-up",
      client_request: "Client request",
    };
    return labels[value] || humanise(value);
  }

  async function saveQuickCapture() {
    setQuickError("");

    if (!organisationId || !userId) {
      setQuickError("PracticePilot could not confirm your organisation and user.");
      return;
    }

    if (!quickTitle.trim()) {
      setQuickError("Please enter a title.");
      return;
    }

    if (!quickDate) {
      setQuickError("Please select a date.");
      return;
    }

    if (quickType === "meeting" && (!quickStartTime || !quickEndTime)) {
      setQuickError("Please enter the meeting start and end time.");
      return;
    }

    if (
      quickType === "meeting" &&
      quickStartTime &&
      quickEndTime &&
      quickEndTime <= quickStartTime
    ) {
      setQuickError("The meeting end time must be after the start time.");
      return;
    }

    setQuickSaving(true);

    try {
      const isMeeting = quickType === "meeting";
      const client = clients.find((item) => item.id === quickClientId) || null;

      const startAt = isMeeting
        ? new Date(`${quickDate}T${quickStartTime}:00`).toISOString()
        : null;

      const endAt = isMeeting
        ? new Date(`${quickDate}T${quickEndTime}:00`).toISOString()
        : null;

      const serviceCode =
        quickService ||
        (quickType === "meeting"
          ? "Meeting"
          : quickType === "follow_up"
            ? "Follow Up"
            : quickType === "client_request"
              ? "Client Query"
              : quickType === "reminder"
                ? "Ad Hoc"
                : "Ad Hoc");

      const payload = {
        organisation_id: organisationId,
        client_id: quickClientId || null,
        title: quickTitle.trim(),
        description: quickNotes.trim() || null,
        work_type: quickType,
        status: "not_started",
        priority: "normal",
        assigned_user_id: userId,
        created_by_user_id: userId,
        due_date: quickDate,
        start_at: startAt,
        end_at: endAt,
        is_all_day: !isMeeting,
        is_personal: !quickClientId,
        workflow_type: "quick_capture",
        workflow_stage: "captured",
        service_code: serviceCode,
        source_module: "crm",
      };

      const { data, error } = await supabaseAny
        .from("crm_work_items")
        .insert(payload)
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
          completed_at
        `)
        .single();

      if (error) throw error;

      const newItem: WorkItem = {
        ...(data as Omit<WorkItem, "crm_clients">),
        crm_clients: client
          ? {
              id: client.id,
              client_name: client.client_name,
            }
          : null,
      };

      setWorkItems((current) =>
        [...current, newItem].sort((a, b) => {
          const aDate = a.due_date || "9999-12-31";
          const bDate = b.due_date || "9999-12-31";
          return aDate.localeCompare(bDate);
        })
      );

      setVisibleMonth(() => {
        const [year, month] = quickDate.split("-").map(Number);
        return new Date(year, month - 1, 1);
      });

      closeQuickCapture();
    } catch (error) {
      console.error("Could not create CRM work item:", error);
      setQuickError(
        error instanceof Error ? error.message : "Could not save the work item."
      );
    } finally {
      setQuickSaving(false);
    }
  }

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const focusItems = useMemo(() => {
    const seen = new Set<string>();
    return [...overdue, ...dueToday, ...activeItems]
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .slice(0, 6);
  }, [overdue, dueToday, activeItems]);

  return (
    <div style={page}>
      <header style={hero}>
        <div>
          <div style={eyebrow}>My Day</div>
          <h1 style={heroTitle}>{greeting}, {firstName}</h1>
          <p style={heroSubtitle}>
            Here&apos;s what needs your attention. PracticePilot will keep the
            rest out of your head.
          </p>
        </div>

        <div style={heroAction}>
          <div style={heroActionLabel}>Today&apos;s focus</div>
          <div style={heroActionTitle}>
            {overdue.length > 0
              ? `${overdue.length} overdue item${overdue.length === 1 ? "" : "s"} need attention`
              : dueToday.length > 0
                ? `${dueToday.length} item${dueToday.length === 1 ? "" : "s"} due today`
                : "You're clear for today"}
          </div>
          <div style={heroActionMeta}>
            {overdue.length > 0
              ? "Start with the overdue work, then move through today."
              : dueToday.length > 0
                ? "Everything due today is collected below."
                : "Nothing urgent is currently waiting for you."}
          </div>
        </div>
      </header>

      {loadError ? <div style={errorBox}>{loadError}</div> : null}

      <section style={metricStrip}>
        <Metric
          label="Due today"
          value={dueToday.length}
          note="Work needing action"
          tone="navy"
        />
        <Metric
          label="Overdue"
          value={overdue.length}
          note="Needs attention"
          tone={overdue.length ? "amber" : "green"}
        />
        <Metric
          label="Meetings"
          value={meetingsToday.length}
          note="Time blocked today"
          tone="blue"
        />
        <Metric
          label="Waiting"
          value={waiting.length}
          note="Blocked / follow-up"
          tone="amber"
        />
        <Metric
          label="Personal"
          value={reminders.length}
          note="Reminders & follow-ups"
          tone="purple"
        />
        <Metric
          label="Completed"
          value={completedToday.length}
          note="Recorded as complete"
          tone="green"
        />
      </section>

      {quickOpen ? (
        <section style={quickTopPanel}>
          <div style={quickTopHeader}>
            <div>
              <div style={quickTopTitle}>Quick capture</div>
              <div style={quickTopSubtitle}>
                Add the work now and it will land straight in My Day and the calendar.
              </div>
            </div>
          </div>

          <div style={quickForm}>
            <div style={quickTypeRow}>
              {[
                ["task", "Task"],
                ["meeting", "Meeting"],
                ["reminder", "Reminder"],
                ["follow_up", "Follow-up"],
                ["client_request", "Client request"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  style={{
                    ...quickTypeButton,
                    ...(quickType === value ? quickTypeButtonActive : {}),
                  }}
                  onClick={() => setQuickType(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={quickGrid}>
              <label style={quickFieldWide}>
                <span style={quickLabel}>What needs to happen?</span>
                <input
                  value={quickTitle}
                  onChange={(event) => setQuickTitle(event.target.value)}
                  placeholder={`e.g. ${quickTypeLabel(quickType)} for client`}
                  style={quickInput}
                  autoFocus
                />
              </label>

              <label style={quickField}>
                <span style={quickLabel}>Client</span>
                <select
                  value={quickClientId}
                  onChange={(event) => setQuickClientId(event.target.value)}
                  style={quickInput}
                >
                  <option value="">Practice / personal</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.client_name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={quickField}>
                <span style={quickLabel}>Service / colour</span>
                <select
                  value={quickService}
                  onChange={(event) => setQuickService(event.target.value)}
                  style={quickInput}
                >
                  <option value="">Automatic</option>
                  {quickServiceOptions.map((service) => (
                    <option key={service.service_name} value={service.service_name}>
                      {service.service_name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={quickField}>
                <span style={quickLabel}>
                  {quickType === "meeting" ? "Meeting date" : "Due date"}
                </span>
                <input
                  type="date"
                  value={quickDate}
                  onChange={(event) => setQuickDate(event.target.value)}
                  style={quickInput}
                />
              </label>

              {quickType === "meeting" ? (
                <>
                  <label style={quickField}>
                    <span style={quickLabel}>Start</span>
                    <input
                      type="time"
                      value={quickStartTime}
                      onChange={(event) => setQuickStartTime(event.target.value)}
                      style={quickInput}
                    />
                  </label>

                  <label style={quickField}>
                    <span style={quickLabel}>End</span>
                    <input
                      type="time"
                      value={quickEndTime}
                      onChange={(event) => setQuickEndTime(event.target.value)}
                      style={quickInput}
                    />
                  </label>
                </>
              ) : null}

              <label style={quickFieldWide}>
                <span style={quickLabel}>Note</span>
                <textarea
                  value={quickNotes}
                  onChange={(event) => setQuickNotes(event.target.value)}
                  placeholder="Optional context"
                  style={quickTextarea}
                />
              </label>
            </div>

            {quickError ? <div style={quickErrorStyle}>{quickError}</div> : null}

            <div style={quickFooter}>
              <div style={quickHint}>
                {quickClientId
                  ? "This will be linked to the selected client."
                  : "No client selected — this will be treated as practice/personal work."}
              </div>

              <div style={quickActions}>
                <button
                  type="button"
                  style={quickSecondaryButton}
                  onClick={closeQuickCapture}
                  disabled={quickSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  style={quickPrimaryButton}
                  onClick={saveQuickCapture}
                  disabled={quickSaving}
                >
                  {quickSaving ? "Saving..." : `Add ${quickTypeLabel(quickType)}`}
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section style={calendarPanel}>
        <div style={calendarHeader}>
          <div>
            <div style={calendarTitle}>My calendar</div>
            <div style={calendarSubtitle}>
              {calendarView === "month"
                ? "Meetings, deadlines and work due across the month."
                : calendarView === "week"
                ? "Your week laid out against actual working time."
                : "Your day laid out by time, with untimed work kept separate."}
            </div>
          </div>

          <div style={calendarHeaderRight}>
            <div style={calendarViewToggle}>
              {(["month", "week", "day"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  style={{
                    ...calendarViewButton,
                    ...(calendarView === view ? calendarViewButtonActive : {}),
                  }}
                  onClick={() => {
                    setCalendarView(view);
                    if (view === "month") {
                      setVisibleMonth(
                        new Date(
                          selectedDate.getFullYear(),
                          selectedDate.getMonth(),
                          1
                        )
                      );
                    }
                  }}
                >
                  {view === "month" ? "Month" : view === "week" ? "Week" : "Day"}
                </button>
              ))}
            </div>

            <div style={calendarControls}>
              <button
                type="button"
                style={calendarAddWorkButton}
                onClick={() => {
                  setQuickOpen((current) => !current);
                  setQuickError("");
                  setQuickDate(localDateKey(selectedDate));
                }}
              >
                {quickOpen ? "Close" : "+ Add work"}
              </button>

              <span style={calendarControlDivider} />

              <button
                type="button"
                style={calendarNavButton}
                onClick={() => moveCalendar(-1)}
              >
                ‹
              </button>

              <div style={calendarPeriodTitle}>
                {calendarView === "month"
                  ? getMonthTitle(visibleMonth)
                  : calendarView === "week"
                  ? formatWeekTitle(selectedDate)
                  : formatDayTitle(selectedDate)}
              </div>

              <button
                type="button"
                style={calendarNavButton}
                onClick={() => moveCalendar(1)}
              >
                ›
              </button>

              <button
                type="button"
                style={calendarTodayButton}
                onClick={calendarToday}
              >
                Today
              </button>
            </div>
          </div>
        </div>

        {calendarView === "month" ? (
          <>
            <div style={calendarWeekHeader}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div key={day} style={calendarWeekDay}>
                  {day}
                </div>
              ))}
            </div>

            <div style={calendarGrid}>
              {calendarDays.map((day, index) => {
                const isToday = day.date === todayKey;

                return (
                  <button
                    type="button"
                    key={day.date || `blank-${index}`}
                    disabled={!day.date}
                    onClick={() => {
                      if (!day.date) return;
                      const [year, month, date] = day.date.split("-").map(Number);
                      openDay(new Date(year, month - 1, date));
                    }}
                    style={{
                      ...calendarDay,
                      ...(day.date ? calendarDayClickable : calendarDayBlank),
                      ...(isToday ? calendarDayToday : {}),
                    }}
                  >
                    {day.day ? (
                      <>
                        <div style={calendarDayTop}>
                          <span style={calendarDayNumber}>{day.day}</span>
                          {day.items.length > 0 ? (
                            <span style={calendarCount}>{day.items.length}</span>
                          ) : null}
                        </div>

                        <div style={calendarItems}>
                          {day.items.slice(0, 2).map((item) => {
                            const itemColours = getItemColours(item);
                            const completed = isComplete(item);

                            return (
                              <div
                                key={item.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openWorkItem(item);
                                }}
                                style={{
                                  ...calendarItem,
                                  background: itemColours.background,
                                  color: itemColours.text,
                                  ...(completed ? calendarItemCompleted : {}),
                                  cursor: "pointer",
                                }}
                                title={`${humanise(
                                  item.service_code || item.work_type
                                )} · ${item.title}${completed ? " · Completed" : ""}`}
                              >
                                <span
                                  style={{
                                    ...calendarItemText,
                                    color: itemColours.text,
                                  }}
                                >
                                  {completed ? "✓ " : ""}
                                  {item.start_at
                                    ? `${formatTime(item.start_at)} · `
                                    : ""}
                                  {item.title}
                                </span>
                              </div>
                            );
                          })}

                          {day.items.length > 2 ? (
                            <div style={calendarMore}>
                              +{day.items.length - 2} more
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {calendarView === "week" ? (
          <div style={weekViewShell}>
            <div style={weekAllDayGrid}>
              <div style={weekTimeCorner}>All day / due</div>
              {visibleWeekDays.map((day) => (
                <button
                  key={`all-${day.key}`}
                  type="button"
                  onClick={() => openDay(day.date)}
                  style={{
                    ...weekAllDayCell,
                    ...(day.key === todayKey ? weekTodayColumn : {}),
                  }}
                >
                  <div style={weekDayHeading}>
                    <span>{day.date.toLocaleDateString("en-ZA", { weekday: "short" })}</span>
                    <strong>{day.date.getDate()}</strong>
                  </div>

                  {day.items
                    .filter((item) => !item.start_at)
                    .slice(0, 3)
                    .map((item) => {
                      const colours = getItemColours(item);
                      return (
                        <span
                          key={item.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            openWorkItem(item);
                          }}
                          style={{
                            ...weekUntimedBadge,
                            background: colours.background,
                            color: colours.text,
                            cursor: "pointer",
                          }}
                        >
                          {item.title}
                        </span>
                      );
                    })}
                </button>
              ))}
            </div>

            <div style={weekTimelineGrid}>
              <div style={weekTimeAxis}>
                {timelineHours.map((hour) => (
                  <div
                    key={hour}
                    style={{
                      ...weekHourLabel,
                      height: timelineHourHeight,
                    }}
                  >
                    {String(hour).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {visibleWeekDays.map((day) => (
                <button
                  type="button"
                  key={day.key}
                  onClick={() => openDay(day.date)}
                  style={{
                    ...weekDayTimeline,
                    height:
                      (timelineEndHour - timelineStartHour + 1) *
                      timelineHourHeight,
                    ...(day.key === todayKey ? weekTodayColumn : {}),
                  }}
                >
                  {timelineHours.map((hour) => (
                    <span
                      key={hour}
                      style={{
                        ...timelineRule,
                        top: (hour - timelineStartHour) * timelineHourHeight,
                      }}
                    />
                  ))}

                  {day.items
                    .filter((item) => !!item.start_at)
                    .map((item) => {
                      const colours = getItemColours(item);
                      const startMinutes = getMinutesFromMidnight(item.start_at);
                      const endMinutes = item.end_at
                        ? getMinutesFromMidnight(item.end_at)
                        : startMinutes + 30;
                      const top = Math.max(
                        0,
                        ((startMinutes - timelineStartHour * 60) / 60) *
                          timelineHourHeight
                      );
                      const height = Math.max(
                        24,
                        ((Math.max(endMinutes, startMinutes + 30) -
                          startMinutes) /
                          60) *
                          timelineHourHeight
                      );

                      return (
                        <div
                          key={item.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            openWorkItem(item);
                          }}
                          style={{
                            ...weekTimedItem,
                            top,
                            height,
                            background: colours.background,
                            color: colours.text,
                            cursor: "pointer",
                          }}
                          title={`${formatTime(item.start_at)} ${item.title}`}
                        >
                          <strong>{formatTime(item.start_at)}</strong>
                          <span>{item.title}</span>
                        </div>
                      );
                    })}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {calendarView === "day" ? (
          <div style={dayViewShell}>
            {selectedDayUntimed.length > 0 ? (
              <div style={dayUntimedStrip}>
                <div style={dayUntimedLabel}>All day / due</div>
                <div style={dayUntimedItems}>
                  {selectedDayUntimed.map((item) => {
                    const colours = getItemColours(item);
                    return (
                      <div
                        key={item.id}
                        onClick={() => openWorkItem(item)}
                        style={{
                          ...dayUntimedItem,
                          borderLeftColor: colours.background,
                          cursor: "pointer",
                        }}
                      >
                        <div style={dayUntimedTitle}>{item.title}</div>
                        <div style={dayUntimedMeta}>
                          {getClientName(item)} ·{" "}
                          {humanise(item.service_code || item.work_type)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div style={dayTimelineWrap}>
              <div style={dayTimeAxis}>
                {timelineHours.map((hour) => (
                  <div
                    key={hour}
                    style={{ ...dayHourLabel, height: timelineHourHeight }}
                  >
                    {String(hour).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              <div
                style={{
                  ...dayTimeline,
                  height:
                    (timelineEndHour - timelineStartHour + 1) *
                    timelineHourHeight,
                }}
              >
                {timelineHours.map((hour) => (
                  <span
                    key={hour}
                    style={{
                      ...timelineRule,
                      top: (hour - timelineStartHour) * timelineHourHeight,
                    }}
                  />
                ))}

                {selectedDayTimed.length === 0 ? (
                  <div style={dayEmptyTimeline}>
                    No timed meetings or work blocks for this day.
                  </div>
                ) : null}

                {selectedDayTimed.map((item) => {
                  const colours = getItemColours(item);
                  const startMinutes = getMinutesFromMidnight(item.start_at);
                  const endMinutes = item.end_at
                    ? getMinutesFromMidnight(item.end_at)
                    : startMinutes + 30;
                  const top = Math.max(
                    0,
                    ((startMinutes - timelineStartHour * 60) / 60) *
                      timelineHourHeight
                  );
                  const height = Math.max(
                    34,
                    ((Math.max(endMinutes, startMinutes + 30) - startMinutes) /
                      60) *
                      timelineHourHeight
                  );

                  return (
                    <div
                      key={item.id}
                      onClick={() => openWorkItem(item)}
                      style={{
                        ...dayTimedItem,
                        top,
                        height,
                        borderLeftColor: colours.background,
                        background: `${colours.background}14`,
                        cursor: "pointer",
                      }}
                    >
                      <div style={dayTimedTime}>
                        {formatTime(item.start_at)}
                        {item.end_at ? ` – ${formatTime(item.end_at)}` : ""}
                      </div>
                      <div style={dayTimedTitle}>{item.title}</div>
                      <div style={dayTimedMeta}>
                        {getClientName(item)} ·{" "}
                        {humanise(item.service_code || item.work_type)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <div style={mainGrid}>
        <section style={panel}>
          <div style={panelHeader}>
            <div>
              <div style={panelTitle}>Today&apos;s priorities</div>
              <div style={panelSubtitle}>
                The work PP thinks you should look at first.
              </div>
            </div>
            <Link href="/crm/tasks" style={textLink}>
              View all work →
            </Link>
          </div>

          {loading ? (
            <div style={emptyState}>Loading your day...</div>
          ) : focusItems.length === 0 ? (
            <div style={emptyState}>
              <div style={emptyStateTitle}>You&apos;re clear for now.</div>
              <div style={emptyStateText}>
                New workflow actions, deadlines, reminders and personal tasks
                will appear here automatically.
              </div>
            </div>
          ) : (
            <div>
              {focusItems.map((item) => (
                <WorkRow key={item.id} item={item} todayKey={todayKey} />
              ))}
            </div>
          )}
        </section>

        <div style={rightStack}>
          <section style={panel}>
            <div style={panelHeaderCompact}>
              <div>
                <div style={panelTitle}>Today&apos;s schedule</div>
                <div style={panelSubtitle}>Meetings and time-blocked work.</div>
              </div>
            </div>

            {meetingsToday.length === 0 ? (
              <div style={smallEmpty}>
                No meetings or time blocks in PP today.
              </div>
            ) : (
              meetingsToday.slice(0, 5).map((item) => (
                <button
                  type="button"
                  key={item.id}
                  style={scheduleRowButton}
                  onClick={() => openWorkItem(item)}
                >
                  <div style={scheduleTime}>{formatTime(item.start_at)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={scheduleTitle}>{item.title}</div>
                    <div style={scheduleMeta}>{getClientName(item)}</div>
                  </div>
                </button>
              ))
            )}
          </section>

          <section style={panel}>
            <div style={panelHeaderCompact}>
              <div>
                <div style={panelTitle}>Waiting / follow-up</div>
                <div style={panelSubtitle}>
                  Things you cannot finish until someone responds.
                </div>
              </div>
            </div>

            {waiting.length === 0 ? (
              <div style={smallEmpty}>Nothing is currently blocked.</div>
            ) : (
              waiting.slice(0, 5).map((item) => (
                <div key={item.id} style={waitingRow}>
                  <div>
                    <div style={scheduleTitle}>{item.title}</div>
                    <div style={scheduleMeta}>
                      {getClientName(item)}
                      {item.waiting_on
                        ? ` · Waiting on ${humanise(item.waiting_on)}`
                        : ""}
                    </div>
                  </div>
                  <div style={statusWaiting}>Waiting</div>
                </div>
              ))
            )}
          </section>
        </div>
      </div>

      <section style={navyPanel}>
          <div>
            <div style={navyPanelTitle}>
              PP should remember the work so you don&apos;t have to.
            </div>
            <div style={navyPanelText}>
              Workflow actions will feed My Day automatically as we connect the
              modules.
            </div>
          </div>
          <Link href="/crm/clients" style={navyButton}>
            Open clients
          </Link>
      </section>

      {selectedWorkItem ? (
        <div style={workItemOverlay} onClick={closeWorkItem}>
          <div style={workItemDialog} onClick={(event) => event.stopPropagation()}>
            <div style={workItemDialogHeader}>
              <div>
                <div style={workItemDialogEyebrow}>
                  {humanise(selectedWorkItem.service_code || selectedWorkItem.work_type)}
                </div>
                <div style={workItemDialogTitle}>Work item</div>
              </div>
              <button type="button" style={workItemCloseButton} onClick={closeWorkItem}>
                ×
              </button>
            </div>

            <div style={workItemDialogBody}>
              <label style={workItemField}>
                <span style={workItemLabel}>Title</span>
                <input
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  style={workItemInput}
                />
              </label>

              <div style={workItemFieldGrid}>
                <label style={workItemField}>
                  <span style={workItemLabel}>Date</span>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(event) => setEditDate(event.target.value)}
                    style={workItemInput}
                  />
                </label>

                <label style={workItemField}>
                  <span style={workItemLabel}>Start</span>
                  <input
                    type="time"
                    value={editStartTime}
                    onChange={(event) => setEditStartTime(event.target.value)}
                    style={workItemInput}
                  />
                </label>

                <label style={workItemField}>
                  <span style={workItemLabel}>End</span>
                  <input
                    type="time"
                    value={editEndTime}
                    onChange={(event) => setEditEndTime(event.target.value)}
                    style={workItemInput}
                  />
                </label>
              </div>

              <div style={workItemMetaLine}>
                <span>{getClientName(selectedWorkItem)}</span>
                <span>•</span>
                <span>{humanise(selectedWorkItem.status || "not_started")}</span>
              </div>
            </div>

            <div style={workItemDialogFooter}>
              <button
                type="button"
                style={workItemSecondaryButton}
                onClick={() => markWorkItemComplete(selectedWorkItem)}
              >
                Mark complete
              </button>

              <div style={workItemDialogFooterRight}>
                <button type="button" style={workItemSecondaryButton} onClick={closeWorkItem}>
                  Cancel
                </button>
                <button
                  type="button"
                  style={workItemPrimaryButton}
                  onClick={saveWorkItemChanges}
                  disabled={editSaving}
                >
                  {editSaving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  tone: "navy" | "amber" | "green" | "blue" | "purple";
}) {
  const toneMap = {
    navy: { bg: "#eef2f6", fg: "#10233a" },
    amber: { bg: "#fff4df", fg: "#a85b00" },
    green: { bg: "#eaf6ee", fg: "#287447" },
    blue: { bg: "#edf4ff", fg: "#1d4ed8" },
    purple: { bg: "#f2effc", fg: "#6941c6" },
  };

  return (
    <div style={metric}>
      <div
        style={{
          ...metricIcon,
          background: toneMap[tone].bg,
          color: toneMap[tone].fg,
        }}
      >
        {value}
      </div>
      <div>
        <div style={metricLabel}>{label}</div>
        <div style={metricValue}>{value}</div>
        <div style={metricNote}>{note}</div>
      </div>
    </div>
  );
}

function WorkRow({
  item,
  todayKey,
}: {
  item: WorkItem;
  todayKey: string;
}) {
  const overdue = !!item.due_date && item.due_date < todayKey;
  const dueToday = item.due_date === todayKey;

  return (
    <div style={workRow}>
      <div style={entityBadge}>
        {getClientName(item)
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase())
          .join("") || "PP"}
      </div>

      <div style={workMain}>
        <div style={workTitle}>{item.title}</div>
        <div style={workMeta}>
          {getClientName(item)}
          {item.workflow_type ? ` · ${humanise(item.workflow_type)}` : ""}
        </div>
      </div>

      <div style={statusPill(item.status)}>{humanise(item.status)}</div>

      <div
        style={{
          ...dueText,
          ...(overdue || dueToday ? { color: "#b54708", fontWeight: 800 } : {}),
        }}
      >
        {overdue
          ? "Overdue"
          : dueToday
            ? "Today"
            : item.due_date
              ? new Date(`${item.due_date}T12:00:00`).toLocaleDateString("en-ZA", {
                  day: "2-digit",
                  month: "short",
                })
              : "—"}
      </div>

      {item.client_id ? (
        <Link href={`/crm/client/${item.client_id}`} style={rowAction}>
          Open
        </Link>
      ) : (
        <Link href="/crm/tasks" style={rowAction}>
          Open
        </Link>
      )}
    </div>
  );
}

function statusPill(status: string): React.CSSProperties {
  const base: React.CSSProperties = {
    justifySelf: "start",
    padding: "4px 7px",
    border: "1px solid",
    fontSize: "10px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  };

  if (status === "waiting") {
    return {
      ...base,
      background: "#fff4df",
      borderColor: "#efd39d",
      color: "#9a5a06",
    };
  }

  if (status === "ready") {
    return {
      ...base,
      background: "#edf4ff",
      borderColor: "#c8d8f3",
      color: "#1d4ed8",
    };
  }

  if (status === "completed") {
    return {
      ...base,
      background: "#eaf6ee",
      borderColor: "#bcdcc7",
      color: "#287447",
    };
  }

  return {
    ...base,
    background: "#f3f5f7",
    borderColor: "#d8dee7",
    color: "#4b5563",
  };
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: "28px 30px 36px",
  background: "#f3f6f6",
  color: "#10233a",
};

const hero: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 400px",
  gap: "28px",
  alignItems: "stretch",
  marginBottom: "20px",
};

const eyebrow: React.CSSProperties = {
  marginBottom: "7px",
  color: "#3f6b66",
  fontSize: "14px",
  fontWeight: 800,
  letterSpacing: 0,
};

const heroTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "34px",
  lineHeight: 1.12,
  fontWeight: 850,
  letterSpacing: "-0.025em",
  color: "#10233a",
};

const heroSubtitle: React.CSSProperties = {
  margin: "9px 0 0",
  color: "#596574",
  fontSize: "15px",
  lineHeight: 1.45,
};

const heroAction: React.CSSProperties = {
  border: "1px solid #b9d4cf",
  borderLeft: "4px solid #10233a",
  background: "#f2f8f7",
  padding: "13px 16px",
};

const heroActionLabel: React.CSSProperties = {
  color: "#3f6b66",
  fontSize: "13px",
  fontWeight: 800,
  letterSpacing: 0,
};

const heroActionTitle: React.CSSProperties = {
  marginTop: "6px",
  color: "#10233a",
  fontSize: "17px",
  lineHeight: 1.3,
  fontWeight: 900,
};

const heroActionMeta: React.CSSProperties = {
  marginTop: "5px",
  color: "#53645f",
  fontSize: "13px",
  lineHeight: 1.4,
};

const metricStrip: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
  border: "1px solid #d7e0df",
  background: "#ffffff",
  marginBottom: "14px",
};

const metric: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "12px 13px",
  borderRight: "1px solid #e7eceb",
};

const metricIcon: React.CSSProperties = {
  width: "34px",
  height: "34px",
  flex: "0 0 auto",
  display: "grid",
  placeItems: "center",
  borderRadius: "50%",
  fontSize: "13px",
  fontWeight: 900,
};

const metricLabel: React.CSSProperties = {
  color: "#4d5b6c",
  fontSize: "13px",
  fontWeight: 800,
  letterSpacing: 0,
};

const metricValue: React.CSSProperties = {
  marginTop: "1px",
  color: "#10233a",
  fontSize: "21px",
  lineHeight: 1.05,
  fontWeight: 900,
};

const metricNote: React.CSSProperties = {
  marginTop: "4px",
  color: "#697586",
  fontSize: "12px",
  lineHeight: 1.3,
};

const mainGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.65fr) minmax(330px, 0.8fr)",
  gap: "18px",
};

const rightStack: React.CSSProperties = {
  display: "grid",
  gap: "18px",
  alignContent: "start",
};

const panel: React.CSSProperties = {
  border: "1px solid #d7e0df",
  background: "#ffffff",
};

const panelHeader: React.CSSProperties = {
  minHeight: "58px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "10px 14px",
  borderBottom: "1px solid #e4eae9",
};

const panelHeaderCompact: React.CSSProperties = {
  ...panelHeader,
  minHeight: "66px",
};

const panelTitle: React.CSSProperties = {
  color: "#10233a",
  fontSize: "17px",
  lineHeight: 1.25,
  fontWeight: 900,
};

const panelSubtitle: React.CSSProperties = {
  marginTop: "4px",
  color: "#66717f",
  fontSize: "13px",
  lineHeight: 1.4,
};

const textLink: React.CSSProperties = {
  color: "#1d4ed8",
  fontSize: "13px",
  fontWeight: 800,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const workRow: React.CSSProperties = {
  minHeight: "58px",
  display: "grid",
  gridTemplateColumns: "42px minmax(0, 1fr) 130px 78px 68px",
  alignItems: "center",
  gap: "12px",
  padding: "8px 12px",
  borderBottom: "1px solid #e7eceb",
};

const entityBadge: React.CSSProperties = {
  width: "36px",
  height: "36px",
  display: "grid",
  placeItems: "center",
  background: "#eef2f6",
  color: "#10233a",
  border: "1px solid #dde3ea",
  fontSize: "12px",
  fontWeight: 900,
};

const workMain: React.CSSProperties = { minWidth: 0 };

const workTitle: React.CSSProperties = {
  color: "#10233a",
  fontSize: "14px",
  fontWeight: 900,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const workMeta: React.CSSProperties = {
  marginTop: "4px",
  color: "#637081",
  fontSize: "12px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const dueText: React.CSSProperties = {
  color: "#5d6877",
  fontSize: "12px",
  whiteSpace: "nowrap",
};

const rowAction: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #d1d8e0",
  color: "#10233a",
  background: "#ffffff",
  textAlign: "center",
  textDecoration: "none",
  fontSize: "12px",
  fontWeight: 800,
};

const emptyState: React.CSSProperties = {
  minHeight: "300px",
  display: "grid",
  placeContent: "center",
  textAlign: "center",
  padding: "38px",
};

const emptyStateTitle: React.CSSProperties = {
  color: "#287447",
  fontSize: "20px",
  fontWeight: 900,
};

const emptyStateText: React.CSSProperties = {
  maxWidth: "460px",
  marginTop: "8px",
  color: "#657180",
  fontSize: "14px",
  lineHeight: 1.5,
};

const smallEmpty: React.CSSProperties = {
  padding: "26px 17px",
  color: "#657180",
  fontSize: "13px",
  lineHeight: 1.4,
};

const scheduleRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "62px minmax(0, 1fr)",
  gap: "10px",
  padding: "13px 15px",
  borderBottom: "1px solid #e7eceb",
};

const scheduleTime: React.CSSProperties = {
  color: "#1d4ed8",
  fontSize: "13px",
  fontWeight: 900,
};

const scheduleTitle: React.CSSProperties = {
  color: "#10233a",
  fontSize: "14px",
  fontWeight: 900,
};

const scheduleMeta: React.CSSProperties = {
  marginTop: "3px",
  color: "#66717f",
  fontSize: "12px",
};

const waitingRow: React.CSSProperties = {
  minHeight: "62px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "12px 15px",
  borderBottom: "1px solid #e7eceb",
};

const statusWaiting: React.CSSProperties = {
  padding: "5px 8px",
  border: "1px solid #efd39d",
  background: "#fff4df",
  color: "#8f5608",
  fontSize: "12px",
  fontWeight: 800,
};

const bottomGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "0.8fr 1.2fr",
  gap: "18px",
  marginTop: "18px",
};

const softPanel: React.CSSProperties = {
  border: "1px solid #d7e0df",
  background: "#f2f8f7",
  padding: "19px 20px",
};

const softPanelTitle: React.CSSProperties = {
  color: "#10233a",
  fontSize: "16px",
  fontWeight: 900,
};

const softPanelText: React.CSSProperties = {
  marginTop: "6px",
  color: "#53645f",
  fontSize: "13px",
  lineHeight: 1.45,
};

const disabledButton: React.CSSProperties = {
  marginTop: "13px",
  padding: "10px 13px",
  border: "1px solid #cad8d5",
  background: "#edf3f2",
  color: "#62716d",
  fontSize: "13px",
  fontWeight: 800,
  cursor: "not-allowed",
};

const heroHeadingRow: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "24px",
};

const quickTopPanel: React.CSSProperties = {
  marginBottom: "20px",
  padding: "18px 20px",
  border: "1px solid #b9d4cf",
  background: "#f7fbfa",
};

const quickTopHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "16px",
};

const quickTopTitle: React.CSSProperties = {
  color: "#10233a",
  fontSize: "18px",
  fontWeight: 900,
};

const quickTopSubtitle: React.CSSProperties = {
  marginTop: "4px",
  color: "#56666b",
  fontSize: "13px",
  lineHeight: 1.4,
};

const quickCaptureHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "18px",
};

const quickAddButton: React.CSSProperties = {
  flex: "0 0 auto",
  minHeight: "34px",
  padding: "0 11px",
  marginTop: "2px",
  border: "1px solid #aebfbc",
  background: "#ffffff",
  color: "#294842",
  fontSize: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const quickCancelTop: React.CSSProperties = {
  flex: "0 0 auto",
  minHeight: "36px",
  padding: "0 12px",
  border: "1px solid #cad8d5",
  background: "#ffffff",
  color: "#43534f",
  fontSize: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const quickForm: React.CSSProperties = {
  marginTop: "18px",
  paddingTop: "17px",
  borderTop: "1px solid #d9e4e2",
};

const quickTypeRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "7px",
  marginBottom: "14px",
};

const quickTypeButton: React.CSSProperties = {
  minHeight: "34px",
  padding: "0 11px",
  border: "1px solid #cfdad8",
  background: "#ffffff",
  color: "#455661",
  fontSize: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const quickTypeButtonActive: React.CSSProperties = {
  border: "1px solid #4f8f86",
  background: "#eaf4f2",
  color: "#285f58",
};

const quickGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "12px",
};

const quickField: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: "5px",
};

const quickFieldWide: React.CSSProperties = {
  ...quickField,
  gridColumn: "1 / -1",
};

const quickLabel: React.CSSProperties = {
  color: "#3e505c",
  fontSize: "12px",
  fontWeight: 800,
};

const quickInput: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  height: "39px",
  boxSizing: "border-box",
  padding: "0 10px",
  border: "1px solid #cbd6d5",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "13px",
  fontWeight: 650,
  outline: "none",
};

const quickTextarea: React.CSSProperties = {
  ...quickInput,
  height: "68px",
  padding: "9px 10px",
  resize: "vertical",
  lineHeight: 1.4,
};

const quickErrorStyle: React.CSSProperties = {
  marginTop: "12px",
  padding: "9px 11px",
  border: "1px solid #e7a2a2",
  background: "#fff4f4",
  color: "#9d2d2d",
  fontSize: "12px",
  fontWeight: 750,
};

const quickFooter: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  marginTop: "14px",
  paddingTop: "13px",
  borderTop: "1px solid #d9e4e2",
};

const quickHint: React.CSSProperties = {
  color: "#5e6d71",
  fontSize: "12px",
  lineHeight: 1.4,
};

const quickActions: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flex: "0 0 auto",
};

const quickSecondaryButton: React.CSSProperties = {
  minHeight: "38px",
  padding: "0 13px",
  border: "1px solid #cbd6d5",
  background: "#ffffff",
  color: "#43525c",
  fontSize: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const quickPrimaryButton: React.CSSProperties = {
  minHeight: "38px",
  padding: "0 15px",
  border: "1px solid #10233a",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "12px",
  fontWeight: 850,
  cursor: "pointer",
};

const navyPanel: React.CSSProperties = {
  display: "flex",
  marginTop: "12px",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "18px",
  background: "#10233a",
  border: "1px solid #08172a",
  padding: "14px 16px",
  color: "#ffffff",
};

const navyPanelTitle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 900,
};

const navyPanelText: React.CSSProperties = {
  marginTop: "5px",
  color: "#d4dde6",
  fontSize: "13px",
  lineHeight: 1.4,
};

const navyButton: React.CSSProperties = {
  flex: "0 0 auto",
  padding: "10px 13px",
  border: "1px solid #d7e0e9",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 800,
};

const calendarPanel: React.CSSProperties = {
  marginBottom: "14px",
  border: "1px solid #d7e0df",
  background: "#ffffff",
};

const calendarHeader: React.CSSProperties = {
  minHeight: "58px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "18px",
  padding: "15px 17px",
  borderBottom: "1px solid #e4eae9",
};

const calendarTitle: React.CSSProperties = {
  color: "#10233a",
  fontSize: "18px",
  fontWeight: 900,
};

const calendarSubtitle: React.CSSProperties = {
  marginTop: "2px",
  color: "#66717f",
  fontSize: "12px",
  lineHeight: 1.4,
};

const calendarHeaderRight: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const calendarViewToggle: React.CSSProperties = {
  display: "flex",
  border: "1px solid #cfd9d8",
  background: "#ffffff",
};

const calendarViewButton: React.CSSProperties = {
  height: "34px",
  padding: "0 11px",
  border: "none",
  borderRight: "1px solid #dce3e2",
  background: "#ffffff",
  color: "#52616e",
  fontSize: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const calendarViewButtonActive: React.CSSProperties = {
  background: "#10233a",
  color: "#ffffff",
};

const calendarControls: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "7px",
};

const calendarAddWorkButton: React.CSSProperties = {
  height: "34px",
  padding: "0 12px",
  border: "1px solid #10233a",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "12px",
  fontWeight: 850,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const calendarControlDivider: React.CSSProperties = {
  width: "1px",
  height: "24px",
  background: "#d7dfde",
  margin: "0 3px",
};

const calendarNavButton: React.CSSProperties = {
  width: "36px",
  height: "36px",
  border: "1px solid #cfd9d8",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "20px",
  fontWeight: 800,
  cursor: "pointer",
};

const calendarPeriodTitle: React.CSSProperties = {
  minWidth: "168px",
  textAlign: "center",
  color: "#10233a",
  fontSize: "14px",
  fontWeight: 900,
};

const calendarTodayButton: React.CSSProperties = {
  height: "36px",
  padding: "0 12px",
  border: "1px solid #9fc9c2",
  background: "#f2f8f7",
  color: "#315f59",
  fontSize: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const calendarWeekHeader: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  background: "#f5f8f8",
  borderBottom: "1px solid #dfe7e6",
};

const calendarWeekDay: React.CSSProperties = {
  padding: "7px 9px",
  color: "#50606d",
  fontSize: "12px",
  fontWeight: 800,
  textAlign: "left",
  borderRight: "1px solid #e7eceb",
};

const calendarGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
};

const calendarDay: React.CSSProperties = {
  minHeight: "76px",
  padding: "6px 8px",
  border: "none",
  borderRight: "1px solid #e7eceb",
  borderBottom: "1px solid #e7eceb",
  background: "#ffffff",
  textAlign: "left",
  font: "inherit",
};

const calendarDayClickable: React.CSSProperties = {
  cursor: "pointer",
};

const calendarDayBlank: React.CSSProperties = {
  background: "#fafcfc",
};

const calendarDayToday: React.CSSProperties = {
  background: "#f2f8f7",
  boxShadow: "inset 0 0 0 2px #7fbab1",
};

const calendarDayTop: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "6px",
  marginBottom: "4px",
};

const calendarDayNumber: React.CSSProperties = {
  color: "#10233a",
  fontSize: "13px",
  fontWeight: 900,
};

const calendarCount: React.CSSProperties = {
  minWidth: "19px",
  height: "19px",
  display: "grid",
  placeItems: "center",
  borderRadius: "50%",
  background: "#e8f3f1",
  color: "#315f59",
  fontSize: "11px",
  fontWeight: 900,
};

const calendarItems: React.CSSProperties = {
  display: "grid",
  gap: "3px",
};

const calendarItem: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  minHeight: "20px",
  padding: "2px 6px",
  borderRadius: "4px",
};

const calendarItemCompleted: React.CSSProperties = {
  opacity: 0.62,
};

const calendarItemText: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "10.5px",
  fontWeight: 800,
};

const calendarMore: React.CSSProperties = {
  color: "#4f6f69",
  fontSize: "11px",
  fontWeight: 800,
};

const weekViewShell: React.CSSProperties = {
  overflowX: "auto",
  background: "#ffffff",
};

const weekAllDayGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "72px repeat(7, minmax(130px, 1fr))",
  minWidth: "1040px",
  borderBottom: "1px solid #dfe7e6",
};

const weekTimeCorner: React.CSSProperties = {
  padding: "10px 8px",
  background: "#f5f8f8",
  color: "#64717d",
  fontSize: "10px",
  fontWeight: 800,
  borderRight: "1px solid #e2e8e7",
};

const weekAllDayCell: React.CSSProperties = {
  minHeight: "78px",
  padding: "8px",
  border: "none",
  borderRight: "1px solid #e2e8e7",
  background: "#ffffff",
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
};

const weekDayHeading: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "8px",
  marginBottom: "6px",
  color: "#10233a",
  fontSize: "12px",
};

const weekUntimedBadge: React.CSSProperties = {
  display: "block",
  marginTop: "3px",
  padding: "3px 5px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "10px",
  fontWeight: 800,
};

const weekTimelineGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "72px repeat(7, minmax(130px, 1fr))",
  minWidth: "1040px",
};

const weekTimeAxis: React.CSSProperties = {
  background: "#fafbfb",
  borderRight: "1px solid #dfe7e6",
};

const weekHourLabel: React.CSSProperties = {
  boxSizing: "border-box",
  padding: "4px 8px 0 0",
  textAlign: "right",
  color: "#75808a",
  fontSize: "10px",
  borderTop: "1px solid #edf1f0",
};

const weekDayTimeline: React.CSSProperties = {
  position: "relative",
  border: "none",
  borderRight: "1px solid #e2e8e7",
  background: "#ffffff",
  padding: 0,
  cursor: "pointer",
  overflow: "hidden",
};

const weekTodayColumn: React.CSSProperties = {
  background: "#f5faf9",
};

const timelineRule: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  height: "1px",
  background: "#edf1f0",
};

const weekTimedItem: React.CSSProperties = {
  position: "absolute",
  left: "5px",
  right: "5px",
  zIndex: 2,
  boxSizing: "border-box",
  padding: "4px 5px",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  gap: "1px",
  textAlign: "left",
  fontSize: "10px",
  fontWeight: 700,
};

const dayViewShell: React.CSSProperties = {
  background: "#ffffff",
};

const dayUntimedStrip: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "110px minmax(0, 1fr)",
  borderBottom: "1px solid #dfe7e6",
};

const dayUntimedLabel: React.CSSProperties = {
  padding: "12px 14px",
  background: "#f7f9f9",
  color: "#53616d",
  fontSize: "11px",
  fontWeight: 850,
  borderRight: "1px solid #e2e8e7",
};

const dayUntimedItems: React.CSSProperties = {
  display: "grid",
  gap: "6px",
  padding: "8px 12px",
};

const dayUntimedItem: React.CSSProperties = {
  padding: "7px 10px",
  border: "1px solid #e1e6e5",
  borderLeft: "4px solid #4f8f86",
  background: "#ffffff",
};

const dayUntimedTitle: React.CSSProperties = {
  color: "#10233a",
  fontSize: "12px",
  fontWeight: 850,
};

const dayUntimedMeta: React.CSSProperties = {
  marginTop: "2px",
  color: "#69747e",
  fontSize: "10px",
};

const dayTimelineWrap: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "72px minmax(0, 1fr)",
};

const dayTimeAxis: React.CSSProperties = {
  background: "#fafbfb",
  borderRight: "1px solid #dfe7e6",
};

const dayHourLabel: React.CSSProperties = {
  boxSizing: "border-box",
  padding: "4px 10px 0 0",
  textAlign: "right",
  color: "#75808a",
  fontSize: "10px",
  borderTop: "1px solid #edf1f0",
};

const dayTimeline: React.CSSProperties = {
  position: "relative",
  background: "#ffffff",
  overflow: "hidden",
};

const dayTimedItem: React.CSSProperties = {
  position: "absolute",
  left: "14px",
  right: "14px",
  zIndex: 2,
  boxSizing: "border-box",
  padding: "7px 10px",
  border: "1px solid #dce3e2",
  borderLeft: "5px solid #4f8f86",
  overflow: "hidden",
};

const dayTimedTime: React.CSSProperties = {
  color: "#344854",
  fontSize: "10px",
  fontWeight: 900,
};

const dayTimedTitle: React.CSSProperties = {
  marginTop: "2px",
  color: "#10233a",
  fontSize: "13px",
  fontWeight: 900,
};

const dayTimedMeta: React.CSSProperties = {
  marginTop: "2px",
  color: "#5f6e78",
  fontSize: "10px",
};

const dayEmptyTimeline: React.CSSProperties = {
  position: "absolute",
  top: "20px",
  left: "20px",
  color: "#7a858d",
  fontSize: "12px",
};

const scheduleRowButton: React.CSSProperties = {
  width: "100%",
  display: "grid",
  gridTemplateColumns: "74px minmax(0, 1fr)",
  gap: "10px",
  alignItems: "center",
  padding: "10px 12px",
  border: "none",
  borderBottom: "1px solid #e7eceb",
  background: "#ffffff",
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
};

const workItemOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  background: "rgba(16,35,58,0.38)",
};

const workItemDialog: React.CSSProperties = {
  width: "min(620px, 100%)",
  background: "#ffffff",
  border: "1px solid #cfd8d7",
  boxShadow: "0 24px 70px rgba(16,35,58,0.18)",
};

const workItemDialogHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "16px",
  padding: "18px 20px",
  borderBottom: "1px solid #e2e8e7",
};

const workItemDialogEyebrow: React.CSSProperties = {
  color: "#5d6c67",
  fontSize: "11px",
  fontWeight: 800,
};

const workItemDialogTitle: React.CSSProperties = {
  marginTop: "2px",
  color: "#10233a",
  fontSize: "21px",
  fontWeight: 900,
};

const workItemCloseButton: React.CSSProperties = {
  width: "32px",
  height: "32px",
  border: "1px solid #cfd8d7",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "20px",
  lineHeight: 1,
  cursor: "pointer",
};

const workItemDialogBody: React.CSSProperties = {
  display: "grid",
  gap: "14px",
  padding: "18px 20px",
};

const workItemFieldGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 0.9fr 0.9fr",
  gap: "10px",
};

const workItemField: React.CSSProperties = {
  display: "grid",
  gap: "6px",
};

const workItemLabel: React.CSSProperties = {
  color: "#4d5e69",
  fontSize: "11px",
  fontWeight: 850,
};

const workItemInput: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: "38px",
  border: "1px solid #cfd8d7",
  background: "#ffffff",
  color: "#10233a",
  padding: "0 10px",
  fontSize: "13px",
  fontWeight: 700,
  outline: "none",
};

const workItemMetaLine: React.CSSProperties = {
  display: "flex",
  gap: "7px",
  alignItems: "center",
  color: "#6b7780",
  fontSize: "11px",
};

const workItemDialogFooter: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "14px 20px",
  borderTop: "1px solid #e2e8e7",
  background: "#f8faf9",
};

const workItemDialogFooterRight: React.CSSProperties = {
  display: "flex",
  gap: "8px",
};

const workItemSecondaryButton: React.CSSProperties = {
  minHeight: "36px",
  padding: "0 12px",
  border: "1px solid #c8d2d1",
  background: "#ffffff",
  color: "#314651",
  fontSize: "12px",
  fontWeight: 850,
  cursor: "pointer",
};

const workItemPrimaryButton: React.CSSProperties = {
  minHeight: "36px",
  padding: "0 14px",
  border: "1px solid #10233a",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "12px",
  fontWeight: 850,
  cursor: "pointer",
};

const errorBox: React.CSSProperties = {
  marginBottom: "14px",
  padding: "12px 14px",
  border: "1px solid #e4a0a0",
  background: "#fff3f3",
  color: "#9f2d2d",
  fontSize: "13px",
  fontWeight: 700,
};

