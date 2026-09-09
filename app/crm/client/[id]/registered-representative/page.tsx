"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type Director = {
  id: string;
  director_name: string;
  id_passport_number: string | null;
  email: string | null;
  phone: string | null;
  appointment_date: string | null;
  cessation_date: string | null;
  is_active: boolean | null;
};

type Workflow = {
  id: string;
  organisation_id: string;
  client_id: string;
  director_id: string | null;
  status: string;
  resolution_date: string | null;
  submission_date: string | null;
  confirmation_date: string | null;
  notes: string | null;
};

type Item = {
  id: string;
  item_key: string;
  label: string;
  item_order: number;
  item_type: "generated" | "upload";
  status: "outstanding" | "ready" | "completed" | "not_applicable";
  file_name: string | null;
  storage_path: string | null;
  completed_at: string | null;
  completed_by_user_id: string | null;
};

type ApiPayload = {
  success?: boolean;
  error?: string;
  client?: {
    id: string;
    client_name: string;
    registration_number: string | null;
    entity_type: string | null;
  };
  workflow?: Workflow | null;
  directors?: Director[];
  items?: Item[];
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  documents_required: "Documents required",
  ready_for_signature: "Ready for signature",
  ready_for_submission: "Ready for submission",
  submitted: "Submitted",
  confirmed: "Confirmed",
};

function statusLabel(value: string) {
  return STATUS_LABELS[value] || value;
}

function todayDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Not authenticated.");
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

export default function RegisteredRepresentativePage() {
  const params = useParams();
  const clientId = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [clientName, setClientName] = useState("Client");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [entityType, setEntityType] = useState("");

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [directors, setDirectors] = useState<Director[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [selectedDirectorId, setSelectedDirectorId] = useState("");
  const [status, setStatus] = useState("documents_required");
  const [resolutionDate, setResolutionDate] = useState("");
  const [submissionDate, setSubmissionDate] = useState("");
  const [confirmationDate, setConfirmationDate] = useState("");
  const [notes, setNotes] = useState("");

  const activeDirectors = useMemo(
    () => directors.filter((director) => director.is_active !== false),
    [directors]
  );

  const selectedDirector = useMemo(
    () => directors.find((director) => director.id === selectedDirectorId) || null,
    [directors, selectedDirectorId]
  );

  const completedCount = items.filter(
    (item) => item.status === "completed" || item.status === "not_applicable"
  ).length;

  const progress = items.length
    ? Math.round((completedCount / items.length) * 100)
    : 0;

  function hydrate(data: ApiPayload) {
    if (data.client) {
      setClientName(data.client.client_name || "Client");
      setRegistrationNumber(data.client.registration_number || "");
      setEntityType(data.client.entity_type || "");
    }

    setDirectors(data.directors || []);
    setItems(data.items || []);

    if (data.workflow) {
      setWorkflow(data.workflow);
      setSelectedDirectorId(data.workflow.director_id || "");
      setStatus(data.workflow.status || "documents_required");
      setResolutionDate(data.workflow.resolution_date || "");
      setSubmissionDate(data.workflow.submission_date || "");
      setConfirmationDate(data.workflow.confirmation_date || "");
      setNotes(data.workflow.notes || "");
    } else {
      setWorkflow(null);
      setSelectedDirectorId("");
      setStatus("documents_required");
      setResolutionDate("");
      setSubmissionDate("");
      setConfirmationDate("");
      setNotes("");
    }
  }

  async function load() {
    if (!clientId) return;

    setLoading(true);
    setError("");

    try {
      const headers = await authHeaders();
      const response = await fetch(
        `/api/crm/clients/${clientId}/registered-representative`,
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      );

      const data = (await response.json()) as ApiPayload;

      if (!response.ok) {
        throw new Error(data.error || "Could not load Registered Representative.");
      }

      hydrate(data);
    } catch (err: any) {
      setError(err?.message || "Could not load Registered Representative.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [clientId]);

  async function startWorkflow() {
    if (!selectedDirectorId) {
      setError("Select the Registered Representative first.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const headers = await authHeaders();
      const response = await fetch(
        `/api/crm/clients/${clientId}/registered-representative`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ directorId: selectedDirectorId }),
        }
      );

      const data = (await response.json()) as ApiPayload;

      if (!response.ok) {
        throw new Error(data.error || "Could not start Registered Representative.");
      }

      hydrate(data);
      setMessage("Registered Representative workflow started.");
    } catch (err: any) {
      setError(err?.message || "Could not start Registered Representative.");
    } finally {
      setSaving(false);
    }
  }

  async function saveWorkflow() {
    if (!workflow) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const headers = await authHeaders();
      const response = await fetch(
        `/api/crm/clients/${clientId}/registered-representative`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            action: "update_workflow",
            directorId: selectedDirectorId || null,
            status,
            resolutionDate: resolutionDate || null,
            submissionDate: submissionDate || null,
            confirmationDate: confirmationDate || null,
            notes,
          }),
        }
      );

      const data = (await response.json()) as ApiPayload;

      if (!response.ok) {
        throw new Error(data.error || "Could not save Registered Representative.");
      }

      hydrate(data);
      setMessage("Registered Representative saved.");
    } catch (err: any) {
      setError(err?.message || "Could not save Registered Representative.");
    } finally {
      setSaving(false);
    }
  }

  async function markAlreadyConfirmed() {
    if (!selectedDirectorId) {
      setError("Select the current Registered Representative first.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const headers = await authHeaders();

      const startResponse = await fetch(
        `/api/crm/clients/${clientId}/registered-representative`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ directorId: selectedDirectorId }),
        }
      );

      const startData = (await startResponse.json()) as ApiPayload;

      if (!startResponse.ok) {
        throw new Error(
          startData.error || "Could not create Registered Representative record."
        );
      }

      const confirmResponse = await fetch(
        `/api/crm/clients/${clientId}/registered-representative`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            action: "update_workflow",
            directorId: selectedDirectorId,
            status: "confirmed",
            resolutionDate: null,
            submissionDate: null,
            confirmationDate: todayDateKey(),
            notes: "Existing Registered Representative captured on client takeover.",
          }),
        }
      );

      const confirmData = (await confirmResponse.json()) as ApiPayload;

      if (!confirmResponse.ok) {
        throw new Error(
          confirmData.error || "Could not confirm Registered Representative."
        );
      }

      hydrate(confirmData);
      setMessage("Existing Registered Representative recorded as confirmed.");
    } catch (err: any) {
      setError(err?.message || "Could not confirm Registered Representative.");
    } finally {
      setSaving(false);
    }
  }

  async function startRepresentativeChange() {
    if (!workflow) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const headers = await authHeaders();
      const response = await fetch(
        `/api/crm/clients/${clientId}/registered-representative`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            action: "update_workflow",
            directorId: selectedDirectorId || null,
            status: "documents_required",
            resolutionDate: null,
            submissionDate: null,
            confirmationDate: null,
            notes,
          }),
        }
      );

      const data = (await response.json()) as ApiPayload;

      if (!response.ok) {
        throw new Error(data.error || "Could not start RR change.");
      }

      hydrate(data);
      setMessage("RR change workflow opened.");
    } catch (err: any) {
      setError(err?.message || "Could not start RR change.");
    } finally {
      setSaving(false);
    }
  }

  async function generateResolution() {
    if (!workflow || !selectedDirectorId) {
      setError("Select and save the Registered Representative first.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const headers = await authHeaders();
      const response = await fetch(
        `/api/crm/clients/${clientId}/registered-representative/resolution`,
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Could not generate the resolution.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");

      if (!resolutionDate) setResolutionDate(todayDateKey());

      setMessage("Registered Representative resolution generated.");
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      setError(err?.message || "Could not generate the resolution.");
    } finally {
      setSaving(false);
    }
  }

  function openSarsTppoa() {
    window.open(
      "https://www.sars.gov.za/wp-content/uploads/Ops/Forms/TPPOA-Special-Power-of-Attorney-to-Tax-Practitioner-External-Form.pdf",
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function updateItem(item: Item, nextStatus: Item["status"]) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const headers = await authHeaders();
      const response = await fetch(
        `/api/crm/clients/${clientId}/registered-representative`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            action: "update_item",
            itemId: item.id,
            status: nextStatus,
          }),
        }
      );

      const data = (await response.json()) as ApiPayload;

      if (!response.ok) {
        throw new Error(data.error || "Could not update checklist item.");
      }

      hydrate(data);
    } catch (err: any) {
      setError(err?.message || "Could not update checklist item.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main style={styles.page}>Loading Registered Representative...</main>;
  }

  return (
    <main style={styles.page}>
      <section style={styles.topBar}>
        <Link
          href={`/crm/client/${clientId}?tab=registrations`}
          style={styles.backLink}
        >
          ← Back to Registrations
        </Link>
      </section>

      <section style={styles.hero}>
        <div>
          <div style={styles.heroKicker}>Registered Representative</div>
          <h1 style={styles.title}>{clientName}</h1>
          <div style={styles.meta}>
            {entityType || "Entity"}
            {registrationNumber ? `  •  ${registrationNumber}` : ""}
          </div>
        </div>

        {workflow ? (
          <span style={styles.statusBadge}>{statusLabel(workflow.status)}</span>
        ) : (
          <span style={styles.statusBadgeMuted}>Not started</span>
        )}
      </section>

      {error ? <div style={styles.errorBox}>{error}</div> : null}
      {message ? <div style={styles.messageBox}>{message}</div> : null}

      {!workflow ? (
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Select the SARS representative</h2>
              <p style={styles.panelSubtitle}>
                Choose the director who will act as the Registered Representative.
              </p>
            </div>
          </div>

          <div style={styles.startGrid}>
            <div>
              <label style={styles.label}>Registered Representative</label>
              <select
                style={styles.input}
                value={selectedDirectorId}
                onChange={(event) => setSelectedDirectorId(event.target.value)}
              >
                <option value="">Select director...</option>
                {activeDirectors.map((director) => (
                  <option key={director.id} value={director.id}>
                    {director.director_name}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.startActions}>
              <button
                type="button"
                style={styles.primaryButton}
                onClick={startWorkflow}
                disabled={saving || !selectedDirectorId}
              >
                {saving ? "Starting..." : "Start RR workflow"}
              </button>

              <button
                type="button"
                style={styles.secondaryButton}
                onClick={markAlreadyConfirmed}
                disabled={saving || !selectedDirectorId}
              >
                Already confirmed
              </button>
            </div>
          </div>

          {activeDirectors.length === 0 ? (
            <div style={styles.warningBox}>
              No active directors are available. Add the director under People /
              Secretarial first.
            </div>
          ) : null}
        </section>
      ) : (
        <>
          <section style={styles.summaryStrip}>
            <div style={styles.summaryCell}>
              <span style={styles.summaryLabel}>Representative</span>
              <strong style={styles.summaryValue}>
                {selectedDirector?.director_name || "Not selected"}
              </strong>
            </div>

            <div style={styles.summaryCell}>
              <span style={styles.summaryLabel}>Pack progress</span>
              <strong style={styles.summaryValue}>
                {completedCount}/{items.length}
              </strong>
            </div>

            <div style={styles.summaryCell}>
              <span style={styles.summaryLabel}>Completion</span>
              <strong style={styles.summaryValue}>{progress}%</strong>
            </div>

            <div style={{ ...styles.summaryCell, borderRight: "none" }}>
              <span style={styles.summaryLabel}>Status</span>
              <strong style={styles.summaryValue}>{statusLabel(status)}</strong>
            </div>
          </section>

          <section style={styles.workspace}>
            <div style={styles.mainColumn}>
              <section style={styles.panel}>
                <div style={styles.panelHeader}>
                  <div>
                    <h2 style={styles.panelTitle}>Representative details</h2>
                    <p style={styles.panelSubtitle}>
                      The RR is linked to the client’s existing director master data.
                    </p>
                  </div>

                  {status === "confirmed" ? (
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={startRepresentativeChange}
                      disabled={saving}
                    >
                      Change RR
                    </button>
                  ) : null}
                </div>

                <div style={styles.formGrid}>
                  <div>
                    <label style={styles.label}>Registered Representative</label>
                    <select
                      style={styles.input}
                      value={selectedDirectorId}
                      onChange={(event) => setSelectedDirectorId(event.target.value)}
                    >
                      <option value="">Select director...</option>
                      {activeDirectors.map((director) => (
                        <option key={director.id} value={director.id}>
                          {director.director_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={styles.label}>Workflow status</label>
                    <select
                      style={styles.input}
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                    >
                      <option value="documents_required">Documents required</option>
                      <option value="ready_for_signature">Ready for signature</option>
                      <option value="ready_for_submission">Ready for submission</option>
                      <option value="submitted">Submitted</option>
                      <option value="confirmed">Confirmed</option>
                    </select>
                  </div>

                  <div>
                    <label style={styles.label}>Resolution date</label>
                    <input
                      type="date"
                      style={styles.input}
                      value={resolutionDate}
                      onChange={(event) => setResolutionDate(event.target.value)}
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Submission date</label>
                    <input
                      type="date"
                      style={styles.input}
                      value={submissionDate}
                      onChange={(event) => setSubmissionDate(event.target.value)}
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Confirmation date</label>
                    <input
                      type="date"
                      style={styles.input}
                      value={confirmationDate}
                      onChange={(event) => setConfirmationDate(event.target.value)}
                    />
                  </div>
                </div>

                {selectedDirector ? (
                  <div style={styles.directorFacts}>
                    <span>
                      <strong>ID / Passport:</strong>{" "}
                      {selectedDirector.id_passport_number || "Not captured"}
                    </span>
                    <span>
                      <strong>Email:</strong>{" "}
                      {selectedDirector.email || "Not captured"}
                    </span>
                    <span>
                      <strong>Phone:</strong>{" "}
                      {selectedDirector.phone || "Not captured"}
                    </span>
                  </div>
                ) : null}

                <div style={styles.notesWrap}>
                  <label style={styles.label}>Notes</label>
                  <textarea
                    rows={4}
                    style={styles.textarea}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>

                <div style={styles.actions}>
                  <button
                    type="button"
                    style={styles.primaryButton}
                    onClick={saveWorkflow}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save RR"}
                  </button>
                </div>
              </section>

              <section style={styles.panel}>
                <div style={styles.panelHeader}>
                  <div>
                    <h2 style={styles.panelTitle}>Registered Representative pack</h2>
                    <p style={styles.panelSubtitle}>
                      Everything required for the SARS RR submission in one place.
                    </p>
                  </div>
                  <div style={styles.progressText}>
                    {completedCount} of {items.length} complete
                  </div>
                </div>

                <div style={styles.progressTrack}>
                  <div style={{ ...styles.progressFill, width: `${progress}%` }} />
                </div>

                <div style={styles.checklist}>
                  {items.map((item) => {
                    const done =
                      item.status === "completed" ||
                      item.status === "not_applicable";

                    return (
                      <div key={item.id} style={styles.checkRow}>
                        <button
                          type="button"
                          aria-label={`Toggle ${item.label}`}
                          style={{
                            ...styles.checkbox,
                            ...(done ? styles.checkboxDone : {}),
                          }}
                          onClick={() =>
                            updateItem(
                              item,
                              done ? "outstanding" : "completed"
                            )
                          }
                          disabled={saving}
                        >
                          {done ? "✓" : ""}
                        </button>

                        <div style={styles.checkMain}>
                          <strong
                            style={{
                              ...styles.checkLabel,
                              ...(done ? styles.checkLabelDone : {}),
                            }}
                          >
                            {item.label}
                          </strong>
                          <span style={styles.checkMeta}>
                            {item.item_type === "generated"
                              ? "PracticePilot generated document"
                              : "Supporting document / evidence"}
                          </span>
                        </div>

                        <div style={styles.itemActions}>
                          {item.item_type === "generated" ? (
                            <span style={styles.generatedBadge}>PP document</span>
                          ) : (
                            <button
                              type="button"
                              style={styles.secondaryButton}
                              disabled
                              title="Document upload is added in the next step"
                            >
                              Upload
                            </button>
                          )}

                          <button
                            type="button"
                            style={styles.naButton}
                            onClick={() =>
                              updateItem(
                                item,
                                item.status === "not_applicable"
                                  ? "outstanding"
                                  : "not_applicable"
                              )
                            }
                            disabled={saving}
                          >
                            N/A
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <aside style={styles.sideColumn}>
              <section style={styles.sidePanel}>
                <h3 style={styles.sideTitle}>Submission control</h3>
                <div style={styles.sideRow}>
                  <span>Pack</span>
                  <strong>{progress === 100 ? "Complete" : "In progress"}</strong>
                </div>
                <div style={styles.sideRow}>
                  <span>Submitted</span>
                  <strong>{submissionDate || "—"}</strong>
                </div>
                <div style={styles.sideRow}>
                  <span>Confirmed</span>
                  <strong>{confirmationDate || "—"}</strong>
                </div>
              </section>

              <section style={styles.sidePanel}>
                <h3 style={styles.sideTitle}>RR documents</h3>
                <p style={styles.sideText}>
                  Generate the PracticePilot resolution below. For the SARS TPPOA,
                  open the official SARS form, download it, complete it and upload
                  the signed copy back to this RR pack.
                </p>
                <button
                  type="button"
                  style={styles.fullSecondaryButtonActive}
                  onClick={generateResolution}
                  disabled={saving || !selectedDirectorId}
                >
                  Generate Resolution
                </button>
                <button
                  type="button"
                  style={styles.fullSecondaryButtonActive}
                  onClick={openSarsTppoa}
                >
                  Open SARS TPPOA Form
                </button>
              </section>
            </aside>
          </section>
        </>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#eef3f7",
    color: "#13263d",
    padding: 16,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  },
  topBar: {
    background: "#ffffff",
    border: "1px solid #d5e0e8",
    padding: "12px 16px",
    marginBottom: 10,
  },
  backLink: {
    color: "#1558c0",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 14,
  },
  hero: {
    background: "#ffffff",
    border: "1px solid #d5e0e8",
    padding: "22px 20px",
    marginBottom: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
  },
  heroKicker: {
    color: "#64788c",
    fontWeight: 700,
    fontSize: 14,
    marginBottom: 7,
  },
  title: {
    margin: 0,
    fontSize: 27,
    lineHeight: 1.15,
    color: "#13263d",
  },
  meta: {
    marginTop: 8,
    color: "#6f8295",
    fontSize: 14,
  },
  statusBadge: {
    border: "1px solid #a8d6bb",
    background: "#eef9f2",
    color: "#24643d",
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 700,
  },
  statusBadgeMuted: {
    border: "1px solid #cfd9e2",
    background: "#f7f9fb",
    color: "#66788a",
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 700,
  },
  errorBox: {
    background: "#fff4f1",
    border: "1px solid #efc1b5",
    color: "#963524",
    padding: "10px 12px",
    marginBottom: 10,
    fontSize: 13,
  },
  messageBox: {
    background: "#f1faf4",
    border: "1px solid #b8ddc3",
    color: "#28643c",
    padding: "10px 12px",
    marginBottom: 10,
    fontSize: 13,
  },
  panel: {
    background: "#ffffff",
    border: "1px solid #d5e0e8",
    marginBottom: 10,
  },
  panelHeader: {
    padding: "15px 16px",
    borderBottom: "1px solid #dfe7ed",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  panelTitle: {
    margin: 0,
    fontSize: 17,
    color: "#172b42",
  },
  panelSubtitle: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#708294",
  },
  startGrid: {
    padding: 16,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "end",
  },
  startActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    color: "#4f6275",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 38,
    border: "1px solid #c9d7e2",
    background: "#ffffff",
    color: "#182c43",
    padding: "7px 9px",
    outline: "none",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #c9d7e2",
    background: "#ffffff",
    color: "#182c43",
    padding: "9px",
    resize: "vertical",
    outline: "none",
  },
  primaryButton: {
    border: "1px solid #1565dc",
    background: "#1565dc",
    color: "#ffffff",
    minHeight: 38,
    padding: "8px 15px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cbd7e1",
    background: "#ffffff",
    color: "#263c52",
    minHeight: 32,
    padding: "6px 10px",
    fontWeight: 700,
    cursor: "pointer",
  },
  fullSecondaryButton: {
    width: "100%",
    border: "1px solid #cbd7e1",
    background: "#f7f9fb",
    color: "#7b8b9a",
    minHeight: 36,
    padding: "7px 10px",
    fontWeight: 700,
    marginTop: 8,
  },
  fullSecondaryButtonActive: {
    width: "100%",
    border: "1px solid #cbd7e1",
    background: "#ffffff",
    color: "#263c52",
    minHeight: 36,
    padding: "7px 10px",
    fontWeight: 700,
    marginTop: 8,
    cursor: "pointer",
  },
  naButton: {
    border: "1px solid #cbd7e1",
    background: "#ffffff",
    color: "#5f7183",
    minHeight: 32,
    padding: "6px 9px",
    fontWeight: 700,
    cursor: "pointer",
  },
  warningBox: {
    margin: "0 16px 16px",
    padding: "10px 12px",
    background: "#fff8e7",
    border: "1px solid #ead39b",
    color: "#6f5521",
    fontSize: 13,
  },
  summaryStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    border: "1px solid #d5e0e8",
    background: "#ffffff",
    marginBottom: 10,
  },
  summaryCell: {
    padding: "12px 14px",
    borderRight: "1px solid #dfe7ed",
  },
  summaryLabel: {
    display: "block",
    color: "#728496",
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 5,
  },
  summaryValue: {
    display: "block",
    fontSize: 16,
    color: "#172b42",
  },
  workspace: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 270px",
    gap: 10,
    alignItems: "start",
  },
  mainColumn: {
    minWidth: 0,
  },
  sideColumn: {
    display: "grid",
    gap: 10,
  },
  sidePanel: {
    background: "#ffffff",
    border: "1px solid #d5e0e8",
    padding: 14,
  },
  sideTitle: {
    margin: "0 0 12px",
    fontSize: 15,
  },
  sideText: {
    margin: "0 0 10px",
    color: "#6e8092",
    fontSize: 12,
    lineHeight: 1.5,
  },
  sideRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "8px 0",
    borderBottom: "1px solid #edf1f4",
    fontSize: 12,
  },
  formGrid: {
    padding: 16,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  directorFacts: {
    margin: "0 16px 14px",
    background: "#f6f9fb",
    border: "1px solid #dbe4eb",
    padding: 10,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    fontSize: 12,
    color: "#53677b",
  },
  notesWrap: {
    padding: "0 16px 16px",
  },
  actions: {
    borderTop: "1px solid #e1e8ee",
    padding: "11px 16px",
    display: "flex",
    justifyContent: "flex-end",
  },
  progressText: {
    fontSize: 12,
    color: "#5e7184",
    fontWeight: 700,
  },
  progressTrack: {
    height: 5,
    background: "#edf2f5",
    margin: "0 16px 6px",
  },
  progressFill: {
    height: "100%",
    background: "#3d8b62",
  },
  checklist: {
    padding: "0 16px 14px",
  },
  checkRow: {
    display: "grid",
    gridTemplateColumns: "34px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 10,
    minHeight: 56,
    borderBottom: "1px solid #e5ebf0",
  },
  checkbox: {
    width: 24,
    height: 24,
    border: "1px solid #bfd0dc",
    background: "#ffffff",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },
  checkboxDone: {
    background: "#5fae7d",
    borderColor: "#5fae7d",
  },
  checkMain: {
    minWidth: 0,
  },
  checkLabel: {
    display: "block",
    fontSize: 13,
    color: "#20354c",
  },
  checkLabelDone: {
    textDecoration: "line-through",
    color: "#6d7d8d",
  },
  checkMeta: {
    display: "block",
    marginTop: 3,
    fontSize: 11,
    color: "#8593a1",
  },
  itemActions: {
    display: "flex",
    alignItems: "center",
    gap: 7,
  },
  generatedBadge: {
    border: "1px solid #b8d0e9",
    background: "#eef6ff",
    color: "#255f99",
    padding: "6px 8px",
    fontSize: 11,
    fontWeight: 700,
  },
};

