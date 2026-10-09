"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type PortalUser = {
  id: string;
  full_name: string | null;
  email: string;
};
type StaffUser = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
};

type BrowseItem = {
  id: string | null;
  name: string;
  path: string;
  type: "folder" | "file";
  size_bytes: number | null;
  modified_at: string | null;
};

type BrowseResponse = {
  success: boolean;
  linked: boolean;
  provider: string | null;
  root_path: string | null;
  current_path: string | null;
  current_name: string | null;
  items: BrowseItem[];
  message?: string;
};

type Message = {
  id: string;
  sender_type: "practice" | "client";
  sender_name: string | null;
  message_body: string;
  created_at: string;
};

type MeetingAction = {
  id: string;
  action_text: string;
  assigned_to_type: "practice" | "client";
  assigned_staff_user_id: string | null;
  assigned_portal_user_id: string | null;
  due_date: string | null;
  status: "open" | "completed" | "cancelled";
};

type Meeting = {
  id: string;
  title: string;
  meeting_at: string | null;
  meeting_type: string | null;
  location: string | null;
  attendees: string | null;
  minutes_text: string | null;
  shared_with_client: boolean;
  status: string;
  actions: MeetingAction[];
};

type Template = {
  id: string;
  template_name: string;
  request_type: string;
  title: string;
  description: string | null;
  default_due_days: number | null;
  requires_upload?: boolean;
};

type Schedule = {
  id: string;
  template_id: string;
  assigned_portal_user_id: string | null;
  schedule_type: "monthly" | "weekly";
  day_of_month: number | null;
  day_of_week: number | null;
  send_hour: number;
  is_active: boolean;
  next_run_at: string | null;
  crm_client_request_templates?: {
    template_name?: string;
  } | null;
};

function fmt(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function ClientCommunicationsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clientId = String(params?.id || "");

  const [tab, setTab] = useState<"messages" | "meetings" | "requests">("messages");
  const [clientName, setClientName] = useState("Client");
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [messageText, setMessageText] = useState("");
  const [messageUserId, setMessageUserId] = useState("");

  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingAt, setMeetingAt] = useState("");
  const [meetingType, setMeetingType] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [meetingAttendees, setMeetingAttendees] = useState("");
  const [meetingMinutes, setMeetingMinutes] = useState("");
  const [selectedMeetingId, setSelectedMeetingId] = useState("");

  const [actionText, setActionText] = useState("");
  const [actionOwner, setActionOwner] = useState<"practice" | "client">("practice");
  const [actionStaffUserId, setActionStaffUserId] = useState("");
  const [actionPortalUserId, setActionPortalUserId] = useState("");
  const [actionDueDate, setActionDueDate] = useState("");

  const [templateId, setTemplateId] = useState("");
  const [templatePortalUserId, setTemplatePortalUserId] = useState("");
  const [scheduleType, setScheduleType] = useState<"monthly" | "weekly">("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("20");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [sendHour, setSendHour] = useState("8");

  const [uploadFolderPath, setUploadFolderPath] = useState("");
  const [uploadFolderName, setUploadFolderName] = useState("");
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderBrowser, setFolderBrowser] = useState<BrowseResponse | null>(null);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState("");

  const selectedMeeting = useMemo(
    () => meetings.find((m) => m.id === selectedMeetingId) || null,
    [meetings, selectedMeetingId]
  );

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) || null,
    [templates, templateId]
  );

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function authHeaders() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Your PracticePilot login session could not be confirmed.");
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
  }

  async function loadAll() {
    setError("");

    try {
      const headers = await authHeaders();

      const [messageRes, meetingRes, templateRes, scheduleRes] =
        await Promise.all([
          fetch(`/api/crm/clients/${clientId}/portal-messages`, {
            cache: "no-store",
            headers,
          }),
          fetch(`/api/crm/clients/${clientId}/meetings`, {
            cache: "no-store",
            headers,
          }),
          fetch("/api/crm/request-templates", {
            cache: "no-store",
            headers,
          }),
          fetch(`/api/crm/clients/${clientId}/request-schedules`, {
            cache: "no-store",
            headers,
          }),
        ]);

      const [messageJson, meetingJson, templateJson, scheduleJson] =
        await Promise.all([
          messageRes.json(),
          meetingRes.json(),
          templateRes.json(),
          scheduleRes.json(),
        ]);

      if (!messageRes.ok) throw new Error(messageJson?.error || "Could not load messages.");
      if (!meetingRes.ok) throw new Error(meetingJson?.error || "Could not load meetings.");
      if (!templateRes.ok) throw new Error(templateJson?.error || "Could not load templates.");
      if (!scheduleRes.ok) throw new Error(scheduleJson?.error || "Could not load schedules.");

      setClientName(
        messageJson?.client?.client_name ||
          meetingJson?.client?.client_name ||
          "Client"
      );
      setPortalUsers(messageJson?.portal_users || meetingJson?.portal_users || []);
      setStaffUsers(meetingJson?.staff_users || []);
      if (!actionStaffUserId && meetingJson?.current_staff_user_id) {
        setActionStaffUserId(String(meetingJson.current_staff_user_id));
      }
      setMessages(messageJson?.messages || []);
      setMeetings(meetingJson?.meetings || []);
      setTemplates(templateJson?.templates || []);
      setSchedules(scheduleJson?.schedules || []);

      if (!selectedMeetingId && meetingJson?.meetings?.[0]?.id) {
        setSelectedMeetingId(meetingJson.meetings[0].id);
        const m = meetingJson.meetings[0];
        setMeetingTitle(m.title || "");
        setMeetingAt(m.meeting_at ? String(m.meeting_at).slice(0, 16) : "");
        setMeetingType(m.meeting_type || "");
        setMeetingLocation(m.location || "");
        setMeetingAttendees(m.attendees || "");
        setMeetingMinutes(m.minutes_text || "");
      }

      if (!templateId && templateJson?.templates?.[0]?.id) {
        setTemplateId(templateJson.templates[0].id);
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load communications."
      );
    }
  }

  async function sendMessage() {
    if (!messageText.trim()) return;

    const headers = await authHeaders();

    const res = await fetch(`/api/crm/clients/${clientId}/portal-messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message_body: messageText.trim(),
        portal_user_id: messageUserId || null,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json?.error || "Could not send message.");
      return;
    }

    setMessageText("");
    setNotice("Message sent.");
    await loadAll();
  }

  async function saveMeeting(operation: "create_meeting" | "update_meeting") {
    const headers = await authHeaders();

    const payload =
      operation === "create_meeting"
        ? {
            operation,
            title: meetingTitle,
            meeting_at: meetingAt || null,
            meeting_type: meetingType,
            location: meetingLocation,
            attendees: meetingAttendees,
            minutes_text: meetingMinutes,
          }
        : {
            operation,
            meeting_id: selectedMeetingId,
            title: meetingTitle,
            meeting_at: meetingAt || null,
            meeting_type: meetingType,
            location: meetingLocation,
            attendees: meetingAttendees,
            minutes_text: meetingMinutes,
          };

    const res = await fetch(`/api/crm/clients/${clientId}/meetings`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json?.error || "Could not save meeting.");
      return;
    }

    setNotice(operation === "create_meeting" ? "Meeting created." : "Meeting saved.");
    if (json?.meeting?.id) setSelectedMeetingId(json.meeting.id);
    await loadAll();
  }

  async function shareMeeting() {
    if (!selectedMeetingId) return;

    const headers = await authHeaders();
    const res = await fetch(`/api/crm/clients/${clientId}/meetings`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        operation: selectedMeeting?.shared_with_client
          ? "unshare_meeting"
          : "share_meeting",
        meeting_id: selectedMeetingId,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json?.error || "Could not update sharing.");
      return;
    }

    setNotice(
      selectedMeeting?.shared_with_client
        ? "Meeting removed from client portal."
        : "Meeting shared with client."
    );
    await loadAll();
  }

  async function addAction() {
    if (!selectedMeetingId || !actionText.trim()) return;

    const headers = await authHeaders();
    const res = await fetch(`/api/crm/clients/${clientId}/meetings`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        operation: "add_action",
        meeting_id: selectedMeetingId,
        action_text: actionText.trim(),
        assigned_to_type: actionOwner,
        assigned_staff_user_id:
          actionOwner === "practice" ? actionStaffUserId || null : null,
        assigned_portal_user_id:
          actionOwner === "client" ? actionPortalUserId || null : null,
        due_date: actionDueDate || null,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json?.error || "Could not add action.");
      return;
    }

    setActionText("");
    setActionDueDate("");
    setNotice("Action added.");
    await loadAll();
  }

  async function toggleAction(action: MeetingAction) {
    const headers = await authHeaders();

    const res = await fetch(`/api/crm/clients/${clientId}/meetings`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        operation: "toggle_action",
        meeting_id: selectedMeetingId,
        action_id: action.id,
        completed: action.status !== "completed",
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json?.error || "Could not update action.");
      return;
    }

    await loadAll();
  }

  async function browseDestinationFolder(targetPath?: string) {
    setFolderLoading(true);
    setFolderError("");

    try {
      const headers = await authHeaders();
      const params = new URLSearchParams();

      if (targetPath) {
        params.set("path", targetPath);
      }

      const response = await fetch(
        `/api/crm/clients/${clientId}/documents/browse${
          params.toString() ? `?${params.toString()}` : ""
        }`,
        {
          cache: "no-store",
          headers,
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error || "Could not browse the client document folders."
        );
      }

      if (!result?.linked) {
        throw new Error(
          result?.message ||
            "This client does not have a document folder mapping yet."
        );
      }

      setFolderBrowser(result as BrowseResponse);
      setFolderPickerOpen(true);
    } catch (caught) {
      setFolderError(
        caught instanceof Error
          ? caught.message
          : "Could not browse the client document folders."
      );
    } finally {
      setFolderLoading(false);
    }
  }

  function selectCurrentDestination() {
    if (!folderBrowser?.current_path) {
      setFolderError("Choose a destination folder.");
      return;
    }

    setUploadFolderPath(folderBrowser.current_path);
    setUploadFolderName(
      folderBrowser.current_name ||
        folderBrowser.current_path.split("/").filter(Boolean).pop() ||
        "Selected folder"
    );
    setFolderPickerOpen(false);
    setFolderError("");
  }

  async function sendTemplateNow() {
    if (!templateId) return;

    if (selectedTemplate?.requires_upload && !uploadFolderPath) {
      setError(
        "Choose where the client's uploaded document must be saved before sending this request."
      );
      return;
    }

    const headers = await authHeaders();

    const res = await fetch(
      `/api/crm/clients/${clientId}/portal-requests/from-template`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          template_id: templateId,
          assigned_portal_user_id: templatePortalUserId || null,
          upload_folder_path:
            selectedTemplate?.requires_upload ? uploadFolderPath : null,
          upload_folder_name:
            selectedTemplate?.requires_upload ? uploadFolderName : null,
        }),
      }
    );

    const json = await res.json();

    if (!res.ok) {
      setError(json?.error || "Could not send request.");
      return;
    }

    setNotice("Standard request sent.");
  }

  async function createSchedule() {    if (!templateId) return;

    if (selectedTemplate?.requires_upload && !uploadFolderPath) {
      setError(
        "Choose the upload destination before scheduling this document request."
      );
      return;
    }

    const headers = await authHeaders();

    const res = await fetch(`/api/crm/clients/${clientId}/request-schedules`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        operation: "create",
        template_id: templateId,
        assigned_portal_user_id: templatePortalUserId || null,
        schedule_type: scheduleType,
        day_of_month:
          scheduleType === "monthly" ? Number(dayOfMonth) : null,
        day_of_week:
          scheduleType === "weekly" ? Number(dayOfWeek) : null,
        send_hour: Number(sendHour),
        upload_folder_path:
          selectedTemplate?.requires_upload ? uploadFolderPath : null,
        upload_folder_name:
          selectedTemplate?.requires_upload ? uploadFolderName : null,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json?.error || "Could not create schedule.");
      return;
    }

    setNotice("Request schedule created.");
    await loadAll();
  }

  async function deleteSchedule(schedule: Schedule) {
    const templateName =
      schedule.crm_client_request_templates?.template_name ||
      "this scheduled request";
    if (
      !window.confirm(
        `Delete "${templateName}" schedule? Future automatic requests from this schedule will stop. This cannot be undone.`
      )
    ) {
      return;
    }
    setError("");
    setNotice("");
    try {
      const headers = await authHeaders();
      const res = await fetch(
        `/api/crm/clients/${clientId}/request-schedules`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            operation: "delete",
            schedule_id: schedule.id,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(
          json?.error || "Could not delete the request schedule."
        );
      }
      setSchedules((current) =>
        current.filter((item) => item.id !== schedule.id)
      );
      setNotice("Request schedule deleted.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not delete the request schedule."
      );
    }
  }
  function selectMeeting(meeting: Meeting) {
    setSelectedMeetingId(meeting.id);
    setMeetingTitle(meeting.title || "");
    setMeetingAt(meeting.meeting_at ? String(meeting.meeting_at).slice(0, 16) : "");
    setMeetingType(meeting.meeting_type || "");
    setMeetingLocation(meeting.location || "");
    setMeetingAttendees(meeting.attendees || "");
    setMeetingMinutes(meeting.minutes_text || "");
  }

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>CLIENT COMMUNICATIONS</div>
          <h1 style={styles.title}>{clientName}</h1>
          <p style={styles.subtitle}>
            Messages, meeting minutes, action items and recurring client requests.
          </p>
        </div>

        <div style={styles.headerActions}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => router.push(`/crm/client/${clientId}/portal-requests`)}
          >
            Requests & Actions
          </button>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => router.push(`/crm/client/${clientId}?tab=documents`)}
          >
            Back to Client
          </button>
        </div>
      </div>

      <div style={styles.tabs}>
        {[
          ["messages", "Messages"],
          ["meetings", "Meetings & Actions"],
          ["requests", "Standard Requests & Reminders"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key as any)}
            style={tab === key ? styles.tabActive : styles.tab}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}
      {notice ? <div style={styles.notice}>{notice}</div> : null}

      {tab === "messages" ? (
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <strong style={styles.panelTitle}>Secure client messages</strong>
              <div style={styles.helpText}>
                Messages remain attached to this client and are visible in the portal.
              </div>
            </div>

            <select
              value={messageUserId}
              onChange={(e) => setMessageUserId(e.target.value)}
              style={styles.select}
            >
              <option value="">All portal users</option>
              {portalUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name || user.email}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.messageList}>
            {messages.length ? (
              messages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    ...styles.messageRow,
                    justifyContent:
                      message.sender_type === "practice"
                        ? "flex-end"
                        : "flex-start",
                  }}
                >
                  <div
                    style={{
                      ...styles.messageBubble,
                      ...(message.sender_type === "practice"
                        ? styles.practiceBubble
                        : styles.clientBubble),
                    }}
                  >
                    <div style={styles.messageMeta}>
                      <strong>{message.sender_name || message.sender_type}</strong>
                      <span>{fmt(message.created_at)}</span>
                    </div>
                    <div style={styles.messageBody}>{message.message_body}</div>
                  </div>
                </div>
              ))
            ) : (
              <div style={styles.empty}>No messages yet.</div>
            )}
          </div>

          <div style={styles.composer}>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a secure message..."
              style={styles.textarea}
            />
            <button
              type="button"
              style={styles.primaryButton}
              onClick={() => void sendMessage()}
            >
              Send Message
            </button>
          </div>
        </section>
      ) : null}

      {tab === "meetings" ? (
        <div style={styles.meetingGrid}>
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <strong style={styles.panelTitle}>Meetings</strong>
                <div style={styles.helpText}>
                  Capture minutes and share selected meetings to the client portal.
                </div>
              </div>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => {
                  setSelectedMeetingId("");
                  setMeetingTitle("");
                  setMeetingAt("");
                  setMeetingType("");
                  setMeetingLocation("");
                  setMeetingAttendees("");
                  setMeetingMinutes("");
                }}
              >
                New Meeting
              </button>
            </div>

            <div style={styles.meetingList}>
              {meetings.map((meeting) => (
                <button
                  key={meeting.id}
                  type="button"
                  onClick={() => selectMeeting(meeting)}
                  style={
                    selectedMeetingId === meeting.id
                      ? styles.meetingListActive
                      : styles.meetingListButton
                  }
                >
                  <strong>{meeting.title}</strong>
                  <span>{fmt(meeting.meeting_at)}</span>
                  <span>
                    {meeting.shared_with_client ? "Shared with client" : "Draft"}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span>Meeting title</span>
                <input
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span>Date & time</span>
                <input
                  type="datetime-local"
                  value={meetingAt}
                  onChange={(e) => setMeetingAt(e.target.value)}
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span>Meeting type</span>
                <input
                  value={meetingType}
                  onChange={(e) => setMeetingType(e.target.value)}
                  placeholder="Review / Planning / General"
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span>Location / link</span>
                <input
                  value={meetingLocation}
                  onChange={(e) => setMeetingLocation(e.target.value)}
                  style={styles.input}
                />
              </label>

              <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                <span>Attendees</span>
                <input
                  value={meetingAttendees}
                  onChange={(e) => setMeetingAttendees(e.target.value)}
                  placeholder="Ferdi, Client, Janel..."
                  style={styles.input}
                />
              </label>

              <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                <span>Meeting minutes</span>
                <textarea
                  value={meetingMinutes}
                  onChange={(e) => setMeetingMinutes(e.target.value)}
                  style={styles.minutesTextarea}
                  placeholder="Capture the discussion, decisions and agreed next steps..."
                />
              </label>
            </div>

            <div style={styles.actionBar}>
              <button
                type="button"
                style={styles.primaryButton}
                onClick={() =>
                  void saveMeeting(
                    selectedMeetingId ? "update_meeting" : "create_meeting"
                  )
                }
              >
                {selectedMeetingId ? "Save Minutes" : "Create Meeting"}
              </button>

              {selectedMeetingId ? (
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => void shareMeeting()}
                >
                  {selectedMeeting?.shared_with_client
                    ? "Remove from Portal"
                    : "Share with Client"}
                </button>
              ) : null}
            </div>

            {selectedMeetingId ? (
              <div style={styles.actionsArea}>
                <div style={styles.actionsHeader}>
                  <strong>Action items / To-do list</strong>
                  <span>
                    Assign actions to the practice or to the client.
                  </span>
                </div>

                <div style={styles.addActionGrid}>
                  <input
                    value={actionText}
                    onChange={(e) => setActionText(e.target.value)}
                    placeholder="What needs to be done?"
                    style={styles.input}
                  />

                  <select
                    value={actionOwner}
                    onChange={(e) =>
                      setActionOwner(e.target.value as "practice" | "client")
                    }
                    style={styles.select}
                  >
                    <option value="practice">Practice</option>
                    <option value="client">Client</option>
                  </select>

                  {actionOwner === "client" ? (
                    <select
                      value={actionPortalUserId}
                      onChange={(e) => setActionPortalUserId(e.target.value)}
                      style={styles.select}
                    >
                      <option value="">Any portal user</option>
                      {portalUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.full_name || user.email}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={actionStaffUserId}
                      onChange={(e) => setActionStaffUserId(e.target.value)}
                      style={styles.select}
                    >
                      <option value="">Choose staff member</option>
                      {staffUsers.map((user) => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.full_name || user.email || "Staff member"}
                        </option>
                      ))}
                    </select>
                  )}

                  <input
                    type="date"
                    value={actionDueDate}
                    onChange={(e) => setActionDueDate(e.target.value)}
                    style={styles.input}
                  />

                  <button
                    type="button"
                    style={styles.primaryButton}
                    onClick={() => void addAction()}
                    disabled={
                      !actionText.trim() ||
                      (actionOwner === "practice" && !actionStaffUserId)
                    }
                  >
                    Add Action
                  </button>
                </div>

                <div style={styles.todoList}>
                  {(selectedMeeting?.actions || []).length ? (
                    selectedMeeting?.actions.map((action) => (
                      <label key={action.id} style={styles.todoRow}>
                        <input
                          type="checkbox"
                          checked={action.status === "completed"}
                          onChange={() => void toggleAction(action)}
                        />
                        <span
                          style={{
                            ...styles.todoText,
                            textDecoration:
                              action.status === "completed"
                                ? "line-through"
                                : "none",
                          }}
                        >
                          {action.action_text}
                        </span>
                        <span style={styles.todoOwner}>
                          {action.assigned_to_type === "client"
                            ? "Client"
                            : `Practice${
                                action.assigned_staff_user_id
                                  ? ` · ${
                                      staffUsers.find(
                                        (user) =>
                                          user.user_id ===
                                          action.assigned_staff_user_id
                                      )?.full_name ||
                                      staffUsers.find(
                                        (user) =>
                                          user.user_id ===
                                          action.assigned_staff_user_id
                                      )?.email ||
                                      "Assigned"
                                    }`
                                  : ""
                              }`}
                        </span>
                        <span style={styles.todoDue}>
                          {action.due_date || "No due date"}
                        </span>
                      </label>
                    ))
                  ) : (
                    <div style={styles.empty}>No action items yet.</div>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {tab === "requests" ? (
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <strong style={styles.panelTitle}>
                Standard Requests & Reminders
              </strong>
              <div style={styles.helpText}>
                Send a standard request immediately or schedule it to go out automatically.
              </div>
            </div>
          </div>

          <div style={styles.requestControls}>
            <label style={styles.field}>
              <span>Standard request</span>
              <select
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value);
                  setUploadFolderPath("");
                  setUploadFolderName("");
                  setFolderError("");
                }}
                style={styles.select}
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.template_name}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.field}>
              <span>Send to</span>
              <select
                value={templatePortalUserId}
                onChange={(e) => setTemplatePortalUserId(e.target.value)}
                style={styles.select}
              >
                <option value="">All portal users</option>
                {portalUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              style={styles.primaryButton}
              onClick={() => void sendTemplateNow()}
            >
              Send Now
            </button>
          </div>

          {selectedTemplate?.requires_upload ? (
            <div style={styles.destinationCard}>
              <div>
                <span style={styles.destinationLabel}>UPLOAD DESTINATION</span>
                <strong style={styles.destinationTitle}>
                  {uploadFolderName || "Choose the client's working-file folder"}
                </strong>
                <span style={styles.destinationPath}>
                  {uploadFolderPath ||
                    "The uploaded document will be saved directly into the folder selected here."}
                </span>
              </div>

              <button
                type="button"
                style={styles.secondaryButton}
                disabled={folderLoading}
                onClick={() =>
                  void browseDestinationFolder(
                    uploadFolderPath || undefined
                  )
                }
              >
                {folderLoading
                  ? "Loading..."
                  : uploadFolderPath
                    ? "Change Folder"                    : "Choose Folder"}
              </button>

              {folderError && !folderPickerOpen ? (
                <div style={styles.destinationError}>{folderError}</div>
              ) : null}
            </div>
          ) : null}

          <div style={styles.scheduleBox}>
            <strong style={styles.panelTitle}>Schedule this request</strong>

            <div style={styles.scheduleGrid}>
              <label style={styles.field}>
                <span>Frequency</span>
                <select
                  value={scheduleType}
                  onChange={(e) =>
                    setScheduleType(e.target.value as "monthly" | "weekly")
                  }
                  style={styles.select}
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>

              {scheduleType === "monthly" ? (
                <label style={styles.field}>
                  <span>Day of month</span>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(e.target.value)}
                    style={styles.input}
                  />
                </label>
              ) : (
                <label style={styles.field}>
                  <span>Day of week</span>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(e.target.value)}
                    style={styles.select}
                  >
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                  </select>
                </label>
              )}

              <label style={styles.field}>
                <span>Send hour</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={sendHour}
                  onChange={(e) => setSendHour(e.target.value)}
                  style={styles.input}
                />
              </label>

              <button
                type="button"
                style={styles.primaryButton}
                onClick={() => void createSchedule()}
              >
                Create Schedule
              </button>
            </div>

            <div style={styles.scheduleList}>
              {schedules.length ? (
                schedules.map((schedule) => (
                  <div key={schedule.id} style={styles.scheduleRow}>
                    <strong>
                      {schedule.crm_client_request_templates?.template_name ||
                        "Scheduled request"}
                    </strong>
                    <span>
                      {schedule.schedule_type === "monthly"
                        ? `Monthly on day ${schedule.day_of_month}`
                        : `Weekly on day ${schedule.day_of_week}`}
                    </span>
                    <span>Next: {fmt(schedule.next_run_at)}</span>
                    <span>
                      {schedule.is_active ? "Active" : "Paused"}
                    </span>
                    <button
                      type="button"
                      onClick={() => void deleteSchedule(schedule)}
                      style={styles.scheduleDeleteButton}
                    >
                      Delete
                    </button>
                  </div>
                ))
              ) : (
                <div style={styles.empty}>No schedules yet.</div>
              )}
            </div>
          </div>
        </section>
      ) : null}
      {folderPickerOpen && folderBrowser ? (
        <div style={styles.modalBackdrop}>
          <section style={styles.folderModal}>
            <div style={styles.folderModalHeader}>
              <div>
                <div style={styles.destinationLabel}>CLIENT WORKING FILE</div>
                <strong style={styles.folderModalTitle}>
                  Choose upload destination
                </strong>
                <div style={styles.folderModalSub}>
                  Select the folder where the client's upload must be stored.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFolderPickerOpen(false)}
                style={styles.modalClose}
              >
                ×
              </button>
            </div>

            <div style={styles.folderCurrent}>
              <div>
                <span>Current folder</span>
                <strong>
                  {folderBrowser.current_name || folderBrowser.current_path}
                </strong>
                <small>{folderBrowser.current_path}</small>
              </div>
              <span>{folderBrowser.provider || "Document provider"}</span>
            </div>

            <div style={styles.folderList}>
              {folderBrowser.root_path &&
              folderBrowser.current_path !== folderBrowser.root_path ? (
                <button
                  type="button"
                  style={styles.folderRow}
                  onClick={() => {
                    const current = String(folderBrowser.current_path || "");
                    const root = String(folderBrowser.root_path || "");
                    const currentParts = current.split("/").filter(Boolean);
                    const rootParts = root.split("/").filter(Boolean);

                    if (currentParts.length > rootParts.length) {
                      void browseDestinationFolder(
                        "/" + currentParts.slice(0, -1).join("/")
                      );
                    } else {
                      void browseDestinationFolder(root);
                    }
                  }}
                >
                  <span>←</span>
                  <strong>Back</strong>
                </button>
              ) : null}

              {(folderBrowser.items || [])
                .filter((item) => item.type === "folder")
                .map((folder) => (
                  <button
                    key={folder.path}
                    type="button"
                    style={styles.folderRow}
                    onClick={() =>
                      void browseDestinationFolder(folder.path)
                    }
                  >
                    <span>▰</span>
                    <span style={styles.folderRowCopy}>
                      <strong>{folder.name}</strong>
                      <small>{folder.path}</small>
                    </span>
                    <span>›</span>
                  </button>
                ))}
            </div>

            <div style={styles.folderModalFooter}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setFolderPickerOpen(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                style={styles.primaryButton}
                onClick={selectCurrentDestination}
              >
                Use This Folder
              </button>
            </div>
          </section>
        </div>
      ) : null}

    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 22,
    background: "#eef3f7",
    color: "#10233a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 14,
  },
  headerActions: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
  },
  eyebrow: {
    color: "#1768d2",
    fontSize: 8,
    fontWeight: 950,
    letterSpacing: "0.08em",
  },
  title: {
    margin: "4px 0 0",
    fontSize: 28,
    fontWeight: 950,
  },
  subtitle: {
    margin: "5px 0 0",
    color: "#6b7a89",
    fontSize: 10.5,
  },
  tabs: {
    display: "flex",
    gap: 6,
    marginBottom: 12,
  },
  tab: {
    height: 34,
    padding: "0 13px",
    border: "1px solid #c7d2de",
    background: "#ffffff",
    color: "#405266",
    fontSize: 9,
    fontWeight: 900,
    cursor: "pointer",
  },
  tabActive: {
    height: 34,
    padding: "0 13px",
    border: "1px solid #1768d2",
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 9,
    fontWeight: 900,
    cursor: "pointer",
  },
  panel: {
    border: "1px solid #cbd6e1",
    background: "#ffffff",
  },
  panelHeader: {
    minHeight: 62,
    padding: "11px 13px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    borderBottom: "1px solid #dce4ec",
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: 950,
  },
  helpText: {
    marginTop: 3,
    color: "#7a8795",
    fontSize: 8.5,
  },
  messageList: {
    minHeight: 350,
    maxHeight: 520,
    padding: 16,
    display: "grid",
    alignContent: "start",
    gap: 10,
    overflowY: "auto",
    background: "#f8fafc",
  },
  messageRow: {
    display: "flex",
  },
  messageBubble: {
    maxWidth: "70%",
    padding: "10px 12px",
    borderRadius: 7,
    display: "grid",
    gap: 5,
  },
  practiceBubble: {
    border: "1px solid #a9c8ed",
    background: "#eaf3ff",
  },
  clientBubble: {
    border: "1px solid #d1dae4",
    background: "#ffffff",
  },
  messageMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    color: "#657487",
    fontSize: 8,
  },
  messageBody: {
    whiteSpace: "pre-wrap",
    fontSize: 10.5,
    lineHeight: 1.5,
  },
  composer: {
    padding: 12,
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) auto",
    gap: 10,
    borderTop: "1px solid #dce4ec",
  },
  textarea: {
    minHeight: 78,
    padding: 10,
    border: "1px solid #cbd5e1",
    resize: "vertical",
    fontSize: 10,
  },
  meetingGrid: {
    display: "grid",
    gridTemplateColumns: "290px minmax(0,1fr)",
    gap: 12,
  },
  meetingList: {
    display: "grid",
  },
  meetingListButton: {
    padding: "11px 12px",
    display: "grid",
    gap: 4,
    border: "none",
    borderBottom: "1px solid #e1e7ee",
    background: "#ffffff",
    color: "#10233a",
    textAlign: "left",
    cursor: "pointer",
    fontSize: 9,
  },
  meetingListActive: {
    padding: "11px 12px",
    display: "grid",
    gap: 4,
    border: "none",
    borderLeft: "3px solid #1768d2",
    borderBottom: "1px solid #e1e7ee",
    background: "#eaf3ff",
    color: "#10233a",
    textAlign: "left",
    cursor: "pointer",
    fontSize: 9,
  },
  formGrid: {
    padding: 14,
    display: "grid",
    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
    gap: 10,
  },
  field: {
    display: "grid",
    gap: 5,
    color: "#536579",
    fontSize: 8.5,
    fontWeight: 900,
  },
  input: {
    height: 34,
    padding: "0 9px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 9.5,
  },
  select: {
    height: 34,
    padding: "0 9px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 9,
  },
  minutesTextarea: {
    minHeight: 180,
    padding: 10,
    border: "1px solid #cbd5e1",
    fontSize: 10,
    lineHeight: 1.55,
    resize: "vertical",
  },
  actionBar: {
    padding: "0 14px 14px",
    display: "flex",
    gap: 8,
  },
  actionsArea: {
    borderTop: "1px solid #dce4ec",
    padding: 14,
  },
  actionsHeader: {
    display: "grid",
    gap: 3,
    marginBottom: 10,
    fontSize: 9,
    color: "#667789",
  },
  addActionGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) 120px 160px 130px auto",
    gap: 8,
    alignItems: "end",
  },
  todoList: {
    marginTop: 12,
    border: "1px solid #dce4ec",
  },
  todoRow: {
    minHeight: 40,
    padding: "7px 9px",
    display: "grid",
    gridTemplateColumns: "24px minmax(0,1fr) 90px 110px",
    alignItems: "center",
    gap: 8,
    borderBottom: "1px solid #e5eaf0",
    fontSize: 9,
  },
  todoText: {
    color: "#10233a",
    fontWeight: 800,
  },
  todoOwner: {
    color: "#5d6d7e",
  },
  todoDue: {
    color: "#7d8996",
  },
  requestControls: {
    padding: 14,
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) auto",
    gap: 10,
    alignItems: "end",
  },
  scheduleBox: {
    borderTop: "1px solid #dce4ec",
    padding: 14,
  },
  scheduleGrid: {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "180px 150px 130px auto",
    gap: 10,
    alignItems: "end",
  },
  scheduleList: {
    marginTop: 14,
    border: "1px solid #dce4ec",
  },
  scheduleRow: {
    minHeight: 40,
    padding: "7px 9px",
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) 180px 180px 70px 70px",
    alignItems: "center",
    gap: 8,
    borderBottom: "1px solid #e5eaf0",
    fontSize: 8.5,
  },
  scheduleDeleteButton: {
    height: 28,
    padding: "0 9px",
    border: "1px solid #d7a0a0",
    background: "#ffffff",
    color: "#a43d2f",
    fontSize: 8.5,
    fontWeight: 900,
    cursor: "pointer",
  },
  primaryButton: {
    height: 36,
    padding: "0 13px",
    border: "1px solid #1768d2",
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 9,
    fontWeight: 900,    cursor: "pointer",
  },
  secondaryButton: {
    height: 34,
    padding: "0 12px",
    border: "1px solid #c4d0dc",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 9,
    fontWeight: 900,
    cursor: "pointer",
  },
  error: {
    marginBottom: 10,
    padding: "9px 10px",
    border: "1px solid #e4a0a0",
    background: "#fff1f1",
    color: "#9f1f1f",
    fontSize: 9,
    fontWeight: 800,
  },
  notice: {
    marginBottom: 10,
    padding: "9px 10px",
    border: "1px solid #b7ddc7",
    background: "#edf9f2",
    color: "#226443",
    fontSize: 9,
    fontWeight: 800,
  },
  empty: {
    padding: 18,
    color: "#7b8896",
    fontSize: 9,
    textAlign: "center",
  },

  destinationCard: {
    margin: "0 14px 14px",
    padding: 12,
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) auto",
    gap: 12,
    alignItems: "center",
    border: "1px solid #bdd4ed",
    background: "#f6faff",
  },
  destinationLabel: {
    display: "block",
    color: "#1768d2",
    fontSize: 7.5,
    fontWeight: 950,
    letterSpacing: "0.06em",
  },
  destinationTitle: {
    display: "block",
    marginTop: 4,
    color: "#10233a",
    fontSize: 10,
    fontWeight: 950,
  },
  destinationPath: {
    display: "block",
    marginTop: 3,
    color: "#6b7a89",
    fontSize: 8.5,
  },
  destinationError: {
    gridColumn: "1 / -1",
    color: "#a13434",
    fontSize: 8.5,
    fontWeight: 800,
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "grid",
    placeItems: "center",
    padding: 24,
    background: "rgba(15, 35, 58, 0.42)",
  },
  folderModal: {
    width: "min(760px, 92vw)",
    maxHeight: "82vh",
    display: "grid",
    gridTemplateRows: "auto auto minmax(0,1fr) auto",
    border: "1px solid #cbd6e1",
    background: "#ffffff",
    boxShadow: "0 24px 60px rgba(15,35,58,0.22)",
  },
  folderModalHeader: {
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    borderBottom: "1px solid #dce4ec",
  },
  folderModalTitle: {
    display: "block",
    marginTop: 4,
    fontSize: 14,
    fontWeight: 950,
  },
  folderModalSub: {
    marginTop: 4,
    color: "#6b7a89",
    fontSize: 8.5,
  },
  modalClose: {
    width: 32,
    height: 32,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    fontSize: 18,
    cursor: "pointer",
  },
  folderCurrent: {
    padding: "10px 14px",
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    borderBottom: "1px solid #e5eaf0",
    background: "#f8fafc",
    color: "#667789",
    fontSize: 8.5,
  },
  folderList: {
    overflowY: "auto",
  },
  folderRow: {
    width: "100%",
    minHeight: 48,
    padding: "8px 12px",
    display: "grid",
    gridTemplateColumns: "28px minmax(0,1fr) 22px",
    alignItems: "center",
    gap: 8,
    border: "none",
    borderBottom: "1px solid #edf1f5",
    background: "#ffffff",
    textAlign: "left",
    cursor: "pointer",
  },
  folderRowCopy: {
    display: "grid",
    gap: 2,
    color: "#10233a",
    fontSize: 9,
  },
  folderModalFooter: {
    padding: 12,
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    borderTop: "1px solid #dce4ec",
  },

};
