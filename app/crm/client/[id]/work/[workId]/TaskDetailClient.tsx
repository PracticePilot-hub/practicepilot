"use client";



import { FormEvent, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

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



type ChecklistItem = {

  id: string;

  label: string;

  status: string;

  item_type: string;

  dependency_service_code: string | null;

  dependency_complete: boolean | null;

  dependency_summary: string | null;
  requires_evidence?: boolean | null;
  evidence_label?: string | null;

};



type EvidenceItem = {
  id: string;
  checklist_item_id: string | null;
  document_name: string;
  provider_path: string;
  created_at: string | null;
};

type TimerState = {

  running: boolean;

  openEntryId: string | null;

  openStartedAt: string | null;

  myClosedSeconds: number;

  totalClosedSeconds: number;

};



function formatDuration(totalSeconds: number) {

  const seconds = Math.max(0, Math.floor(totalSeconds || 0));

  const hours = Math.floor(seconds / 3600);

  const minutes = Math.floor((seconds % 3600) / 60);

  const remainingSeconds = seconds % 60;



  return [

    String(hours).padStart(2, "0"),

    String(minutes).padStart(2, "0"),

    String(remainingSeconds).padStart(2, "0"),

  ].join(":");

}



type Props = {

  clientId: string;

  workId: string;

  status: string;

  priority: string;

  assignedUserId: string | null;

  dueDate: string | null;

  description: string | null;

  users: PracticeUser[];

  checklist: ChecklistItem[];
  reviewStatus: string;
  preparerUserId: string | null;
  reviewerUserId: string | null;
  serviceCode: string;

};



export function TaskDetailClient({

  clientId,

  workId,

  status,

  priority,

  assignedUserId,

  dueDate,

  description,

  users,

  checklist,
  reviewStatus,
  preparerUserId,
  reviewerUserId,
  serviceCode,

}: Props) {

  const router = useRouter();



  const [currentStatus, setCurrentStatus] = useState(status);

  const [currentPriority, setCurrentPriority] = useState(priority);

  const [currentAssignee, setCurrentAssignee] = useState(assignedUserId || "");

  const [currentDueDate, setCurrentDueDate] = useState(dueDate || "");

  const [currentDescription, setCurrentDescription] = useState(description || "");

  const [newChecklistItem, setNewChecklistItem] = useState("");

  const [saving, setSaving] = useState(false);

  const [refreshingWork, setRefreshingWork] = useState(false);

  const [completingAll, setCompletingAll] = useState(false);

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [evidenceBusyId, setEvidenceBusyId] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");



  const [timerState, setTimerState] = useState<TimerState>({

    running: false,

    openEntryId: null,

    openStartedAt: null,

    myClosedSeconds: 0,

    totalClosedSeconds: 0,

  });

  const [timerBusy, setTimerBusy] = useState(false);

  const [timerNow, setTimerNow] = useState(Date.now());



  async function authFetch(url: string, init: RequestInit) {

    if (!supabase) throw new Error("Supabase client is not configured.");



    const {

      data: { session },

    } = await supabase.auth.getSession();



    if (!session?.access_token) throw new Error("You are not signed in.");



    const response = await fetch(url, {

      ...init,

      headers: {

        ...(init.headers || {}),

        "Content-Type": "application/json",

        Authorization: `Bearer ${session.access_token}`,

      },

    });



    const json = await response.json();

    if (!response.ok) throw new Error(json.error || "Request failed.");

    return json;

  }



  async function loadEvidence() {
    try {
      const result = await authFetch(`/api/crm/work/${workId}/evidence`, { method: "GET" });
      setEvidence(Array.isArray(result?.evidence) ? result.evidence : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load review evidence.");
    }
  }

  async function uploadEvidence(item: ChecklistItem, file: File) {
    setEvidenceBusyId(item.id);
    setError("");
    setMessage("");
    try {
      const rootResult = await authFetch(`/api/crm/clients/${clientId}/documents/browse`, { method: "GET" });
      const rootPath = String(rootResult?.root_path || "").trim();
      if (!rootPath) throw new Error("This client does not have a linked document-provider root.");
      if (!supabase) throw new Error("Supabase client is not configured.");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("You are not signed in.");
      const formData = new FormData();
      formData.set("folderPath", rootPath);
      formData.set("file", file);
      const uploadResponse = await fetch(`/api/crm/clients/${clientId}/documents/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok || !uploadResult?.success) throw new Error(uploadResult?.error || "Could not upload review evidence.");
      await authFetch(`/api/crm/work/${workId}/evidence`, {
        method: "POST",
        body: JSON.stringify({ checklistItemId: item.id, documentName: uploadResult?.uploaded?.name || file.name, providerPath: uploadResult?.uploaded?.path || "" }),
      });
      await loadEvidence();
      setMessage(`${item.evidence_label || item.label} uploaded for reviewer evidence.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload review evidence.");
    } finally {
      setEvidenceBusyId("");
    }
  }

  async function reviewAction(action: "send" | "approve" | "return") {
    setReviewBusy(true);
    setError("");
    setMessage("");
    try {
      await authFetch(`/api/crm/work/${workId}/review`, { method: "POST", body: JSON.stringify({ action }) });
      if (action === "send") setMessage("Sent to the assigned reviewer.");
      if (action === "return") setMessage("Returned to the preparer.");
      if (action === "approve") {
        setMessage("Review approved and task completed.");
        await refreshClientWork(false);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update review.");
    } finally {
      setReviewBusy(false);
    }
  }

  async function loadTimer() {

    try {

      const result = await authFetch(`/api/crm/work/${workId}/time`, {

        method: "GET",

      });



      setTimerState({

        running: Boolean(result.running),

        openEntryId: result.open_entry_id || null,

        openStartedAt: result.open_started_at || null,

        myClosedSeconds: Number(result.my_closed_seconds || 0),

        totalClosedSeconds: Number(result.total_closed_seconds || 0),

      });

    } catch (err) {

      setError(err instanceof Error ? err.message : "Could not load timer.");

    }

  }



  useEffect(() => {

    void loadTimer();
    void loadEvidence();
    void supabase?.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user?.id || "");
    });

  }, [workId]);



  useEffect(() => {

    if (!timerState.running) return;



    const handle = window.setInterval(() => {

      setTimerNow(Date.now());

    }, 1000);



    return () => window.clearInterval(handle);

  }, [timerState.running]);



  const runningSeconds = useMemo(() => {

    if (!timerState.running || !timerState.openStartedAt) return 0;



    const started = new Date(timerState.openStartedAt).getTime();

    if (Number.isNaN(started)) return 0;



    return Math.max(0, Math.floor((timerNow - started) / 1000));

  }, [timerState.running, timerState.openStartedAt, timerNow]);



  const myDisplayedSeconds = timerState.myClosedSeconds + runningSeconds;

  const taskDisplayedSeconds = timerState.totalClosedSeconds + runningSeconds;



  async function timerAction(action: "start" | "pause" | "resume" | "end") {

    setTimerBusy(true);

    setError("");

    setMessage("");



    try {

      const result = await authFetch(`/api/crm/work/${workId}/time`, {

        method: "POST",

        body: JSON.stringify({ action }),

      });



      setTimerState({

        running: Boolean(result.running),

        openEntryId: result.open_entry_id || null,

        openStartedAt: result.open_started_at || null,

        myClosedSeconds: Number(result.my_closed_seconds || 0),

        totalClosedSeconds: Number(result.total_closed_seconds || 0),

      });



      setTimerNow(Date.now());



      if (action === "start" || action === "resume") {

        setCurrentStatus((current) =>

          current === "not_started" ? "in_progress" : current

        );

      }



      if (action === "pause") setMessage("Timer paused.");

      if (action === "end") setMessage("Time session ended.");



      router.refresh();

    } catch (err) {

      setError(err instanceof Error ? err.message : "Could not update timer.");

    } finally {

      setTimerBusy(false);

    }

  }



  async function refreshClientWork(showMessage = true) {

    setError("");

    if (showMessage) setMessage("");



    try {

      setRefreshingWork(true);

      const result = await authFetch("/api/crm/tasks/generate", {

        method: "POST",

        body: JSON.stringify({ clientId }),

      });



      if (showMessage) {

        const created = Number(result?.created_count || 0);

        setMessage(

          created > 0

            ? `${created} new client work item${created === 1 ? "" : "s"} generated.`

            : "Client work is already up to date for the current planning horizon."

        );

      }



      router.refresh();

      return result;

    } catch (err) {

      const text = err instanceof Error ? err.message : "Could not refresh client work.";

      setError(text);

      throw err;

    } finally {

      setRefreshingWork(false);

    }

  }



  async function saveTask(event: FormEvent) {

    event.preventDefault();

    setError("");



    try {

      setSaving(true);

      await authFetch(`/api/crm/work/${workId}`, {

        method: "PATCH",

        body: JSON.stringify({

          status: currentStatus,

          priority: currentPriority,

          assignedUserId: currentAssignee || null,

          dueDate: currentDueDate || null,

          description: currentDescription,

        }),

      });



      if (currentStatus === "completed") {

        await refreshClientWork(false);

      } else {

        router.refresh();

      }

    } catch (err) {

      setError(err instanceof Error ? err.message : "Could not save task.");

    } finally {

      setSaving(false);

    }

  }



  async function updateChecklist(item: ChecklistItem, nextStatus: string) {

    setError("");



    try {

      await authFetch(`/api/crm/work/${workId}/checklist`, {

        method: "PATCH",

        body: JSON.stringify({

          itemId: item.id,

          status: nextStatus,

        }),

      });



      router.refresh();

    } catch (err) {

      setError(err instanceof Error ? err.message : "Could not update checklist.");

    }

  }



  async function completeAllChecklistItems() {

    setError("");

    setMessage("");



    const itemsToComplete = checklist.filter(

      (item) =>

        item.item_type !== "dependency" &&
        item.item_type !== "review" &&

        item.status !== "completed" &&

        item.status !== "not_applicable"

    );



    if (itemsToComplete.length === 0) {

      setMessage("All manual checklist steps are already complete.");

      return;

    }



    try {

      setCompletingAll(true);



      await Promise.all(

        itemsToComplete.map((item) =>

          authFetch(`/api/crm/work/${workId}/checklist`, {

            method: "PATCH",

            body: JSON.stringify({

              itemId: item.id,

              status: "completed",

            }),

          })

        )

      );



      setMessage(

        `${itemsToComplete.length} checklist step${itemsToComplete.length === 1 ? "" : "s"} completed.`

      );

      router.refresh();

    } catch (err) {

      setError(err instanceof Error ? err.message : "Could not complete checklist.");

    } finally {

      setCompletingAll(false);

    }

  }



  async function addChecklist(event: FormEvent) {

    event.preventDefault();

    if (!newChecklistItem.trim()) return;



    setError("");



    try {

      await authFetch(`/api/crm/work/${workId}/checklist`, {

        method: "POST",

        body: JSON.stringify({

          label: newChecklistItem.trim(),

        }),

      });



      setNewChecklistItem("");

      router.refresh();

    } catch (err) {

      setError(err instanceof Error ? err.message : "Could not add checklist item.");

    }

  }



  const effectiveOutstanding = checklist.filter((item) => {

    if (item.item_type === "dependency") {

      return item.dependency_complete !== true;

    }



    return !["completed", "not_applicable"].includes(item.status);

  }).length;



  return (

    <div style={layout}>

      <div

        style={{

          ...timerBar,

          ...(timerState.running

            ? timerBarRunning

            : myDisplayedSeconds > 0

              ? timerBarPaused

              : {}),

        }}

      >

        <div style={timerBarLeft}>

          <span

            style={{

              ...timerPlayMark,

              ...(timerState.running

                ? timerPlayMarkRunning

                : myDisplayedSeconds > 0

                  ? timerPlayMarkPaused

                  : {}),

            }}

          >

            {timerState.running ? "●" : myDisplayedSeconds > 0 ? "Ⅱ" : "▶"}

          </span>



          <div style={timerCopy}>

            <strong style={timerBarText}>

              {timerState.running

                ? "Working on this task"

                : myDisplayedSeconds > 0

                  ? "Time paused"

                  : "Track your time"}

            </strong>

            <span style={timerBarSub}>

              {timerState.running

                ? "Focus mode is on"

                : myDisplayedSeconds > 0

                  ? "Resume when you continue"

                  : "Start when you begin working"}

            </span>

          </div>

        </div>



        <strong style={timerClock}>

          {formatDuration(myDisplayedSeconds)}

        </strong>



        <div style={timerActions}>

          {timerState.running ? (

            <>

              <button

                type="button"

                disabled={timerBusy}

                onClick={() => void timerAction("pause")}

                style={timerPauseButton}

              >

                Pause

              </button>



              <button

                type="button"

                disabled={timerBusy}

                onClick={() => void timerAction("end")}

                style={timerEndButton}

              >

                Stop

              </button>

            </>

          ) : myDisplayedSeconds > 0 ? (

            <>

              <button

                type="button"

                disabled={timerBusy}

                onClick={() => void timerAction("resume")}

                style={timerStartButton}

              >

                ▶ Resume

              </button>



              <button

                type="button"

                disabled={timerBusy}

                onClick={() => void timerAction("end")}

                style={timerEndButton}

              >

                Stop

              </button>

            </>

          ) : (

            <button

              type="button"

              disabled={timerBusy}

              onClick={() => void timerAction("start")}

              style={timerStartButton}

            >

              ▶ Start timer

            </button>

          )}

        </div>

      </div>



      <section style={panel}>

        <div style={sectionHeader}>

          <div>

            <div style={sectionTitle}>Task control</div>

            <div style={sectionSub}>

              Update assignment, status, priority and due date.

            </div>

          </div>

          <div style={checklistCount}>

            {effectiveOutstanding} checklist item{effectiveOutstanding === 1 ? "" : "s"} open

          </div>

        </div>



        <form onSubmit={saveTask}>

          <div style={formGrid}>

            <label style={field}>

              <span style={label}>Status</span>

              <select

                value={currentStatus}

                onChange={(event) => setCurrentStatus(event.target.value)}

                style={input}

              >

                <option value="not_started">Not started</option>

                <option value="in_progress">In progress</option>

                <option value="waiting">Waiting</option>

                <option value="ready">Ready</option>

                <option value="completed">Completed</option>

              </select>

            </label>



            <label style={field}>

              <span style={label}>Work owner</span>

              <select

                value={currentAssignee}

                onChange={(event) => setCurrentAssignee(event.target.value)}

                style={input}

              >

                <option value="">Unassigned</option>

                {users.map((user) => (

                  <option key={user.user_id} value={user.user_id}>

                    {user.full_name || user.email || "Practice user"}

                  </option>

                ))}

              </select>

            </label>



            <label style={field}>

              <span style={label}>Due date</span>

              <input

                type="date"

                value={currentDueDate}

                onChange={(event) => setCurrentDueDate(event.target.value)}

                style={input}

              />

            </label>



            <label style={field}>

              <span style={label}>Priority</span>

              <select

                value={currentPriority}

                onChange={(event) => setCurrentPriority(event.target.value)}

                style={input}

              >

                <option value="low">Low</option>

                <option value="normal">Normal</option>

                <option value="high">High</option>

                <option value="urgent">Urgent</option>

              </select>

            </label>



            <label style={wideField}>

              <span style={label}>Notes / instructions</span>

              <textarea

                value={currentDescription}

                onChange={(event) => setCurrentDescription(event.target.value)}

                rows={4}

                style={textarea}

              />

            </label>

          </div>



          {error ? <div style={errorBox}>{error}</div> : null}

          {message ? <div style={messageBox}>{message}</div> : null}



          <div style={actions}>

            <button

              type="button"

              disabled={refreshingWork || saving}

              onClick={() => void refreshClientWork(true)}

              style={secondaryButton}

            >

              {refreshingWork ? "Refreshing..." : "Refresh Client Work"}

            </button>

            <button type="submit" disabled={saving || refreshingWork} style={saveButton}>

              {saving ? "Saving..." : "Save Task"}

            </button>

          </div>

        </form>

      </section>



      <section style={reviewPanel}>
        <div style={reviewPanelHeader}>
          <div>
            <div style={reviewPanelTitle}>Review workflow</div>
            <div style={reviewPanelSub}>Preparation evidence must be attached before the work can be sent for review.</div>
          </div>
          <span style={reviewStatusBadge}>{String(reviewStatus || "not_requested").replaceAll("_", " ")}</span>
        </div>
        <div style={reviewPanelBody}>
          {reviewStatus === "awaiting_review" ? (
            currentUserId && currentUserId === reviewerUserId ? (<>
              <span style={reviewPanelText}>This task is with you for review.</span>
              <button type="button" disabled={reviewBusy} onClick={() => void reviewAction("return")} style={reviewReturnButton}>Return to preparer</button>
              <button type="button" disabled={reviewBusy} onClick={() => void reviewAction("approve")} style={reviewApproveButton}>{reviewBusy ? "Updating..." : "Approve review"}</button>
            </>) : (
              <span style={reviewPanelText}>Awaiting review by the assigned reviewer.</span>
            )
          ) : currentUserId && (!preparerUserId || currentUserId === preparerUserId) ? (<>
            <span style={reviewPanelText}>When preparation is complete, send the task to the client reviewer.</span>
            <button type="button" disabled={reviewBusy} onClick={() => void reviewAction("send")} style={reviewSendButton}>{reviewBusy ? "Sending..." : "Send to Reviewer"}</button>
          </>) : (
            <span style={reviewPanelText}>Only the assigned work owner can send this task for review.</span>
          )}
        </div>
      </section>

      <section style={panel}>

        <div style={sectionHeader}>

          <div>

            <div style={sectionTitle}>Checklist</div>

            <div style={sectionSub}>

              Dependency lines are completed automatically from linked PracticePilot work.

            </div>

          </div>



          <button

            type="button"

            disabled={completingAll}

            onClick={() => void completeAllChecklistItems()}

            style={completeAllButton}

          >

            {completingAll ? "Completing..." : "✓ Complete all steps"}

          </button>

        </div>



        <div>

          {checklist.map((item) => {

            const dependency = item.item_type === "dependency";

            const complete = dependency

              ? item.dependency_complete === true

              : item.status === "completed";

            const notApplicable = item.status === "not_applicable";



            return (

              <div key={item.id} style={checkRow}>

                <button

                  type="button"

                  disabled={dependency || item.item_type === "review"}

                  onClick={() =>

                    updateChecklist(

                      item,

                      complete ? "outstanding" : "completed"

                    )

                  }

                  style={{

                    ...checkButton,

                    ...(complete ? checkButtonComplete : {}),

                    ...(dependency || item.item_type === "review" ? checkButtonDependency : {}),

                  }}

                  title={

                    dependency

                      ? "This item follows linked PracticePilot work automatically."
                      : item.item_type === "review"
                        ? "This step is completed only by the assigned reviewer workflow."
                        : complete

                        ? "Mark outstanding"

                        : "Mark complete"

                  }

                >

                  {complete ? "✓" : ""}

                </button>



                <div style={checkContent}>

                  <div

                    style={{

                      ...checkLabel,

                      ...(complete || notApplicable ? checkLabelDone : {}),

                    }}

                  >

                    {item.label}

                  </div>



                  {dependency ? (

                    <div style={dependencyText}>

                      {item.dependency_summary ||

                        `${item.dependency_service_code || "Linked work"} not complete`}

                    </div>

                  ) : (

                    <div style={checkMeta}>

                      {item.item_type === "review"
                        ? "Reviewer controlled"
                        : notApplicable
                          ? "Not applicable"
                          : item.status.replaceAll("_", " ")}

                    </div>

                  )}

                  {item.requires_evidence ? (
                    <div style={evidenceWrap}>
                      <div style={evidenceRequirement}>Required evidence: {item.evidence_label || item.label}</div>
                      <div style={evidenceFiles}>
                        {evidence.filter((row) => row.checklist_item_id === item.id).map((row) => (
                          <a key={row.id} href={`/crm/client/${clientId}?tab=documents&documentPath=${encodeURIComponent(row.provider_path)}`} style={evidenceLink}>{row.document_name}</a>
                        ))}
                      </div>
                      <label style={evidenceUploadLabel}>
                        {evidenceBusyId === item.id ? "Uploading..." : "Upload evidence"}
                        <input type="file" disabled={evidenceBusyId === item.id} style={{ display: "none" }} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadEvidence(item, file); event.currentTarget.value = ""; }} />
                      </label>
                    </div>
                  ) : null}

                </div>



                {!dependency && item.item_type !== "review" ? (

                  <button

                    type="button"

                    onClick={() =>

                      updateChecklist(

                        item,

                        notApplicable ? "outstanding" : "not_applicable"

                      )

                    }

                    style={naButton}

                  >

                    {notApplicable ? "Undo N/A" : "N/A"}

                  </button>

                ) : item.item_type === "review" ? (
                  <span style={reviewControlledBadge}>Reviewer</span>
                ) : (

                  <span style={linkedBadge}>Linked</span>

                )}

              </div>

            );

          })}

        </div>



        <form onSubmit={addChecklist} style={addChecklistRow}>

          <input

            value={newChecklistItem}

            onChange={(event) => setNewChecklistItem(event.target.value)}

            placeholder="Add another checklist item..."

            style={input}

          />

          <button type="submit" style={secondaryButton}>

            Add

          </button>

        </form>

      </section>

    </div>

  );

}



const layout: React.CSSProperties = {

  display: "grid",

  gap: "12px",

};



const timerBar: React.CSSProperties = {

  minHeight: "46px",

  padding: "6px 8px 6px 10px",

  display: "grid",

  gridTemplateColumns: "minmax(190px, 1fr) auto auto",

  gap: "12px",

  alignItems: "center",

  background: "#10233a",

  border: "1px solid #10233a",

};



const timerBarRunning: React.CSSProperties = {

  background: "#102f28",

  borderColor: "#245b4b",

};



const timerBarPaused: React.CSSProperties = {

  background: "#26303c",

  borderColor: "#3b4754",

};



const timerBarLeft: React.CSSProperties = {

  minWidth: 0,

  display: "flex",

  alignItems: "center",

  gap: "8px",

};



const timerPlayMark: React.CSSProperties = {

  width: "25px",

  height: "25px",

  flex: "0 0 25px",

  display: "inline-flex",

  alignItems: "center",

  justifyContent: "center",

  border: "1px solid rgba(255,255,255,.22)",

  color: "#ffffff",

  fontSize: "9px",

  fontWeight: 900,

};



const timerPlayMarkRunning: React.CSSProperties = {

  background: "#2f855a",

  borderColor: "#58a779",

};



const timerPlayMarkPaused: React.CSSProperties = {

  background: "#6b7280",

};



const timerCopy: React.CSSProperties = {

  minWidth: 0,

  display: "grid",

  gap: "1px",

};



const timerBarText: React.CSSProperties = {

  color: "#ffffff",

  fontSize: "9px",

  fontWeight: 900,

};



const timerBarSub: React.CSSProperties = {

  color: "#aebdca",

  fontSize: "7.5px",

};



const timerClock: React.CSSProperties = {

  minWidth: "92px",

  color: "#ffffff",

  fontSize: "18px",

  lineHeight: 1,

  fontWeight: 900,

  fontVariantNumeric: "tabular-nums",

  textAlign: "right",

};



const timerActions: React.CSSProperties = {

  flex: "0 0 auto",

  display: "flex",

  alignItems: "center",

  gap: "5px",

};



const timerStartButton: React.CSSProperties = {

  minWidth: "94px",

  height: "28px",

  padding: "0 10px",

  border: "1px solid #4da06a",

  background: "#3b8d59",

  color: "#ffffff",

  fontSize: "8.5px",

  fontWeight: 900,

  cursor: "pointer",

};



const timerPauseButton: React.CSSProperties = {

  minWidth: "58px",

  height: "28px",

  padding: "0 8px",

  border: "1px solid #8fa1b1",

  background: "#ffffff",

  color: "#263746",

  fontSize: "8.5px",

  fontWeight: 900,

  cursor: "pointer",

};



const timerEndButton: React.CSSProperties = {

  minWidth: "52px",

  height: "28px",

  padding: "0 8px",

  border: "1px solid #d3a29d",

  background: "#ffffff",

  color: "#9c4037",

  fontSize: "8.5px",

  fontWeight: 900,

  cursor: "pointer",

};



const panel: React.CSSProperties = {

  background: "#ffffff",

  border: "1px solid #d7e0e8",

};



const sectionHeader: React.CSSProperties = {

  minHeight: "44px",

  padding: "7px 10px",

  display: "flex",

  justifyContent: "space-between",

  alignItems: "center",

  gap: "12px",

  borderBottom: "1px solid #dfe6ec",

};



const sectionTitle: React.CSSProperties = {

  color: "#10233a",

  fontSize: "12px",

  fontWeight: 900,

};



const sectionSub: React.CSSProperties = {

  marginTop: "2px",

  color: "#71808c",

  fontSize: "9.5px",

};



const checklistCount: React.CSSProperties = {

  padding: "4px 7px",

  border: "1px solid #cfdbe4",

  background: "#f7fafc",

  color: "#53697a",

  fontSize: "9px",

  fontWeight: 800,

};



const formGrid: React.CSSProperties = {

  padding: "8px 10px",

  display: "grid",

  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",

  gap: "7px",

};



const field: React.CSSProperties = {

  display: "grid",

  gap: "4px",

};



const wideField: React.CSSProperties = {

  ...field,

  gridColumn: "1 / -1",

};



const label: React.CSSProperties = {

  color: "#53697a",

  fontSize: "9px",

  fontWeight: 800,

};



const input: React.CSSProperties = {

  width: "100%",

  minHeight: "30px",

  padding: "4px 7px",

  boxSizing: "border-box",

  border: "1px solid #cfd9e2",

  background: "#ffffff",

  color: "#10233a",

  fontSize: "10px",

};



const textarea: React.CSSProperties = {

  ...input,

  minHeight: "62px",

  resize: "vertical",

  fontFamily: "inherit",

};



const actions: React.CSSProperties = {

  padding: "7px 10px",

  display: "flex",

  justifyContent: "flex-end",

  borderTop: "1px solid #e2e8ee",

};



const saveButton: React.CSSProperties = {

  minHeight: "30px",

  padding: "0 11px",

  border: "1px solid #1769e0",

  background: "#1769e0",

  color: "#ffffff",

  fontSize: "10px",

  fontWeight: 850,

  cursor: "pointer",

};



const errorBox: React.CSSProperties = {

  margin: "0 12px 10px",

  padding: "8px 10px",

  border: "1px solid #efb2aa",

  background: "#fff2ef",

  color: "#9c3d33",

  fontSize: "9.5px",

  fontWeight: 700,

};



const messageBox: React.CSSProperties = {

  margin: "10px 12px 0",

  padding: "8px 10px",

  border: "1px solid #b7d8c3",

  background: "#f2fbf5",

  color: "#285c3a",

  fontSize: "10px",

  fontWeight: 700,

};



const checkRow: React.CSSProperties = {

  minHeight: "50px",

  padding: "7px 10px",

  display: "grid",

  gridTemplateColumns: "28px minmax(0, 1fr) auto",

  gap: "8px",

  alignItems: "center",

  borderBottom: "1px solid #e5ebf0",

};



const checkButton: React.CSSProperties = {

  width: "24px",

  height: "24px",

  border: "1px solid #bfcdd8",

  background: "#ffffff",

  color: "#ffffff",

  cursor: "pointer",

  fontSize: "12px",

  fontWeight: 900,

};



const checkButtonComplete: React.CSSProperties = {

  borderColor: "#62a978",

  background: "#62a978",

};



const checkButtonDependency: React.CSSProperties = {

  cursor: "default",

};



const checkContent: React.CSSProperties = {

  minWidth: 0,

};



const checkLabel: React.CSSProperties = {

  color: "#10233a",

  fontSize: "10px",

  fontWeight: 800,

};



const checkLabelDone: React.CSSProperties = {

  color: "#74827b",

  textDecoration: "line-through",

};



const checkMeta: React.CSSProperties = {

  marginTop: "2px",

  color: "#87949e",

  fontSize: "8.5px",

};



const dependencyText: React.CSSProperties = {

  marginTop: "2px",

  color: "#5d7384",

  fontSize: "8.5px",

};



const linkedBadge: React.CSSProperties = {

  padding: "3px 6px",

  border: "1px solid #c4d7e8",

  background: "#eef6fc",

  color: "#35658e",

  fontSize: "8px",

  fontWeight: 800,

};



const naButton: React.CSSProperties = {

  minHeight: "26px",

  padding: "0 7px",

  border: "1px solid #d3dde5",

  background: "#ffffff",

  color: "#607385",

  fontSize: "8px",

  fontWeight: 800,

  cursor: "pointer",

};



const addChecklistRow: React.CSSProperties = {

  padding: "10px",

  display: "grid",

  gridTemplateColumns: "minmax(0, 1fr) auto",

  gap: "7px",

};



const secondaryButton: React.CSSProperties = {

  minHeight: "30px",

  padding: "0 9px",

  border: "1px solid #c8d4de",

  background: "#ffffff",

  color: "#10233a",

  fontSize: "9px",

  fontWeight: 800,

  cursor: "pointer",

};





const completeAllButton: React.CSSProperties = {

  minHeight: "32px",

  padding: "0 11px",

  border: "1px solid #62a978",

  background: "#f2fbf5",

  color: "#285c3a",

  fontSize: "9px",

  fontWeight: 850,

  cursor: "pointer",

};


const reviewPanel: React.CSSProperties = { background: "#ffffff", border: "1px solid #b8c7d3" };
const reviewPanelHeader: React.CSSProperties = { minHeight: "44px", padding: "7px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", borderBottom: "1px solid #dde5eb", background: "#f6f9fb" };
const reviewPanelTitle: React.CSSProperties = { color: "#10233a", fontSize: "12px", fontWeight: 900 };
const reviewPanelSub: React.CSSProperties = { marginTop: "2px", color: "#71808c", fontSize: "9px" };
const reviewStatusBadge: React.CSSProperties = { padding: "4px 7px", border: "1px solid #c7d5df", background: "#ffffff", color: "#4d6475", fontSize: "8px", fontWeight: 850, textTransform: "capitalize" };
const reviewPanelBody: React.CSSProperties = { minHeight: "44px", padding: "7px 10px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" };
const reviewPanelText: React.CSSProperties = { marginRight: "auto", color: "#526779", fontSize: "9.5px" };
const reviewSendButton: React.CSSProperties = { minHeight: "30px", padding: "0 10px", border: "1px solid #1769e0", background: "#1769e0", color: "#ffffff", fontSize: "9px", fontWeight: 850, cursor: "pointer" };
const reviewApproveButton: React.CSSProperties = { ...reviewSendButton, borderColor: "#3d8054", background: "#3d8054" };
const reviewReturnButton: React.CSSProperties = { ...reviewSendButton, borderColor: "#b08a34", background: "#fff8e8", color: "#7b5711" };
const evidenceWrap: React.CSSProperties = { marginTop: "6px", padding: "6px 7px", display: "grid", gap: "5px", borderLeft: "3px solid #2f6fa9", background: "#f4f8fc" };
const evidenceRequirement: React.CSSProperties = { color: "#31536d", fontSize: "8.5px", fontWeight: 850 };
const evidenceFiles: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: "4px" };
const evidenceLink: React.CSSProperties = { padding: "3px 5px", border: "1px solid #bfd0df", background: "#ffffff", color: "#245f91", textDecoration: "none", fontSize: "8px", fontWeight: 750 };
const evidenceUploadLabel: React.CSSProperties = { width: "fit-content", minHeight: "24px", padding: "0 7px", display: "inline-flex", alignItems: "center", border: "1px solid #bfcdd8", background: "#ffffff", color: "#425a6e", fontSize: "8px", fontWeight: 850, cursor: "pointer" };
const reviewControlledBadge: React.CSSProperties = { padding: "3px 6px", border: "1px solid #c8b9e2", background: "#f5f0fb", color: "#65468f", fontSize: "8px", fontWeight: 800 };
