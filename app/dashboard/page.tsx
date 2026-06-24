"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type UserProfile = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  access_enabled: boolean;
};

type DbTask = {
  id: string;
  task_title: string;
  task_description: string | null;
  service_name: string | null;
  task_status: string | null;
  due_date: string | null;
  period_start: string | null;
  period_end: string | null;
  has_deadline: boolean | null;
  client_id: string | null;
  review_notes: string | null;
  meeting_start_time: string | null;
meeting_end_time: string | null;
meeting_location: string | null;
};

type DbClient = {
  id: string;
  client_name: string | null;
};

type TaskDocument = {
  id: string;
  task_id: string;
  document_name: string;
  document_type: string | null;
  file_url: string | null;
  notes: string | null;
  created_at: string;
};

type TimeEntry = {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  stopped_at: string | null;
  duration_seconds: number | null;
  note: string | null;
  work_stage: "doing" | "review" | "correction" | "submission";
};

type WorkStage = "doing" | "review" | "correction" | "submission";

type WorkStatus =
  | "Overdue"
  | "Due Today"
  | "Upcoming"
  | "Review"
  | "Correction"
  | "Submission"
  | "Done";

type WorkItem = {
  id: string;
  clientId: string | null;
  meetingStartTime: string | null;
meetingEndTime: string | null;
meetingLocation: string | null;
  title: string;
  client: string;
  type: string;
  dueDate: string;
  periodLabel: string;
  status: WorkStatus;
  rawStatus: string;
  reviewNotes: string | null;
  serviceColour: string;
  serviceTextColour: string;
};

type ServiceColourRow = {
  service_name: string;
  colour_hex: string | null;
  text_colour_hex: string | null;
};

type ClientOption = {
  id: string;
  client_name: string | null;
};

type UserOption = {
  id: string;
  full_name: string | null;
  email: string;
};

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

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getMonthTitle(date: Date) {
  return date.toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  });
}

function getPeriodLabel(periodStart: string | null) {
  if (!periodStart) return "No period";

  const date = new Date(`${periodStart}T00:00:00`);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}/${month}`;
}

function getStatus(task: DbTask): WorkStatus {
  const rawStatus = (task.task_status || "").toLowerCase();
  const todayKey = formatDateKey(new Date());

  if (rawStatus.includes("complete") || rawStatus.includes("done")) return "Done";
  if (rawStatus.includes("submitted")) return "Done";
  if (rawStatus.includes("approved")) return "Submission";
  if (rawStatus.includes("correction")) return "Correction";
  if (rawStatus.includes("review")) return "Review";

  if (!task.due_date) return "Upcoming";
  if (task.due_date < todayKey) return "Overdue";
  if (task.due_date === todayKey) return "Due Today";

  return "Upcoming";
}

function getTaskStage(task: WorkItem): WorkStage {
  if (task.status === "Review") return "review";
  if (task.status === "Correction") return "correction";
  if (task.status === "Submission") return "submission";
  return "doing";
}

function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  return {
    startKey: formatDateKey(start),
    endKey: formatDateKey(end),
  };
}

function formatTimer(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(secs).padStart(2, "0"),
  ].join(":");
}

function isAdHocType(type: string) {
  return ["Ad Hoc", "Client Query", "SARS Query", "Admin", "Follow Up", "Meeting"].includes(type);
}

function getWorkItemHeading(item: WorkItem) {
  if (isAdHocType(item.type)) {
    return `${item.title} - ${item.client}`;
  }

  return `${item.type} - ${item.client}`;
}

function getCalendarBadge(status: WorkStatus) {
  if (status === "Review") return "R";
  if (status === "Correction") return "C";
  if (status === "Submission") return "S";
  if (status === "Done") return "✓";
  return "";
}

function getStageLabel(stage: WorkStage) {
  if (stage === "doing") return "Doing time";
  if (stage === "review") return "Review time";
  if (stage === "correction") return "Correction time";
  return "Submission time";
}

function cleanFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9.\-_]/g, "-");
}

export default function PilotHubPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [manualTask, setManualTask] = useState("");
  const [manualTaskDueDate, setManualTaskDueDate] = useState(() => formatDateKey(new Date()));
const [manualTaskCategory, setManualTaskCategory] = useState("Ad Hoc");
const [manualTaskClientId, setManualTaskClientId] = useState("");
const [manualTaskAssigneeId, setManualTaskAssigneeId] = useState("");
const [manualMeetingStartTime, setManualMeetingStartTime] = useState("09:00");
const [manualMeetingEndTime, setManualMeetingEndTime] = useState("10:00");
const [manualMeetingLocation, setManualMeetingLocation] = useState("");
const meetingStartInputRef = useRef<HTMLInputElement | null>(null);
const meetingEndInputRef = useRef<HTMLInputElement | null>(null);
const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [dbTasks, setDbTasks] = useState<DbTask[]>([]);
  const [clientMap, setClientMap] = useState<Record<string, string>>({});
  const [serviceColours, setServiceColours] = useState<Record<string, ServiceColourRow>>({});
  const [selectedTask, setSelectedTask] = useState<WorkItem | null>(null);
  const [isEditingTask, setIsEditingTask] = useState(false);
const [editTaskTitle, setEditTaskTitle] = useState("");
const [editTaskDueDate, setEditTaskDueDate] = useState("");
const [editTaskCategory, setEditTaskCategory] = useState("Ad Hoc");
const [editTaskClientId, setEditTaskClientId] = useState("");
const [editMeetingStartTime, setEditMeetingStartTime] = useState("09:00");
const [editMeetingEndTime, setEditMeetingEndTime] = useState("10:00");
const [editMeetingLocation, setEditMeetingLocation] = useState("");
  const [runningTask, setRunningTask] = useState<WorkItem | null>(null);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [taskDocuments, setTaskDocuments] = useState<TaskDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);

  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

useEffect(() => {
  loadProfile();
  loadAdHocOptions();
}, []);

  useEffect(() => {
    loadTasks();
  }, [visibleMonth]);

  useEffect(() => {
    if (!selectedTask || !currentUserId) return;
    loadActiveTimer(selectedTask.id, selectedTask);
    loadTaskDocuments(selectedTask.id);
  }, [selectedTask, currentUserId]);

  useEffect(() => {
    if (!activeEntry) return;

    const timer = window.setInterval(() => {
      const started = new Date(activeEntry.started_at).getTime();
      const now = new Date().getTime();
      setElapsedSeconds(Math.floor((now - started) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeEntry]);

  async function loadProfile() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/login";
      return;
    }

    setCurrentUserId(user.id);

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      alert("Could not load your user profile.");
      await supabase.auth.signOut();
      window.location.href = "/login";
      return;
    }

    if (!data.access_enabled) {
      alert("Your access has been blocked. Please contact PracticePilot support.");
      await supabase.auth.signOut();
      window.location.href = "/login";
      return;
    }

    setProfile(data);
    setLoading(false);
  }

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

async function loadAdHocOptions() {
  const { data: clients, error: clientsError } = await supabase
    .from("crm_clients")
    .select("id, client_name")
    .order("client_name", { ascending: true });

  if (!clientsError && clients) {
    setClientOptions(clients as ClientOption[]);
  }

  const { data: users, error: usersError } = await supabase
    .from("user_profiles")
    .select("id, full_name, email")
    .eq("access_enabled", true)
    .order("full_name", { ascending: true });

  if (!usersError && users) {
    setUserOptions(users as UserOption[]);
  }
}

  async function loadTasks() {
    setTasksLoading(true);

    await loadServiceColours();

    const { data, error } = await supabase
      .from("crm_tasks")
      .select(
  "id, task_title, task_description, service_name, task_status, due_date, period_start, period_end, has_deadline, client_id, review_notes, meeting_start_time, meeting_end_time, meeting_location"
)
      .eq("has_deadline", true)
      .order("due_date", { ascending: true });

    if (error) {
      console.error(error);
      alert("Could not load CRM tasks.");
      setDbTasks([]);
      setTasksLoading(false);
      return;
    }

    const tasks = data || [];
    setDbTasks(tasks);

    const clientIds = Array.from(
      new Set(tasks.map((task) => task.client_id).filter(Boolean))
    ) as string[];

    if (clientIds.length > 0) {
      const { data: clients, error: clientsError } = await supabase
        .from("crm_clients")
        .select("id, client_name")
        .in("id", clientIds);

      if (!clientsError && clients) {
        const nextClientMap: Record<string, string> = {};

        (clients as DbClient[]).forEach((client) => {
          nextClientMap[client.id] = client.client_name || "Unnamed client";
        });

        setClientMap(nextClientMap);
      }
    } else {
      setClientMap({});
    }

    setTasksLoading(false);
  }

  async function loadTaskDocuments(taskId: string) {
    setDocumentsLoading(true);

    const { data, error } = await supabase
      .from("crm_task_documents")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setTaskDocuments([]);
      setDocumentsLoading(false);
      return;
    }

    setTaskDocuments((data || []) as TaskDocument[]);
    setDocumentsLoading(false);
  }

  async function uploadTaskDocument(file: File, documentType: string) {
    if (!selectedTask || !currentUserId) return;

    setUploadingDocument(true);

    const filePath = `${selectedTask.id}/${Date.now()}-${cleanFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from("task-documents")
      .upload(filePath, file, {
        upsert: false,
      });

    if (uploadError) {
      console.error(uploadError);
      alert("Could not upload document.");
      setUploadingDocument(false);
      return;
    }

    const { error: insertError } = await supabase.from("crm_task_documents").insert({
      task_id: selectedTask.id,
      uploaded_by: currentUserId,
      document_name: file.name,
      document_type: documentType,
      file_url: filePath,
      notes: null,
    });

    if (insertError) {
      console.error(insertError);
      alert("Document uploaded, but could not save document record.");
      setUploadingDocument(false);
      return;
    }

    await loadTaskDocuments(selectedTask.id);
    setUploadingDocument(false);
  }

  async function loadActiveTimer(taskId: string, task: WorkItem) {
    if (!currentUserId) return;

    const { data, error } = await supabase
      .from("crm_task_time_entries")
      .select("*")
      .eq("task_id", taskId)
      .eq("user_id", currentUserId)
      .is("stopped_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      return;
    }

    if (data) {
      setActiveEntry(data as TimeEntry);
      setRunningTask(task);

      const started = new Date(data.started_at).getTime();
      const now = new Date().getTime();
      setElapsedSeconds(Math.floor((now - started) / 1000));
    }
  }

  async function startTimer(stage: WorkStage) {
    if (!selectedTask || !currentUserId || activeEntry) return;

    const { data, error } = await supabase
      .from("crm_task_time_entries")
      .insert({
        task_id: selectedTask.id,
        user_id: currentUserId,
        work_stage: stage,
        note: `Started ${getStageLabel(stage)} for ${selectedTask.type} - ${selectedTask.client}`,
      })
      .select("*")
      .single();

    if (error) {
      console.error(error);
      alert("Could not start timer.");
      return;
    }

    setActiveEntry(data as TimeEntry);
    setRunningTask(selectedTask);
    setElapsedSeconds(0);
  }

  async function stopCurrentTimer(note: string) {
    if (!activeEntry) return;

    const now = new Date();
    const started = new Date(activeEntry.started_at);
    const durationSeconds = Math.max(
      0,
      Math.floor((now.getTime() - started.getTime()) / 1000)
    );

    const { error } = await supabase
      .from("crm_task_time_entries")
      .update({
        stopped_at: now.toISOString(),
        duration_seconds: durationSeconds,
        note,
      })
      .eq("id", activeEntry.id);

    if (error) {
      console.error(error);
      alert("Could not stop timer.");
      return;
    }

    setActiveEntry(null);
    setRunningTask(null);
    setElapsedSeconds(0);
  }

  async function pauseTimer() {
    const task = selectedTask || runningTask;
    if (!task || !activeEntry) return;

    await stopCurrentTimer(
      `Paused ${getStageLabel(activeEntry.work_stage)} for ${task.type} - ${task.client}`
    );
  }

  async function markReadyForReview() {
    if (!selectedTask) return;

    const hasVatReport = taskDocuments.some(
      (document) => document.document_type === "VAT Report"
    );

    if (selectedTask.type.toLowerCase().includes("vat") && !hasVatReport) {
      alert("Please upload the VAT Report before sending this task for review.");
      return;
    }

    if (activeEntry) {
      await stopCurrentTimer(`Ready for review: ${selectedTask.type} - ${selectedTask.client}`);
    }

    const { error } = await supabase
      .from("crm_tasks")
      .update({
        task_status: "Ready for review",
        ready_for_review_at: new Date().toISOString(),
      })
      .eq("id", selectedTask.id);

    if (error) {
      console.error(error);
      alert("Could not mark task as ready for review.");
      return;
    }

    await loadTasks();
    setSelectedTask(null);
  }

  async function approveForSubmission() {
    if (!selectedTask) return;

    if (activeEntry) {
      await stopCurrentTimer(`Approved for submission: ${selectedTask.type} - ${selectedTask.client}`);
    }

    const { error } = await supabase
      .from("crm_tasks")
      .update({
        task_status: "Approved for submission",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", selectedTask.id);

    if (error) {
      console.error(error);
      alert("Could not approve task.");
      return;
    }

    await loadTasks();
    setSelectedTask(null);
  }

  async function sendReviewNotes() {
    if (!selectedTask) return;

    const notes = window.prompt("Enter review notes for the employee:");
    if (!notes || !notes.trim()) return;

    if (activeEntry) {
      await stopCurrentTimer(`Review notes sent: ${selectedTask.type} - ${selectedTask.client}`);
    }

    const { error } = await supabase
      .from("crm_tasks")
      .update({
        task_status: "Correction required",
        review_notes: notes.trim(),
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", selectedTask.id);

    if (error) {
      console.error(error);
      alert("Could not send review notes.");
      return;
    }

    await loadTasks();
    setSelectedTask(null);
  }

  async function sendBackToReview() {
    if (!selectedTask) return;

    if (activeEntry) {
      await stopCurrentTimer(`Corrections completed: ${selectedTask.type} - ${selectedTask.client}`);
    }

    const { error } = await supabase
      .from("crm_tasks")
      .update({
        task_status: "Ready for review",
        ready_for_review_at: new Date().toISOString(),
      })
      .eq("id", selectedTask.id);

    if (error) {
      console.error(error);
      alert("Could not send task back to review.");
      return;
    }

    await loadTasks();
    setSelectedTask(null);
  }

  async function markSubmitted() {
    if (!selectedTask) return;

    if (activeEntry) {
      await stopCurrentTimer(`Submitted: ${selectedTask.type} - ${selectedTask.client}`);
    }

    const { error } = await supabase
      .from("crm_tasks")
      .update({
        task_status: "Submitted / Complete",
        completed_at: new Date().toISOString(),
      })
      .eq("id", selectedTask.id);

    if (error) {
      console.error(error);
      alert("Could not mark task as submitted.");
      return;
    }

    await loadTasks();
    setSelectedTask(null);
  }

  async function addManualTask() {
  const title = manualTask.trim();
  if (!title || !currentUserId) return;

  const response = await fetch("/api/crm/tasks/ad-hoc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task_title: title,
      due_date: manualTaskDueDate,
   assigned_to_user_id: manualTaskAssigneeId || profile?.id || null,
created_by_user_id: profile?.id || null,
client_id: manualTaskClientId || null,
ad_hoc_category: manualTaskCategory,
ad_hoc_notes:
  manualTaskCategory === "Meeting"
    ? `Meeting from ${manualMeetingStartTime} to ${manualMeetingEndTime}${
        manualMeetingLocation ? ` at ${manualMeetingLocation}` : ""
      }`
    : null,
meeting_start_time:
  manualTaskCategory === "Meeting" ? manualMeetingStartTime : null,
meeting_end_time:
  manualTaskCategory === "Meeting" ? manualMeetingEndTime : null,
meeting_location:
  manualTaskCategory === "Meeting" ? manualMeetingLocation || null : null,
    }),
  });

  const result = await response.json();

  if (!result.success) {
    alert(result.error || "Could not add ad hoc task.");
    return;
  }

  setManualTask("");
  setManualTaskDueDate(formatDateKey(new Date()));
  setManualTaskCategory("Ad Hoc");
  setManualTaskClientId("");
setManualTaskAssigneeId("");
setManualMeetingStartTime("09:00");
setManualMeetingEndTime("10:00");
setManualMeetingLocation("");   

  await loadTasks();
} 

  const workItems: WorkItem[] = useMemo(() => {
    return dbTasks
      .filter((task) => task.due_date)
      .map((task) => {
     const clientName = task.client_id
  ? clientMap[task.client_id] || "Client loading..."
  : "No client linked";

        const colours = getServiceColours(task.service_name, serviceColours);

        return {
          id: task.id,
          clientId: task.client_id,
          meetingStartTime: task.meeting_start_time || null,
          meetingEndTime: task.meeting_end_time || null,
          meetingLocation: task.meeting_location || null,
           title: task.task_title,
          client: clientName,
          type: task.service_name || "Task",
          dueDate: task.due_date as string,
          periodLabel: getPeriodLabel(task.period_start),
          status: getStatus(task),
          rawStatus: task.task_status || "Open",
          reviewNotes: task.review_notes,
          serviceColour: colours.background,
          serviceTextColour: colours.text,
        };
      });
  }, [dbTasks, clientMap, serviceColours]);

  const workListItems = useMemo(() => {
    const { endKey } = getMonthRange(visibleMonth);

    return workItems
      .filter((item) => item.status !== "Done")
      .filter((item) => {
        if (item.status === "Review") return true;
        if (item.status === "Correction") return true;
        if (item.status === "Submission") return true;

        return item.dueDate <= endKey;
      })
      .sort((a, b) => {
        const statusPriority: Record<WorkStatus, number> = {
          Overdue: 1,
          "Due Today": 2,
          Correction: 3,
          Review: 4,
          Submission: 5,
          Upcoming: 6,
          Done: 7,
        };

        const priorityDifference =
          statusPriority[a.status] - statusPriority[b.status];

        if (priorityDifference !== 0) return priorityDifference;

        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [workItems, visibleMonth]);

  const calendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const daysInMonth = lastDayOfMonth.getDate();
    const mondayBasedStartDay = (firstDayOfMonth.getDay() + 6) % 7;

    const days: Array<{
      day: number | null;
      date: string | null;
      items: WorkItem[];
    }> = [];

    for (let i = 0; i < mondayBasedStartDay; i += 1) {
      days.push({
        day: null,
        date: null,
        items: [],
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = formatDateKey(new Date(year, month, day));
      const items = workItems.filter((item) => item.dueDate === date);

      days.push({
        day,
        date,
        items,
      });
    }

    return days;
  }, [visibleMonth, workItems]);

  function goToPreviousMonth() {
    setVisibleMonth(
      new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1)
    );
  }

  function goToNextMonth() {
    setVisibleMonth(
      new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1)
    );
  }

  function goToThisMonth() {
    const today = new Date();
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

 function openTask(task: WorkItem) {
  setSelectedTask(task);
  setIsEditingTask(false);
  setEditTaskTitle(task.title);
  setEditTaskDueDate(task.dueDate);
  setEditTaskCategory(task.type);
   setEditTaskClientId(task.clientId || "");
   setEditMeetingStartTime(task.meetingStartTime || "09:00");
setEditMeetingEndTime(task.meetingEndTime || "10:00");
setEditMeetingLocation(task.meetingLocation || "");
}

async function saveTaskEdits() {
  if (!selectedTask) return;

  const title = editTaskTitle.trim();

  if (!title) {
    alert("Task title is required.");
    return;
  }

  const { error } = await supabase
    .from("crm_tasks")
.update({
  task_title: title,
  due_date: editTaskDueDate,
  period_start: editTaskDueDate,
  period_end: editTaskDueDate,
  service_name: editTaskCategory,
  ad_hoc_category: editTaskCategory,
  client_id: editTaskClientId || null,
  meeting_start_time: editTaskCategory === "Meeting" ? editMeetingStartTime : null,
  meeting_end_time: editTaskCategory === "Meeting" ? editMeetingEndTime : null,
  meeting_location: editTaskCategory === "Meeting" ? editMeetingLocation || null : null,
  ad_hoc_notes:
    editTaskCategory === "Meeting"
      ? `Meeting from ${editMeetingStartTime} to ${editMeetingEndTime}${
          editMeetingLocation ? ` at ${editMeetingLocation}` : ""
        }`
      : null,
})
    .eq("id", selectedTask.id);

  if (error) {
    console.error(error);
    alert("Could not save task changes.");
    return;
  }

  setIsEditingTask(false);
  await loadTasks();

  setSelectedTask(null);
}

  function renderDocumentSection(task: WorkItem) {
    return (
      <div style={styles.documentsBox}>
        <div style={styles.documentsHeader}>
          <div>
            <strong>Working papers</strong>
            <div style={styles.smallText}>
              Upload reports and supporting documents for review.
            </div>
          </div>

          <label style={styles.uploadButton}>
            {uploadingDocument ? "Uploading..." : "Upload Document"}
            <input
              type="file"
              style={styles.hiddenInput}
              disabled={uploadingDocument}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";

                if (!file) return;

                await uploadTaskDocument(file, "Working Paper");
              }}
            />
          </label>
        </div>

        {documentsLoading && <div style={styles.emptySmall}>Loading documents...</div>}

        {!documentsLoading && taskDocuments.length === 0 && (
          <div style={styles.emptySmall}>No working papers uploaded yet.</div>
        )}

        {!documentsLoading &&
          taskDocuments.map((document) => (
            <div key={document.id} style={styles.documentRow}>
              <div>
                <strong>{document.document_name}</strong>
                <div style={styles.smallText}>
                  {document.document_type || "Document"} uploaded
                </div>
              </div>
              <span style={styles.documentBadge}>Attached</span>
            </div>
          ))}
      </div>
    );
  }

  function renderTaskActions(task: WorkItem) {
    const stage = getTaskStage(task);

    if (task.status === "Review") {
      return (
        <div style={{ ...styles.modalActions, gridTemplateColumns: "repeat(4, 1fr)" }}>
          <button
            style={{
              ...styles.actionButton,
              ...(activeEntry ? styles.disabledButton : {}),
            }}
            onClick={() => startTimer("review")}
            disabled={!!activeEntry}
          >
            🔎 Start Review
          </button>

          <button
            style={{
              ...styles.actionButton,
              ...(!activeEntry ? styles.disabledButton : {}),
            }}
            onClick={pauseTimer}
            disabled={!activeEntry}
          >
            ☕ Pause Review
          </button>

          <button style={styles.actionButton} onClick={approveForSubmission}>
            ✅ Approve
          </button>

          <button style={styles.actionButton} onClick={sendReviewNotes}>
            📝 Send Notes
          </button>
        </div>
      );
    }

    if (task.status === "Correction") {
      return (
        <div style={{ ...styles.modalActions, gridTemplateColumns: "repeat(3, 1fr)" }}>
          <button
            style={{
              ...styles.actionButton,
              ...(activeEntry ? styles.disabledButton : {}),
            }}
            onClick={() => startTimer("correction")}
            disabled={!!activeEntry}
          >
            🛠 Fix Notes
          </button>

          <button
            style={{
              ...styles.actionButton,
              ...(!activeEntry ? styles.disabledButton : {}),
            }}
            onClick={pauseTimer}
            disabled={!activeEntry}
          >
            ☕ Pause Fix
          </button>

          <button style={styles.actionButton} onClick={sendBackToReview}>
            🔁 Back to Review
          </button>
        </div>
      );
    }

    if (task.status === "Submission") {
      return (
        <div style={{ ...styles.modalActions, gridTemplateColumns: "repeat(3, 1fr)" }}>
          <button
            style={{
              ...styles.actionButton,
              ...(activeEntry ? styles.disabledButton : {}),
            }}
            onClick={() => startTimer("submission")}
            disabled={!!activeEntry}
          >
            📤 Start Submit
          </button>

          <button
            style={{
              ...styles.actionButton,
              ...(!activeEntry ? styles.disabledButton : {}),
            }}
            onClick={pauseTimer}
            disabled={!activeEntry}
          >
            ☕ Pause Submit
          </button>

          <button style={styles.actionButton} onClick={markSubmitted}>
            ✅ Submitted
          </button>
        </div>
      );
    }

    if (task.status === "Done") {
      return (
        <div style={{ ...styles.modalActions, gridTemplateColumns: "1fr" }}>
          <button style={styles.doneButton}>✅ Task Complete</button>
        </div>
      );
    }

    return (
      <div style={{ ...styles.modalActions, gridTemplateColumns: "repeat(4, 1fr)" }}>
        <button style={styles.actionButton}>Email client</button>

        <button
          style={{
            ...styles.actionButton,
            ...(activeEntry ? styles.disabledButton : {}),
          }}
          onClick={() => startTimer(stage)}
          disabled={!!activeEntry}
        >
          🚀 Launch Task
        </button>

        <button
          style={{
            ...styles.actionButton,
            ...(!activeEntry ? styles.disabledButton : {}),
          }}
          onClick={pauseTimer}
          disabled={!activeEntry}
        >
          ☕ Take a Breather
        </button>

        <button style={styles.actionButton} onClick={markReadyForReview}>
          🏁 Wrap Up
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.emptyState}>Loading PilotHub...</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <p style={styles.eyebrow}>PilotHub</p>

        <h1 style={styles.title}>
          Good morning, {profile?.full_name || profile?.email}
        </h1>

        <p style={styles.subtitle}>
          Your deadlines, tasks, review queue and work notes in one place.
        </p>

        <div style={styles.headerActions}>
          <a href="/crm" style={styles.primaryButton}>
            Open CRM
          </a>
        </div>
      </section>

      <section style={styles.topGrid}>
        <div style={styles.calendarCard}>
          <div style={styles.cardHeader}>
            <div style={styles.monthControls}>
              <button style={styles.monthButton} onClick={goToPreviousMonth}>
                ‹
              </button>

              <h2 style={styles.cardTitle}>{getMonthTitle(visibleMonth)}</h2>

              <button style={styles.monthButton} onClick={goToNextMonth}>
                ›
              </button>

              <button style={styles.thisMonthButton} onClick={goToThisMonth}>
                This month
              </button>
            </div>

            <span style={styles.cardBadge}>Monthly Calendar</span>
          </div>

          <div style={styles.weekHeader}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div key={day} style={styles.weekDay}>
                {day}
              </div>
            ))}
          </div>

          <div style={styles.calendarGrid}>
            {calendarDays.map((day, index) => (
              <div key={day.date || `blank-${index}`} style={styles.calendarDay}>
                {day.day && <div style={styles.dayNumber}>{day.day}</div>}

                {day.items.slice(0, 3).map((item) => {
                  const badge = getCalendarBadge(item.status);

                  return (
                    <button
                      key={item.id}
                      style={{
                        ...styles.calendarItem,
                        background: item.serviceColour,
                        color: item.serviceTextColour,
                      }}
                      onClick={() => openTask(item)}
                    >
                      <span style={styles.calendarItemText}>
                        {getWorkItemHeading(item)}, Period: {item.periodLabel}
                      </span>

                      {badge && <span style={styles.statusBadge}>{badge}</span>}
                    </button>
                  );
                })}

                {day.items.length > 3 && (
                  <div style={styles.moreItems}>+{day.items.length - 3} more</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <aside style={styles.workListCard}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>My Work List</h2>
            <span style={styles.cardBadge}>
              {tasksLoading ? "Loading" : `${workListItems.length} items`}
            </span>
          </div>

        <div style={styles.taskInputRow}>
  <input
    style={styles.taskInput}
    value={manualTask}
    onChange={(event) => setManualTask(event.target.value)}
    placeholder="Add ad hoc task..."
  />

  <input
    type="date"
    style={styles.taskInput}
    value={manualTaskDueDate}
    onChange={(event) => setManualTaskDueDate(event.target.value)}
  />

  <select
    style={styles.taskInput}
    value={manualTaskCategory}
    onChange={(event) => setManualTaskCategory(event.target.value)}
  >
    <option>Ad Hoc</option>
    <option>Client Query</option>
    <option>SARS Query</option>
    <option>Admin</option>
    <option>Follow Up</option>
    <option>Meeting</option>
  </select>

<select
  style={styles.taskInput}
  value={manualTaskClientId}
  onChange={(event) => setManualTaskClientId(event.target.value)}
>
  <option value="">No client linked</option>
  {clientOptions.map((client) => (
    <option key={client.id} value={client.id}>
      {client.client_name || "Unnamed client"}
    </option>
  ))}
</select>

{manualTaskCategory === "Meeting" && (
  <>
    <label style={styles.fieldLabel}>
      <span style={styles.fieldLabelText}>Start time</span>
      <input
        ref={meetingStartInputRef}
        type="time"
        style={styles.taskInput}
        value={manualMeetingStartTime}
        onChange={(event) => setManualMeetingStartTime(event.target.value)}
      />
    </label>

    <label style={styles.fieldLabel}>
      <span style={styles.fieldLabelText}>End time</span>
      <input
        ref={meetingEndInputRef}
        type="time"
        style={styles.taskInput}
        value={manualMeetingEndTime}
        
        onChange={(event) => setManualMeetingEndTime(event.target.value)}
      />
    </label>

    <label style={styles.fieldLabel}>
      <span style={styles.fieldLabelText}>Location / link</span>
      <input
        style={styles.taskInput}
        value={manualMeetingLocation}
        onChange={(event) => setManualMeetingLocation(event.target.value)}
        placeholder="Meeting location or link..."
      />
    </label>
  </>
)}

<select
  style={styles.taskInput}
  value={manualTaskAssigneeId}
  onChange={(event) => setManualTaskAssigneeId(event.target.value)}
>
  <option value="">Assign to me</option>
  {userOptions.map((user) => (
    <option key={user.id} value={user.id}>
      {user.full_name || user.email}
    </option>
  ))}
</select>

  <button style={styles.smallButton} onClick={addManualTask}>
    Add
  </button>
</div>  

          <div style={styles.workList}>
            {workListItems.length === 0 && (
              <div style={styles.emptySmall}>No open work due up to this month.</div>
            )}

            {workListItems.map((item) => (
              <button
                key={item.id}
                style={styles.workItem}
                onClick={() => openTask(item)}
              >
                <div style={styles.workItemText}>
                  <strong>
                   {getWorkItemHeading(item)}
                  </strong>
                  <div style={styles.smallText}>Period: {item.periodLabel}</div>
                </div>
                <span style={styles.statusPill}>{item.status}</span>
              </button>
            ))}
          </div>
        </aside>
      </section>

      {activeEntry && runningTask && (
        <button
          style={styles.floatingTimer}
          onClick={() => setSelectedTask(runningTask)}
        >
          <span style={styles.liveDot}>●</span>
          <span>{getStageLabel(activeEntry.work_stage)}</span>
          <span>
            {runningTask.type} - {runningTask.client}
          </span>
          <strong>{formatTimer(elapsedSeconds)}</strong>
          <span>Reopen</span>
        </button>
      )}

      {selectedTask && (
        <div style={styles.modalOverlay} onClick={() => setSelectedTask(null)}>
          <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
  <div style={styles.modalHeader}>
  <div>
    <p style={styles.eyebrow}>Task detail</p>
    <h2 style={styles.modalTitle}>
      {getWorkItemHeading(selectedTask)}
    </h2>
  </div>

  <div style={styles.modalHeaderButtons}>
    {isAdHocType(selectedTask.type) && (
      <button
        style={styles.editButton}
        onClick={() => setIsEditingTask(!isEditingTask)}
      >
        {isEditingTask ? "Cancel Edit" : "Edit"}
      </button>
    )}

    <button
      style={styles.closeButton}
      onClick={() => setSelectedTask(null)}
    >
      ×
    </button>
  </div>
</div>

{isEditingTask && (
  <div style={styles.editTaskBox}>
    <input
      style={styles.taskInput}
      value={editTaskTitle}
      onChange={(event) => setEditTaskTitle(event.target.value)}
      placeholder="Task title"
    />

    <input
      type="date"
      style={styles.taskInput}
      value={editTaskDueDate}
      onChange={(event) => setEditTaskDueDate(event.target.value)}
    />

    <select
      style={styles.taskInput}
      value={editTaskCategory}
      onChange={(event) => setEditTaskCategory(event.target.value)}
    >
      <option>Ad Hoc</option>
      <option>Client Query</option>
      <option>SARS Query</option>
      <option>Admin</option>
      <option>Follow Up</option>
      <option>Meeting</option>
    </select>

    <select
      style={styles.taskInput}
      value={editTaskClientId}
      onChange={(event) => setEditTaskClientId(event.target.value)}
    >
      <option value="">No client linked</option>
      {clientOptions.map((client) => (
        <option key={client.id} value={client.id}>
          {client.client_name || "Unnamed client"}
        </option>
      ))}
    </select>

    <button style={styles.saveEditButton} onClick={saveTaskEdits}>
      Save changes
    </button>
  </div>
)}

            <p style={styles.modalLine}>
              {selectedTask.client} {selectedTask.type} due on{" "}
              {formatDisplayDate(selectedTask.dueDate)}
            </p>

            <p style={styles.modalLine}>Period: {selectedTask.periodLabel}</p>

            {selectedTask.reviewNotes && (
              <div style={styles.notesBox}>
                <strong>Review notes:</strong>
                <p>{selectedTask.reviewNotes}</p>
              </div>
            )}

            {renderDocumentSection(selectedTask)}

            <div style={styles.timerBox}>
              <div style={styles.timerLabel}>
                {activeEntry
                  ? `${getStageLabel(activeEntry.work_stage)} is running`
                  : `${getStageLabel(getTaskStage(selectedTask))} ready`}
              </div>
              <div style={styles.timerValue}>{formatTimer(elapsedSeconds)}</div>
            </div>

            {renderTaskActions(selectedTask)}
          </div>
        </div>
      )}
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
    marginBottom: "28px",
    maxWidth: "720px",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "18px",
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
  topGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 420px",
    gap: "22px",
    alignItems: "start",
  },
  calendarCard: {
    background: "#ffffff",
    border: "1px solid #dbe5ee",
    borderRadius: "20px",
    boxShadow: "0 16px 40px rgba(11,47,79,0.08)",
    overflow: "hidden",
  },
  workListCard: {
    background: "#ffffff",
    border: "1px solid #dbe5ee",
    borderRadius: "20px",
    boxShadow: "0 16px 40px rgba(11,47,79,0.08)",
    paddingBottom: "18px",
  },
  cardHeader: {
    padding: "18px 20px",
    borderBottom: "1px solid #e5edf4",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
  },
  monthControls: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  monthButton: {
    width: "30px",
    height: "30px",
    borderRadius: "999px",
    border: "1px solid #dbe5ee",
    background: "#ffffff",
    color: "#0b2f4f",
    fontSize: "20px",
    fontWeight: 900,
    cursor: "pointer",
  },
  thisMonthButton: {
    height: "30px",
    borderRadius: "999px",
    border: "1px solid #dbe5ee",
    background: "#ffffff",
    color: "#0b2f4f",
    padding: "0 12px",
    fontSize: "12px",
    fontWeight: 900,
    cursor: "pointer",
  },
  cardTitle: {
    margin: 0,
    fontSize: "20px",
  },
  cardBadge: {
    fontSize: "12px",
    fontWeight: 900,
    color: "#007986",
    background: "#eaf8fa",
    borderRadius: "999px",
    padding: "6px 10px",
    whiteSpace: "nowrap",
  },
  weekHeader: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    background: "#f8fbfd",
    borderBottom: "1px solid #e5edf4",
  },
  weekDay: {
    padding: "12px",
    fontSize: "12px",
    fontWeight: 900,
    color: "#526173",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  calendarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
  },
  calendarDay: {
    minHeight: "112px",
    borderRight: "1px solid #eef3f7",
    borderBottom: "1px solid #eef3f7",
    padding: "10px",
  },
  dayNumber: {
    fontSize: "13px",
    fontWeight: 900,
    marginBottom: "8px",
  },
  calendarItem: {
    width: "100%",
    textAlign: "left",
    background: "#0b5cab",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "6px 7px",
    fontSize: "11px",
    fontWeight: 900,
    marginBottom: "5px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "6px",
  },
  calendarItemText: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  statusBadge: {
    background: "#ffffff",
    color: "#0b2f4f",
    borderRadius: "999px",
    width: "18px",
    height: "18px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: 900,
    flexShrink: 0,
  },
  moreItems: {
    fontSize: "11px",
    color: "#526173",
    fontWeight: 900,
    marginTop: "4px",
  },
taskInputRow: {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "8px",
  padding: "16px 18px",
  borderBottom: "1px solid #eef3f7",
},
  taskInput: {
    height: "46px",
    border: "1px solid #d5dde6",
    borderRadius: "10px",
    padding: "0 12px",
    fontSize: "14px",
    outline: "none",
  },
  smallButton: {
  background: "#0b5cab",
  color: "#ffffff",
  border: "none",
  borderRadius: "10px",
  padding: "13px 14px",
  fontSize: "13px",
  fontWeight: 900,
  cursor: "pointer",
  width: "100%",
},
  workList: {
    padding: "8px 18px 0",
  },
  workItem: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "14px 0",
    border: "none",
    borderBottom: "1px solid #eef3f7",
    background: "transparent",
    color: "#0b2f4f",
    textAlign: "left",
    cursor: "pointer",
  },
  workItemText: {
    minWidth: 0,
  },
  smallText: {
    marginTop: "4px",
    color: "#6b7788",
    fontSize: "12px",
  },
  statusPill: {
    alignSelf: "start",
    background: "#eaf8fa",
    color: "#007986",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "11px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  emptyState: {
    padding: "32px",
    textAlign: "center",
    color: "#7b8794",
    border: "1px dashed #c9d3df",
    borderRadius: "14px",
    background: "#ffffff",
  },
  emptySmall: {
    color: "#7b8794",
    fontSize: "13px",
    padding: "14px 0",
  },
  primaryButton: {
    background: "#0b5cab",
    color: "#ffffff",
    textDecoration: "none",
    borderRadius: "12px",
    padding: "13px 18px",
    fontSize: "14px",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  documentsBox: {
    marginTop: "16px",
    background: "#ffffff",
    border: "1px solid #dbe5ee",
    borderRadius: "16px",
    padding: "14px",
  },
  documentsHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    alignItems: "center",
    marginBottom: "10px",
  },
  uploadButton: {
    background: "#0b5cab",
    color: "#ffffff",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "12px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  hiddenInput: {
    display: "none",
  },
  documentRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "10px 0",
    borderTop: "1px solid #eef3f7",
  },
  documentBadge: {
    alignSelf: "start",
    background: "#eaf8fa",
    color: "#007986",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "11px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  floatingTimer: {
    position: "fixed",
    right: "24px",
    bottom: "24px",
    background: "#c1121f",
    color: "#ffffff",
    border: "none",
    borderRadius: "999px",
    padding: "14px 20px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontSize: "14px",
    fontWeight: 900,
    boxShadow: "0 18px 44px rgba(193,18,31,0.34)",
    cursor: "pointer",
    zIndex: 2000,
  },
  liveDot: {
    color: "#ffffff",
    fontSize: "14px",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(11,47,79,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "24px",
  },
  modal: {
    width: "760px",
    maxWidth: "100%",
    background: "#ffffff",
    borderRadius: "22px",
    padding: "24px",
    boxShadow: "0 24px 70px rgba(11,47,79,0.24)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    marginBottom: "18px",
  },
  modalTitle: {
    margin: "6px 0 0",
    fontSize: "24px",
  },
  closeButton: {
    border: "none",
    background: "#eef5fa",
    color: "#0b2f4f",
    width: "34px",
    height: "34px",
    borderRadius: "999px",
    fontSize: "22px",
    cursor: "pointer",
  },
  modalLine: {
    margin: "10px 0",
    color: "#334155",
    fontSize: "15px",
  },
  notesBox: {
    marginTop: "14px",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: "14px",
    padding: "12px 14px",
    color: "#7c2d12",
    fontSize: "13px",
    lineHeight: 1.45,
  },
  timerBox: {
    marginTop: "18px",
    background: "#f3f8fc",
    border: "1px solid #dbe5ee",
    borderRadius: "16px",
    padding: "16px",
    textAlign: "center",
  },
  timerLabel: {
    color: "#007986",
    fontSize: "12px",
    fontWeight: 900,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  timerValue: {
    marginTop: "6px",
    fontSize: "34px",
    fontWeight: 900,
    letterSpacing: "0.05em",
  },
  modalActions: {
    display: "grid",
    gap: "10px",
    marginTop: "22px",
  },
  actionButton: {
    background: "#0b5cab",
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
  },
  disabledButton: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  doneButton: {
    background: "#15803d",
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "13px",
    fontWeight: 900,
  },
  fieldLabel: {
  display: "grid",
  gap: "5px",
},

fieldLabelText: {
  fontSize: "11px",
  fontWeight: 900,
  color: "#526173",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
},

modalHeaderButtons: {
  display: "flex",
  alignItems: "center",
  gap: "8px",
},

editButton: {
  border: "1px solid #dbe5ee",
  background: "#ffffff",
  color: "#0b2f4f",
  borderRadius: "999px",
  padding: "8px 12px",
  fontSize: "12px",
  fontWeight: 900,
  cursor: "pointer",
},

editTaskBox: {
  display: "grid",
  gap: "8px",
  background: "#f8fbfd",
  border: "1px solid #dbe5ee",
  borderRadius: "14px",
  padding: "14px",
  marginBottom: "16px",
},

saveEditButton: {
  background: "#15803d",
  color: "#ffffff",
  border: "none",
  borderRadius: "10px",
  padding: "12px 14px",
  fontSize: "13px",
  fontWeight: 900,
  cursor: "pointer",
},


};