"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
};

type TaskDetail = {
  id: string;
  client_id: string | null;
  client_service_id: string | null;
  task_title: string;
  service_name: string | null;
  task_status: string | null;
  due_date: string | null;
  period_start: string | null;
  period_end: string | null;
  review_notes: string | null;
  client_name: string;
};

type TaskDocument = {
  id: string;
  task_id: string;
  document_name: string;
  document_type: string | null;
  file_url: string | null;
  notes: string | null;
  created_at: string;
  storage_provider: string | null;
  external_file_id: string | null;
  external_file_path: string | null;
  external_file_url: string | null;
  review_status: string | null;
  reviewed_copy_path: string | null;
  reviewed_final_path: string | null;
};

type TimeEntry = {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  stopped_at: string | null;
  duration_seconds: number | null;
  note: string | null;
  work_stage: string | null;
};

type ReviewComment = {
  id: string;
  task_id: string;
  document_id: string | null;
  reference_label: string | null;
  review_note: string;
  comment_status: string;
  created_at: string;
};

type WorkStage = "doing" | "review" | "correction" | "submission";

function formatDate(value: string | null) {
  if (!value) return "-";
  return value;
}

function formatSeconds(seconds: number | null) {
  if (!seconds) return "00:00:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(secs).padStart(2, "0"),
  ].join(":");
}

function getStageLabel(stage: WorkStage | string | null) {
  if (stage === "review") return "Review";
  if (stage === "correction") return "Correction";
  if (stage === "submission") return "Submission";
  return "Doing";
}

function getStatusMode(status: string | null) {
  const raw = (status || "Open").toLowerCase();

  if (raw.includes("review")) return "review";
  if (raw.includes("correction")) return "correction";
  if (raw.includes("approved")) return "submission";
  if (raw.includes("submitted") || raw.includes("complete")) return "done";

  return "open";
}

function getProviderLabel(provider: string | null) {
  if (provider === "egnyte") return "Egnyte";
  if (provider === "google_drive") return "Google Drive";
  if (provider === "dropbox") return "Dropbox";
  if (provider === "onedrive") return "OneDrive";
  if (provider === "local_server") return "Local / Server Path";
  return "Manual Link";
}

function isWebLink(value: string | null) {
  if (!value) return false;
  return value.startsWith("http://") || value.startsWith("https://");
}

export default function CRMTaskDetailPage({ params }: PageProps) {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [documents, setDocuments] = useState<TaskDocument[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [documentProvider, setDocumentProvider] = useState("egnyte");
  const [documentType, setDocumentType] = useState("VAT Report");
  const [documentName, setDocumentName] = useState("");
  const [documentReference, setDocumentReference] = useState("");

  const [referenceLabel, setReferenceLabel] = useState("");
  const [reviewNote, setReviewNote] = useState("");

  useEffect(() => {
    async function loadParams() {
      const resolvedParams = await Promise.resolve(params);
      setTaskId(resolvedParams.id);
    }

    loadParams();
  }, [params]);

  useEffect(() => {
    if (!taskId) return;
    loadEverything(taskId);
  }, [taskId]);

  useEffect(() => {
    if (!activeEntry) return;

    const timer = window.setInterval(() => {
      const started = new Date(activeEntry.started_at).getTime();
      const now = new Date().getTime();
      setElapsedSeconds(Math.floor((now - started) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeEntry]);

  const statusMode = useMemo(() => getStatusMode(task?.task_status || null), [task]);

  async function loadEverything(id: string) {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/login";
      return;
    }

    setCurrentUserId(user.id);

    await Promise.all([
      loadTask(id),
      loadDocuments(id),
      loadTimeEntries(id, user.id),
      loadReviewComments(id),
    ]);

    setLoading(false);
  }

  async function loadTask(id: string) {
    const { data: taskData, error: taskError } = await supabase
      .from("crm_tasks")
      .select(
        "id, client_id, client_service_id, task_title, service_name, task_status, due_date, period_start, period_end, review_notes"
      )
      .eq("id", id)
      .single();

    if (taskError || !taskData) {
      console.error(taskError);
      alert("Could not load task.");
      return;
    }

    let clientName = "No client linked";

    if (taskData.client_id) {
      const { data: clientData } = await supabase
        .from("crm_clients")
        .select("client_name")
        .eq("id", taskData.client_id)
        .maybeSingle();

      clientName = clientData?.client_name || clientName;
    }

    setTask({
      ...(taskData as Omit<TaskDetail, "client_name">),
      client_name: clientName,
    });
  }

  async function loadDocuments(id: string) {
    const { data, error } = await supabase
      .from("crm_task_documents")
      .select("*")
      .eq("task_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setDocuments([]);
      return;
    }

    setDocuments((data || []) as TaskDocument[]);
  }

  async function loadTimeEntries(id: string, userId: string) {
    const { data, error } = await supabase
      .from("crm_task_time_entries")
      .select("*")
      .eq("task_id", id)
      .order("started_at", { ascending: false });

    if (error) {
      console.error(error);
      setTimeEntries([]);
      return;
    }

    const entries = (data || []) as TimeEntry[];
    setTimeEntries(entries);

    const running = entries.find(
      (entry) => entry.user_id === userId && entry.stopped_at === null
    );

    if (running) {
      setActiveEntry(running);
      const started = new Date(running.started_at).getTime();
      const now = new Date().getTime();
      setElapsedSeconds(Math.floor((now - started) / 1000));
    } else {
      setActiveEntry(null);
      setElapsedSeconds(0);
    }
  }

  async function loadReviewComments(id: string) {
    const { data, error } = await supabase
      .from("crm_task_review_comments")
      .select("*")
      .eq("task_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setReviewComments([]);
      return;
    }

    setReviewComments((data || []) as ReviewComment[]);
  }

  async function startTimer(stage: WorkStage) {
    if (!task || !currentUserId || activeEntry) return;

    setSaving(true);

    const { data, error } = await supabase
      .from("crm_task_time_entries")
      .insert({
        task_id: task.id,
        user_id: currentUserId,
        work_stage: stage,
        note: `Started ${getStageLabel(stage)} time for ${task.service_name || "Task"} - ${task.client_name}`,
      })
      .select("*")
      .single();

    if (error) {
      console.error(error);
      alert("Could not start timer.");
      setSaving(false);
      return;
    }

    setActiveEntry(data as TimeEntry);
    setElapsedSeconds(0);
    await loadTimeEntries(task.id, currentUserId);
    setSaving(false);
  }

  async function stopTimer(note: string) {
    if (!task || !currentUserId || !activeEntry) return;

    setSaving(true);

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
      setSaving(false);
      return;
    }

    setActiveEntry(null);
    setElapsedSeconds(0);
    await loadTimeEntries(task.id, currentUserId);
    setSaving(false);
  }

  async function updateTaskStatus(nextStatus: string) {
    if (!task) return;

    setSaving(true);

    const updateData: Record<string, string> = {
      task_status: nextStatus,
    };

    if (nextStatus === "Ready for review") {
      updateData.ready_for_review_at = new Date().toISOString();
    }

    if (nextStatus === "Approved for submission") {
      updateData.reviewed_at = new Date().toISOString();
    }

    if (nextStatus === "Submitted / Complete") {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("crm_tasks")
      .update(updateData)
      .eq("id", task.id);

    if (error) {
      console.error(error);
      alert("Could not update task status.");
      setSaving(false);
      return;
    }

    await loadTask(task.id);
    setSaving(false);
  }

  async function linkDocument() {
    if (!task || !currentUserId) return;

    const cleanName = documentName.trim();
    const cleanReference = documentReference.trim();

    if (!cleanName) {
      alert("Please enter the document name.");
      return;
    }

    if (!cleanReference) {
      alert("Please enter the document link or path.");
      return;
    }

    setSaving(true);

    const referenceIsUrl = isWebLink(cleanReference);

    const { error } = await supabase.from("crm_task_documents").insert({
      task_id: task.id,
      uploaded_by: currentUserId,
      document_name: cleanName,
      document_type: documentType,
      storage_provider: documentProvider,
      external_file_url: referenceIsUrl ? cleanReference : null,
      external_file_path: referenceIsUrl ? null : cleanReference,
      file_url: null,
      notes: null,
      review_status: "Linked",
    });

    if (error) {
      console.error(error);
      alert("Could not link document.");
      setSaving(false);
      return;
    }

    setDocumentName("");
    setDocumentReference("");

    await loadDocuments(task.id);
    setSaving(false);
  }

  async function addReviewComment() {
    if (!task || !currentUserId) return;

    const cleanNote = reviewNote.trim();

    if (!cleanNote) {
      alert("Please type a review note first.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("crm_task_review_comments").insert({
      task_id: task.id,
      created_by: currentUserId,
      reference_label: referenceLabel.trim() || null,
      review_note: cleanNote,
      comment_status: "Open",
    });

    if (error) {
      console.error(error);
      alert("Could not save review note.");
      setSaving(false);
      return;
    }

    setReferenceLabel("");
    setReviewNote("");

    await loadReviewComments(task.id);
    await updateTaskStatus("Correction required");

    setSaving(false);
  }

  async function markCommentResolved(commentId: string) {
    if (!task) return;

    setSaving(true);

    const { error } = await supabase
      .from("crm_task_review_comments")
      .update({
        comment_status: "Resolved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", commentId);

    if (error) {
      console.error(error);
      alert("Could not resolve comment.");
      setSaving(false);
      return;
    }

    await loadReviewComments(task.id);
    setSaving(false);
  }

  if (loading || !task) {
    return (
      <main style={styles.page}>
        <div style={styles.emptyState}>Loading task...</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Task Detail</p>
          <h1 style={styles.title}>
            {task.service_name || "Task"} - {task.client_name}
          </h1>
          <p style={styles.subtitle}>{task.task_title}</p>
        </div>

        <Link href="/crm/tasks" style={styles.secondaryButton}>
          Back to CRM Tasks
        </Link>
      </section>

      {activeEntry && (
        <section style={styles.runningTimer}>
          <strong>Timer running:</strong> {getStageLabel(activeEntry.work_stage)} |{" "}
          {formatSeconds(elapsedSeconds)}
          <button
            style={styles.timerStopButton}
            onClick={() =>
              stopTimer(`Paused ${getStageLabel(activeEntry.work_stage)} time`)
            }
            disabled={saving}
          >
            Stop timer
          </button>
        </section>
      )}

      <section style={styles.gridTwo}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Task Summary</h2>

          <div style={styles.row}>
            <strong>Status</strong>
            <span style={styles.statusPill}>{task.task_status || "Open"}</span>
          </div>

          <div style={styles.row}>
            <strong>Due date</strong>
            <span>{formatDate(task.due_date)}</span>
          </div>

          <div style={styles.row}>
            <strong>Period</strong>
            <span>
              {formatDate(task.period_start)} to {formatDate(task.period_end)}
            </span>
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Workflow Actions</h2>

          {statusMode === "open" && (
            <div style={styles.actionsGrid}>
              <button
                style={styles.primaryButton}
                onClick={() => startTimer("doing")}
                disabled={saving || !!activeEntry}
              >
                🚀 Start Doing
              </button>

              <button
                style={styles.primaryButton}
                onClick={async () => {
                  if (activeEntry) {
                    await stopTimer("Ready for review");
                  }
                  await updateTaskStatus("Ready for review");
                }}
                disabled={saving}
              >
                🏁 Mark Ready for Review
              </button>
            </div>
          )}

          {statusMode === "review" && (
            <div style={styles.actionsGrid}>
              <button
                style={styles.primaryButton}
                onClick={() => startTimer("review")}
                disabled={saving || !!activeEntry}
              >
                🔎 Start Review
              </button>

              <button
                style={styles.primaryButton}
                onClick={async () => {
                  if (activeEntry) {
                    await stopTimer("Approved for submission");
                  }
                  await updateTaskStatus("Approved for submission");
                }}
                disabled={saving}
              >
                ✅ Approve for Submission
              </button>
            </div>
          )}

          {statusMode === "correction" && (
            <div style={styles.actionsGrid}>
              <button
                style={styles.primaryButton}
                onClick={() => startTimer("correction")}
                disabled={saving || !!activeEntry}
              >
                🛠 Start Correction
              </button>

              <button
                style={styles.primaryButton}
                onClick={async () => {
                  if (activeEntry) {
                    await stopTimer("Corrections completed");
                  }
                  await updateTaskStatus("Ready for review");
                }}
                disabled={saving}
              >
                🔁 Back to Review
              </button>
            </div>
          )}

          {statusMode === "submission" && (
            <div style={styles.actionsGrid}>
              <button
                style={styles.primaryButton}
                onClick={() => startTimer("submission")}
                disabled={saving || !!activeEntry}
              >
                📤 Start Submission
              </button>

              <button
                style={styles.primaryButton}
                onClick={async () => {
                  if (activeEntry) {
                    await stopTimer("Submitted / Complete");
                  }
                  await updateTaskStatus("Submitted / Complete");
                }}
                disabled={saving}
              >
                ✅ Mark Submitted
              </button>
            </div>
          )}

          {statusMode === "done" && (
            <div style={styles.doneBox}>✅ This task is complete.</div>
          )}
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.cardTitle}>Working Papers</h2>
            <p style={styles.cardText}>
              Link the source document from Egnyte, Google Drive, Dropbox, OneDrive,
              a manual URL or a server path. PracticePilot tracks the workflow;
              your document vault remains the source of truth.
            </p>
          </div>
        </div>

        <div style={styles.documentForm}>
          <select
            style={styles.select}
            value={documentProvider}
            onChange={(event) => setDocumentProvider(event.target.value)}
          >
            <option value="egnyte">Egnyte</option>
            <option value="google_drive">Google Drive</option>
            <option value="dropbox">Dropbox</option>
            <option value="onedrive">OneDrive</option>
            <option value="manual_link">Manual Link</option>
            <option value="local_server">Local / Server Path</option>
          </select>

          <select
            style={styles.select}
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
          >
            <option>VAT Report</option>
            <option>Payroll Report</option>
            <option>AFS Draft</option>
            <option>SARS Letter</option>
            <option>Bank Statements</option>
            <option>Other</option>
          </select>

          <input
            style={styles.input}
            value={documentName}
            onChange={(event) => setDocumentName(event.target.value)}
            placeholder="Document name e.g. VAT Report May-Jun 2026"
          />

          <input
            style={styles.input}
            value={documentReference}
            onChange={(event) => setDocumentReference(event.target.value)}
            placeholder="Egnyte link/path, Google link, Dropbox link, or server path"
          />

          <button style={styles.primaryButton} onClick={linkDocument} disabled={saving}>
            Search / Link Document
          </button>
        </div>

        {documents.length === 0 && (
          <div style={styles.emptySmall}>No working papers linked yet.</div>
        )}

        {documents.map((document) => {
          const reference =
            document.external_file_url ||
            document.external_file_path ||
            document.file_url ||
            "";

          return (
            <div key={document.id} style={styles.listRow}>
              <div>
                <strong>{document.document_name}</strong>
                <div style={styles.smallText}>
                  {document.document_type || "Document"} •{" "}
                  {getProviderLabel(document.storage_provider)}
                </div>
                {reference && <div style={styles.pathText}>{reference}</div>}
              </div>

              <div style={styles.documentActions}>
                <span style={styles.statusPill}>
                  {document.review_status || "Linked"}
                </span>

                <button
  style={styles.openLink}
  onClick={() => navigator.clipboard.writeText(reference)}
  disabled={!reference}
>
  Copy Path
</button>

{isWebLink(reference) && (
  <a
    href={reference}
    target="_blank"
    rel="noreferrer"
    style={styles.openLink}
  >
    Open
  </a>
)}
              </div>
            </div>
          );
        })}
      </section>

      <section style={styles.gridTwo}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Review Comments</h2>

          <div style={styles.noteForm}>
            <input
              style={styles.input}
              value={referenceLabel}
              onChange={(event) => setReferenceLabel(event.target.value)}
              placeholder="Reference e.g. Page 2 / Output VAT line / Transaction 345"
            />

            <textarea
              style={styles.textarea}
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder="Type review note..."
            />

            <button
              style={styles.primaryButton}
              onClick={addReviewComment}
              disabled={saving}
            >
              📝 Add Review Note
            </button>
          </div>

          {reviewComments.length === 0 && (
            <div style={styles.emptySmall}>No review comments yet.</div>
          )}

          {reviewComments.map((comment) => (
            <div key={comment.id} style={styles.commentBox}>
              <div style={styles.commentHeader}>
                <strong>{comment.reference_label || "General note"}</strong>
                <span style={styles.statusPill}>{comment.comment_status}</span>
              </div>

              <p style={styles.commentText}>{comment.review_note}</p>

              {comment.comment_status !== "Resolved" && (
                <button
                  style={styles.smallButton}
                  onClick={() => markCommentResolved(comment.id)}
                  disabled={saving}
                >
                  Mark resolved
                </button>
              )}
            </div>
          ))}
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Time Entries</h2>

          {timeEntries.length === 0 && (
            <div style={styles.emptySmall}>No time entries yet.</div>
          )}

          {timeEntries.map((entry) => (
            <div key={entry.id} style={styles.listRow}>
              <div>
                <strong>{getStageLabel(entry.work_stage)}</strong>
                <div style={styles.smallText}>{entry.note || "No note"}</div>
              </div>
              <span style={styles.statusPill}>
                {entry.stopped_at ? formatSeconds(entry.duration_seconds) : "Running"}
              </span>
            </div>
          ))}
        </div>
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
    gap: "20px",
    alignItems: "flex-start",
    marginBottom: "24px",
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
    fontSize: "30px",
    letterSpacing: "-0.03em",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#526173",
    fontSize: "14px",
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
  gridTwo: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "18px",
    marginBottom: "18px",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #dbe5ee",
    borderRadius: "18px",
    padding: "20px",
    boxShadow: "0 16px 40px rgba(11,47,79,0.08)",
    marginBottom: "18px",
  },
  cardTitle: {
    margin: "0 0 12px",
    fontSize: "20px",
  },
  cardText: {
    margin: 0,
    color: "#526173",
    fontSize: "13px",
    maxWidth: "760px",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px 0",
    borderTop: "1px solid #eef3f7",
    fontSize: "14px",
  },
  statusPill: {
    background: "#eaf8fa",
    color: "#007986",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },
  primaryButton: {
    background: "#0b5cab",
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
  },
  smallButton: {
    background: "#0b5cab",
    color: "#ffffff",
    border: "none",
    borderRadius: "10px",
    padding: "9px 12px",
    fontSize: "12px",
    fontWeight: 900,
    cursor: "pointer",
  },
  doneBox: {
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#166534",
    borderRadius: "14px",
    padding: "14px",
    fontWeight: 900,
  },
  runningTimer: {
    position: "sticky",
    top: "12px",
    zIndex: 20,
    background: "#c1121f",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "14px 18px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginBottom: "18px",
    boxShadow: "0 18px 44px rgba(193,18,31,0.25)",
  },
  timerStopButton: {
    marginLeft: "auto",
    background: "#ffffff",
    color: "#c1121f",
    border: "none",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 900,
    cursor: "pointer",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    marginBottom: "14px",
  },
  documentForm: {
    display: "grid",
    gridTemplateColumns: "160px 160px 1fr 1.4fr auto",
    gap: "10px",
    marginBottom: "14px",
  },
  select: {
    height: "42px",
    border: "1px solid #d5dde6",
    borderRadius: "10px",
    padding: "0 10px",
    background: "#ffffff",
    color: "#0b2f4f",
    fontSize: "13px",
  },
  input: {
    height: "42px",
    border: "1px solid #d5dde6",
    borderRadius: "10px",
    padding: "0 12px",
    fontSize: "13px",
    outline: "none",
  },
  listRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    padding: "12px 0",
    borderTop: "1px solid #eef3f7",
  },
  smallText: {
    marginTop: "4px",
    color: "#6b7788",
    fontSize: "12px",
  },
  pathText: {
    marginTop: "5px",
    color: "#334155",
    fontSize: "12px",
    wordBreak: "break-all",
  },
  documentActions: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
  },
  openLink: {
    background: "#0b5cab",
    color: "#ffffff",
    textDecoration: "none",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 900,
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
    padding: "12px 0",
  },
  noteForm: {
    display: "grid",
    gap: "10px",
    marginBottom: "14px",
  },
  textarea: {
    minHeight: "90px",
    border: "1px solid #d5dde6",
    borderRadius: "10px",
    padding: "12px",
    fontSize: "13px",
    outline: "none",
    resize: "vertical",
  },
  commentBox: {
    borderTop: "1px solid #eef3f7",
    padding: "12px 0",
  },
  commentHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
  },
  commentText: {
    color: "#334155",
    fontSize: "13px",
    lineHeight: 1.45,
  },
};