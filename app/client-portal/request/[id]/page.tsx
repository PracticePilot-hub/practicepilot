"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type PortalRequest = {
  id: string;
  request_type: "document_request" | "approval" | "confirmation" | "question";
  title: string;
  description: string | null;
  due_date: string | null;
  status: "new" | "in_progress" | "submitted" | "completed" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  requires_upload: boolean;
  requires_response: boolean;
  requires_approval: boolean;
  response_text: string | null;
  upload_folder_name?: string | null;
};

type PortalMeResponse = {
  success?: boolean;
  client?: {
    id: string;
    client_name: string;
  };
  portal_user?: {
    full_name: string | null;
    email: string;
  };
  requests?: PortalRequest[];
  error?: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "No due date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function requestTypeLabel(value: string) {
  const labels: Record<string, string> = {
    document_request: "Document request",
    approval: "Approval",
    confirmation: "Confirmation",
    question: "Question",
  };

  return labels[value] || "Request";
}

export default function ClientPortalRequestActionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const requestId = String(params?.id || "");

  const [data, setData] = useState<PortalMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [responseText, setResponseText] = useState("");
  const [approvalChoice, setApprovalChoice] = useState<"approved" | "declined" | "">("");
  const [confirmationChoice, setConfirmationChoice] = useState<"confirmed" | "cannot_confirm" | "">("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  async function sessionToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Your PracticePilot login session could not be confirmed.");
    }

    return session.access_token;
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      const token = await sessionToken();
      const response = await fetch("/api/client-portal/me", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = (await response.json()) as PortalMeResponse;

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not load the request.");
      }

      const request = (result.requests || []).find(
        (item) => item.id === requestId
      );

      if (!request) {
        throw new Error("This request is not available to your portal login.");
      }

      setData({
        ...result,
        requests: [request],
      });
      setResponseText(request.response_text || "");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load the request."
      );
    } finally {
      setLoading(false);
    }
  }

  const request = useMemo(
    () => data?.requests?.[0] || null,
    [data]
  );

  async function submitAction(action: string) {
    if (!request) return;

    if (request.request_type === "question" && !responseText.trim()) {
      setError("Please enter your response.");
      return;
    }

    if (request.request_type === "approval" && !approvalChoice) {
      setError("Please choose Approve or Decline.");
      return;
    }

    if (request.request_type === "confirmation" && !confirmationChoice) {
      setError("Please choose a confirmation option.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const token = await sessionToken();

      const response = await fetch(
        `/api/client-portal/requests/${request.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            response_text: responseText.trim() || null,
            approval_choice: approvalChoice || null,
            confirmation_choice: confirmationChoice || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not submit the request.");
      }

      setNotice("Submitted successfully.");
      window.setTimeout(() => {
        router.push("/client-portal?view=requests");
        router.refresh();
      }, 700);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not submit the request."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main style={styles.state}>Loading request...</main>;
  }

  if (error && !request) {
    return (
      <main style={styles.state}>
        <div style={styles.error}>{error}</div>
        <button
          type="button"
          onClick={() => router.push("/client-portal?view=requests")}
          style={styles.secondaryButton}
        >
          Back to Requests
        </button>
      </main>
    );
  }

  if (!request || !data?.client) {
    return <main style={styles.state}>Request not found.</main>;
  }

  const closed = ["submitted", "completed", "cancelled"].includes(request.status);

  return (
    <main style={styles.page}>
      <header style={styles.topbar}>
        <div style={styles.brand}>PracticePilot</div>
        <div style={styles.clientName}>{data.client.client_name}</div>
      </header>

      <div style={styles.shell}>
        <aside style={styles.sidebar}>
          <div style={styles.sideBrand}>
            <span style={styles.logoMark}>PP</span>
            <div>
              <strong>PracticePilot</strong>
              <span>Client Portal</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/client-portal")}
            style={styles.sideButton}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => router.push("/client-portal?view=documents")}
            style={styles.sideButton}
          >
            Documents
          </button>
          <button
            type="button"
            onClick={() => router.push("/client-portal?view=requests")}
            style={styles.sideButtonActive}
          >
            Requests
          </button>
        </aside>

        <section style={styles.main}>
          <button
            type="button"
            onClick={() => router.push("/client-portal?view=requests")}
            style={styles.backButton}
          >
            ← Back to Requests
          </button>

          <section style={styles.hero}>
            <div>
              <span style={styles.eyebrow}>
                {requestTypeLabel(request.request_type)}
              </span>
              <h1 style={styles.title}>{request.title}</h1>
              {request.description ? (
                <p style={styles.description}>{request.description}</p>
              ) : null}
            </div>

            <div style={styles.heroMeta}>
              <div>
                <span>Due</span>
                <strong>{formatDate(request.due_date)}</strong>
              </div>
              <div>
                <span>Priority</span>
                <strong style={{ textTransform: "capitalize" }}>
                  {request.priority}
                </strong>
              </div>
              <div>
                <span>Status</span>
                <strong style={{ textTransform: "capitalize" }}>
                  {request.status.replaceAll("_", " ")}
                </strong>
              </div>
            </div>
          </section>

          {error ? <div style={styles.error}>{error}</div> : null}
          {notice ? <div style={styles.notice}>{notice}</div> : null}

          {closed ? (
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Request already submitted</h2>
              <p style={styles.cardText}>
                No further action is required from you at this stage.
              </p>
            </section>
          ) : null}

          {!closed && request.request_type === "document_request" ? (
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Upload the requested document</h2>
              <p style={styles.cardText}>
                Choose the file you want to send to your accounting team.
              </p>

              <label style={styles.uploadArea}>
                <input
                  type="file"
                  style={{ display: "none" }}
                  onChange={(event) =>
                    setSelectedFile(event.target.files?.[0] || null)
                  }
                />
                <strong>
                  {selectedFile ? selectedFile.name : "Choose a file"}
                </strong>
                <span>
                  {selectedFile
                    ? `${Math.max(1, Math.round(selectedFile.size / 1024))} KB selected`
                    : "Click here to browse your computer"}
                </span>
              </label>

              <div style={styles.actionRow}>
                <button
                  type="button"
                  disabled={!selectedFile || saving}
                  style={
                    selectedFile && !saving
                      ? styles.primaryButton
                      : styles.primaryButtonDisabled
                  }
                  onClick={async () => {
                    if (!selectedFile) return;

                    setSaving(true);
                    setError("");
                    setNotice("");

                    try {
                      const token = await sessionToken();
                      const formData = new FormData();

                      formData.set("file", selectedFile);

                      const response = await fetch(
                        `/api/client-portal/requests/${request.id}/upload`,
                        {
                          method: "POST",
                          headers: {
                            Authorization: `Bearer ${token}`,
                          },
                          body: formData,
                        }
                      );

                      const result = await response.json();

                      if (!response.ok || !result?.success) {
                        throw new Error(
                          result?.error || "Could not upload the document."
                        );
                      }

                      setNotice(
                        `${selectedFile.name} uploaded successfully.`
                      );

                      window.setTimeout(() => {
                        router.push("/client-portal?view=requests");
                        router.refresh();
                      }, 800);
                    } catch (caught) {
                      setError(
                        caught instanceof Error
                          ? caught.message
                          : "Could not upload the document."
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? "Uploading..." : "Submit Document"}
                </button>
              </div>
            </section>
          ) : null}

          {!closed && request.request_type === "question" ? (
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Your response</h2>
              <textarea
                value={responseText}
                onChange={(event) => setResponseText(event.target.value)}
                placeholder="Type your response here..."
                style={styles.textarea}
              />
              <div style={styles.actionRow}>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void submitAction("respond")}
                  style={saving ? styles.primaryButtonDisabled : styles.primaryButton}
                >
                  {saving ? "Submitting..." : "Submit Response"}
                </button>
              </div>
            </section>
          ) : null}

          {!closed && request.request_type === "approval" ? (
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Your decision</h2>
              <div style={styles.choiceGrid}>
                <button
                  type="button"
                  onClick={() => setApprovalChoice("approved")}
                  style={{
                    ...styles.choiceButton,
                    ...(approvalChoice === "approved"
                      ? styles.choiceButtonSelected
                      : {}),
                  }}
                >
                  Approve
                </button>

                <button
                  type="button"
                  onClick={() => setApprovalChoice("declined")}
                  style={{
                    ...styles.choiceButton,
                    ...(approvalChoice === "declined"
                      ? styles.choiceButtonSelectedDanger
                      : {}),
                  }}
                >
                  Decline
                </button>
              </div>

              <textarea
                value={responseText}
                onChange={(event) => setResponseText(event.target.value)}
                placeholder="Optional comment..."
                style={styles.textarea}
              />

              <div style={styles.actionRow}>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void submitAction("approval")}
                  style={saving ? styles.primaryButtonDisabled : styles.primaryButton}
                >
                  {saving ? "Submitting..." : "Submit Decision"}
                </button>
              </div>
            </section>
          ) : null}

          {!closed && request.request_type === "confirmation" ? (
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Please confirm</h2>
              <div style={styles.choiceGrid}>
                <button
                  type="button"
                  onClick={() => setConfirmationChoice("confirmed")}
                  style={{
                    ...styles.choiceButton,
                    ...(confirmationChoice === "confirmed"
                      ? styles.choiceButtonSelected
                      : {}),
                  }}
                >
                  Confirm
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmationChoice("cannot_confirm")}
                  style={{
                    ...styles.choiceButton,
                    ...(confirmationChoice === "cannot_confirm"
                      ? styles.choiceButtonSelectedDanger
                      : {}),
                  }}
                >
                  Cannot Confirm
                </button>
              </div>

              <textarea
                value={responseText}
                onChange={(event) => setResponseText(event.target.value)}
                placeholder="Optional comment..."
                style={styles.textarea}
              />

              <div style={styles.actionRow}>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void submitAction("confirmation")}
                  style={saving ? styles.primaryButtonDisabled : styles.primaryButton}
                >
                  {saving ? "Submitting..." : "Submit Confirmation"}
                </button>
              </div>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f4f7fa",
    color: "#10233a",
  },
  state: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    gap: 12,
    background: "#f4f7fa",
  },
  topbar: {
    height: 64,
    padding: "0 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #dce4ec",
    background: "#ffffff",
  },
  brand: {
    fontSize: 22,
    fontWeight: 950,
  },
  clientName: {
    fontSize: 12,
    fontWeight: 850,
  },
  shell: {
    maxWidth: 1500,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "255px minmax(0, 1fr)",
    minHeight: "calc(100vh - 64px)",
  },
  sidebar: {
    padding: "22px 14px",
    borderRight: "1px solid #dce4ec",
    background: "#ffffff",
  },
  sideBrand: {
    padding: "8px 12px 22px",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  logoMark: {
    width: 38,
    height: 38,
    display: "grid",
    placeItems: "center",
    borderRadius: 6,
    background: "#1768d2",
    color: "#ffffff",
    fontWeight: 950,
  },
  sideButton: {
    width: "100%",
    height: 44,
    padding: "0 14px",
    border: "none",
    background: "transparent",
    color: "#34495e",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 850,
    cursor: "pointer",
  },
  sideButtonActive: {
    width: "100%",
    height: 44,
    padding: "0 14px",
    border: "none",
    borderLeft: "3px solid #1768d2",
    background: "#eaf3ff",
    color: "#1768d2",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
  },
  main: {
    padding: "24px 26px 40px",
  },
  backButton: {
    marginBottom: 12,
    border: "none",
    background: "transparent",
    color: "#1768d2",
    fontSize: 10,
    fontWeight: 900,
    cursor: "pointer",
  },
  hero: {
    padding: "24px 26px",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 24,
    borderRadius: 10,
    background:
      "linear-gradient(115deg, #102f50 0%, #174e79 55%, #1d6b88 100%)",
    color: "#ffffff",
  },
  eyebrow: {
    fontSize: 8,
    fontWeight: 950,
    letterSpacing: "0.09em",
    textTransform: "uppercase",
  },
  title: {
    margin: "8px 0 0",
    fontSize: 28,
    fontWeight: 950,
  },
  description: {
    maxWidth: 760,
    margin: "9px 0 0",
    fontSize: 11,
    lineHeight: 1.6,
    opacity: 0.92,
  },
  heroMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(100px, 1fr))",
    gap: 12,
    alignSelf: "center",
  },
  card: {
    marginTop: 16,
    padding: 20,
    border: "1px solid #d9e2ec",
    borderRadius: 10,
    background: "#ffffff",
  },
  cardTitle: {
    margin: 0,
    fontSize: 17,
  },
  cardText: {
    margin: "6px 0 0",
    color: "#687789",
    fontSize: 10,
  },
  uploadArea: {
    marginTop: 16,
    minHeight: 150,
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: 5,
    border: "1px dashed #9fb3c8",
    borderRadius: 8,
    background: "#f8fbfe",
    color: "#526577",
    cursor: "pointer",
  },
  textarea: {
    width: "100%",
    minHeight: 120,
    marginTop: 16,
    boxSizing: "border-box",
    padding: 12,
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    background: "#ffffff",
    color: "#10233a",
    fontSize: 11,
    resize: "vertical",
  },
  choiceGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  choiceButton: {
    minHeight: 46,
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    background: "#ffffff",
    color: "#10233a",
    fontWeight: 900,
    cursor: "pointer",
  },
  choiceButtonSelected: {
    borderColor: "#3aa66f",
    background: "#edf9f2",
    color: "#226443",
  },
  choiceButtonSelectedDanger: {
    borderColor: "#e4a0a0",
    background: "#fff1f1",
    color: "#9f1f1f",
  },
  actionRow: {
    marginTop: 16,
    display: "flex",
    justifyContent: "flex-end",
  },
  primaryButton: {
    minWidth: 150,
    height: 38,
    border: "1px solid #1768d2",
    borderRadius: 5,
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 10,
    fontWeight: 900,
    cursor: "pointer",
  },
  primaryButtonDisabled: {
    minWidth: 150,
    height: 38,
    border: "1px solid #cbd5e1",
    borderRadius: 5,
    background: "#edf1f5",
    color: "#94a0ad",
    fontSize: 10,
    fontWeight: 900,
    cursor: "not-allowed",
  },
  secondaryButton: {
    minWidth: 150,
    height: 38,
    border: "1px solid #cbd5e1",
    borderRadius: 5,
    background: "#ffffff",
    color: "#10233a",
    fontSize: 10,
    fontWeight: 900,
    cursor: "pointer",
  },
  error: {
    marginTop: 14,
    padding: "10px 12px",
    border: "1px solid #e4a0a0",
    background: "#fff1f1",
    color: "#9f1f1f",
    fontSize: 9,
    fontWeight: 800,
  },
  notice: {
    marginTop: 14,
    padding: "10px 12px",
    border: "1px solid #b7ddc7",
    background: "#edf9f2",
    color: "#226443",
    fontSize: 9,
    fontWeight: 800,
  },
};
