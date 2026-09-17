"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type Props = {
  clientId: string;
  clientName: string;
  isClosed: boolean;
  compact?: boolean;
};

export default function ClientLifecycleAction({
  clientId,
  clientName,
  isClosed,
  compact = false,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [reason, setReason] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [canDeleteClient, setCanDeleteClient] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDeletePermission();
  }, [clientId]);

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not signed in.");
    }

    return session.access_token;
  }

  async function apiRequest(
    method: "GET" | "POST" | "DELETE",
    body?: Record<string, unknown>
  ) {
    const token = await getAccessToken();

    const response = await fetch(
      `/api/crm/clients/${encodeURIComponent(clientId)}/lifecycle`,
      {
        method,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          Authorization: `Bearer ${token}`,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }
    );

    const raw = await response.text();

    let data: any = null;

    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      throw new Error(
        `Lifecycle route returned HTTP ${response.status} instead of JSON.`
      );
    }

    if (!response.ok || data?.success === false) {
      throw new Error(data?.error || "Client lifecycle action failed.");
    }

    return data;
  }

  async function loadDeletePermission() {
    try {
      const data = await apiRequest("GET");
      setCanDeleteClient(Boolean(data?.canDeleteClient));
    } catch {
      setCanDeleteClient(false);
    }
  }

  async function sendAction(action: "close" | "reopen") {
    try {
      setBusy(true);
      setError("");

      await apiRequest("POST", {
        action,
        closureReason: action === "close" ? reason.trim() : null,
      });

      setShowClose(false);
      setReason("");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Client status could not be updated."
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteClient() {
    if (deleteConfirmation.trim() !== clientName.trim()) {
      setError("Type the client name exactly to confirm deletion.");
      return;
    }

    try {
      setBusy(true);
      setError("");

      await apiRequest("DELETE", {
        confirmation: deleteConfirmation.trim(),
      });

      router.push("/crm/clients");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Client could not be deleted."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {compact ? (
        <div style={actionsWrap}>
          <button
            type="button"
            onClick={() => setShowActions((current) => !current)}
            style={compactMenuButton}
          >
            Actions ▾
          </button>

          {showActions ? (
            <div style={actionsMenu}>
              {isClosed ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowActions(false);
                    sendAction("reopen");
                  }}
                  style={actionsMenuItem}
                  disabled={busy}
                >
                  Reopen Client
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowActions(false);
                    setError("");
                    setShowClose(true);
                  }}
                  style={actionsMenuItem}
                >
                  Close Client
                </button>
              )}

              {canDeleteClient ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowActions(false);
                    setError("");
                    setDeleteConfirmation("");
                    setShowDelete(true);
                  }}
                  style={actionsMenuDanger}
                >
                  Delete Client
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {isClosed ? (
            <button
              type="button"
              onClick={() => sendAction("reopen")}
              disabled={busy}
              style={{
                ...secondaryButton,
                opacity: busy ? 0.6 : 1,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Reopening..." : "Reopen Client"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setError("");
                setShowClose(true);
              }}
              style={dangerButton}
            >
              Close Client
            </button>
          )}

          {canDeleteClient ? (
            <button
              type="button"
              onClick={() => {
                setError("");
                setDeleteConfirmation("");
                setShowDelete(true);
              }}
              style={deleteButton}
            >
              Delete Client
            </button>
          ) : null}
        </>
      )}

      {showClose ? (
        <div style={overlay}>
          <div style={dialog}>
            <div style={dialogHeader}>
              <div>
                <strong style={dialogTitle}>Close client</strong>
                <div style={dialogSubtitle}>{clientName}</div>
              </div>

              <button
                type="button"
                onClick={() => setShowClose(false)}
                style={iconButton}
                disabled={busy}
              >
                ×
              </button>
            </div>

            <div style={dialogBody}>
              <div style={notice}>
                Closing a client does not delete anything. The client record,
                documents, people, completed work and history remain available
                under Former / Closed clients.
              </div>

              <label style={field}>
                <span style={label}>Closure reason</span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={4}
                  style={textarea}
                  placeholder="Optional note, e.g. client moved to another accountant..."
                />
              </label>

              {error ? <div style={errorBox}>{error}</div> : null}
            </div>

            <div style={dialogFooter}>
              <button
                type="button"
                onClick={() => setShowClose(false)}
                style={secondaryButton}
                disabled={busy}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => sendAction("close")}
                style={dangerButton}
                disabled={busy}
              >
                {busy ? "Closing..." : "Close Client"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDelete ? (
        <div style={overlay}>
          <div style={dialog}>
            <div style={dialogHeader}>
              <div>
                <strong style={dialogTitle}>Permanently delete client</strong>
                <div style={dialogSubtitle}>{clientName}</div>
              </div>

              <button
                type="button"
                onClick={() => setShowDelete(false)}
                style={iconButton}
                disabled={busy}
              >
                ×
              </button>
            </div>

            <div style={dialogBody}>
              <div style={deleteWarning}>
                <strong>This cannot be undone.</strong>
                <span>
                  Hard delete is intended only for setup mistakes. PracticePilot
                  will refuse deletion if the client already has protected
                  proposals, engagements or completed Secretarial records.
                </span>
              </div>

              <label style={field}>
                <span style={label}>
                  Type <strong>{clientName}</strong> to confirm
                </span>
                <input
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  style={input}
                  autoComplete="off"
                />
              </label>

              {error ? <div style={errorBox}>{error}</div> : null}
            </div>

            <div style={dialogFooter}>
              <button
                type="button"
                onClick={() => setShowDelete(false)}
                style={secondaryButton}
                disabled={busy}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={deleteClient}
                style={solidDeleteButton}
                disabled={busy}
              >
                {busy ? "Deleting..." : "Permanently Delete Client"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

const secondaryButton: React.CSSProperties = {
  minHeight: "30px",
  padding: "0 10px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#ffffff",
  color: "#0f1f33",
  border: "1px solid #cbd5e1",
  fontSize: "10px",
  fontWeight: 850,
};

const dangerButton: React.CSSProperties = {
  minHeight: "30px",
  padding: "0 10px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#ffffff",
  color: "#9f2d2d",
  border: "1px solid #d7aaaa",
  fontSize: "10px",
  fontWeight: 850,
  cursor: "pointer",
};

const deleteButton: React.CSSProperties = {
  ...dangerButton,
  color: "#7f1d1d",
  border: "1px solid #c98f8f",
};

const solidDeleteButton: React.CSSProperties = {
  ...dangerButton,
  background: "#991b1b",
  border: "1px solid #7f1d1d",
  color: "#ffffff",
};

const actionsWrap: React.CSSProperties = {
  position: "relative",
};

const compactMenuButton: React.CSSProperties = {
  minHeight: "28px",
  padding: "0 9px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "9px",
  fontWeight: 800,
  cursor: "pointer",
};

const actionsMenu: React.CSSProperties = {
  position: "absolute",
  top: "32px",
  right: 0,
  zIndex: 20,
  minWidth: "150px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  boxShadow: "0 8px 20px rgba(16,35,58,0.12)",
};

const actionsMenuItem: React.CSSProperties = {
  width: "100%",
  minHeight: "32px",
  padding: "0 10px",
  display: "flex",
  alignItems: "center",
  border: "none",
  borderBottom: "1px solid #e5eaf0",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "9px",
  fontWeight: 800,
  cursor: "pointer",
  textAlign: "left",
};

const actionsMenuDanger: React.CSSProperties = {
  ...actionsMenuItem,
  color: "#9f2d2d",
};

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  background: "rgba(15, 31, 51, 0.35)",
};

const dialog: React.CSSProperties = {
  width: "min(590px, 100%)",
  background: "#ffffff",
  border: "1px solid #cfd8df",
  boxShadow: "0 24px 60px rgba(15, 31, 51, 0.2)",
};

const dialogHeader: React.CSSProperties = {
  minHeight: "62px",
  padding: "12px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "14px",
  borderBottom: "1px solid #e3e8ec",
};

const dialogTitle: React.CSSProperties = {
  color: "#10233a",
  fontSize: "16px",
  fontWeight: 900,
};

const dialogSubtitle: React.CSSProperties = {
  marginTop: "3px",
  color: "#667582",
  fontSize: "11px",
};

const iconButton: React.CSSProperties = {
  width: "32px",
  height: "32px",
  border: "1px solid #d4dce3",
  background: "#ffffff",
  color: "#52616d",
  fontSize: "20px",
  cursor: "pointer",
};

const dialogBody: React.CSSProperties = {
  padding: "14px",
};

const notice: React.CSSProperties = {
  padding: "10px 12px",
  marginBottom: "14px",
  borderLeft: "3px solid #6d8798",
  background: "#f5f8fa",
  color: "#52616d",
  fontSize: "11px",
  lineHeight: 1.5,
};

const deleteWarning: React.CSSProperties = {
  padding: "11px 12px",
  marginBottom: "14px",
  display: "grid",
  gap: "4px",
  borderLeft: "4px solid #991b1b",
  background: "#fff4f4",
  color: "#7f1d1d",
  fontSize: "11px",
  lineHeight: 1.5,
};

const field: React.CSSProperties = {
  display: "grid",
  gap: "5px",
};

const label: React.CSSProperties = {
  color: "#40515d",
  fontSize: "10px",
  fontWeight: 850,
};

const input: React.CSSProperties = {
  width: "100%",
  minHeight: "38px",
  padding: "8px 10px",
  boxSizing: "border-box",
  border: "1px solid #cfd8df",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "12px",
};

const textarea: React.CSSProperties = {
  ...input,
  minHeight: "96px",
  resize: "vertical",
  fontFamily: "inherit",
};

const errorBox: React.CSSProperties = {
  marginTop: "10px",
  padding: "9px 10px",
  border: "1px solid #e4a0a0",
  background: "#fff3f3",
  color: "#9f2d2d",
  fontSize: "11px",
  fontWeight: 800,
};

const dialogFooter: React.CSSProperties = {
  padding: "12px 14px",
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  borderTop: "1px solid #e3e8ec",
  background: "#fafbfc",
};
