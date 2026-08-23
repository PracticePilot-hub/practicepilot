"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";

type Props = {
  engagementId: string;
  sectionKey: string;
  sectionTitle: string;
  engagementStatus?: string;
  onChanged?: () => void;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export default function AfsReviewPointsPanel({
  engagementId,
  sectionKey,
  sectionTitle,
  engagementStatus = "Draft",
  onChanged,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [points, setPoints] = useState<any[]>([]);
  const [workflow, setWorkflow] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  async function authHeaders(): Promise<Record<string, string>> {
    if (!supabase) return {};
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function load() {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/afs/engagements/${engagementId}/review-points?section=${encodeURIComponent(sectionKey)}`,
        {
          cache: "no-store",
          headers: await authHeaders(),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load review points.");

      setPoints(data.points || []);
      setWorkflow(data.workflow || null);
      setCurrentUserId(data.currentUserId || "");
      setNames(data.names || {});
    } catch (error: any) {
      setMessage(error?.message || "Could not load review points.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [engagementId, sectionKey]);

  const levels = Number(workflow?.workflow_levels || 0);
  const pilots = Array.isArray(workflow?.pilot_user_ids) ? workflow.pilot_user_ids : [];
  const firstOfficers = Array.isArray(workflow?.first_officer_user_ids)
    ? workflow.first_officer_user_ids
    : [];
  const captains = Array.isArray(workflow?.captain_user_ids)
    ? workflow.captain_user_ids
    : [];

  const isPilot = pilots.includes(currentUserId);
  const isFirstOfficer = firstOfficers.includes(currentUserId);
  const isCaptain = captains.includes(currentUserId);

  const canRaise =
    levels === 2 ? isCaptain : levels === 3 ? isFirstOfficer || isCaptain : false;

  const canResolve = isPilot || isCaptain;
  const canClear = canRaise;

  const isLocked = ["final", "archived"].includes(
    String(engagementStatus || "").trim().toLowerCase(),
  );

  async function createPoint() {
    if (!title.trim()) {
      setMessage("Enter the review point.");
      return;
    }

    try {
      setCreating(true);
      setMessage("");

      const response = await fetch(
        `/api/afs/engagements/${engagementId}/review-points`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await authHeaders()),
          },
          body: JSON.stringify({
            sectionKey,
            title,
            detail,
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not add review point.");

      setTitle("");
      setDetail("");
      setShowNew(false);
      await load();
      onChanged?.();
    } catch (error: any) {
      setMessage(error?.message || "Could not add review point.");
    } finally {
      setCreating(false);
    }
  }

  async function act(
    pointId: string,
    action: "resolve" | "clear" | "reopen",
  ) {
    try {
      setSavingId(pointId);
      setMessage("");

      const response = await fetch(
        `/api/afs/engagements/${engagementId}/review-points`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(await authHeaders()),
          },
          body: JSON.stringify({
            pointId,
            action,
            resolutionNote: resolutionNotes[pointId] || "",
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update review point.");

      await load();
      onChanged?.();
    } catch (error: any) {
      setMessage(error?.message || "Could not update review point.");
    } finally {
      setSavingId(null);
    }
  }

  if (loading || !workflow?.is_started || levels === 1) return null;

  const openCount = points.filter((point) => point.status === "open").length;
  const resolvedCount = points.filter((point) => point.status === "resolved").length;
  const clearedCount = points.filter((point) => point.status === "cleared").length;

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.kicker}>REVIEW POINTS</span>
          <strong style={styles.title}>{sectionTitle}</strong>
          <span style={styles.counts}>
            {openCount} open · {resolvedCount} resolved · {clearedCount} cleared
          </span>
        </div>

        {canRaise && !isLocked ? (
          <button
            type="button"
            style={styles.addButton}
            onClick={() => setShowNew((current) => !current)}
          >
            + Review Point
          </button>
        ) : null}
      </div>

      {showNew ? (
        <div style={styles.newPoint}>
          <input
            style={styles.input}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What needs attention?"
          />
          <textarea
            style={styles.textarea}
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            placeholder="Optional detail"
          />
          <div style={styles.formActions}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => setShowNew(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              style={styles.primaryButton}
              disabled={creating}
              onClick={createPoint}
            >
              {creating ? "Adding..." : "Send to Pilot"}
            </button>
          </div>
        </div>
      ) : null}

      {message ? <div style={styles.message}>{message}</div> : null}

      {points.length === 0 ? (
        <div style={styles.empty}>No review points for this section.</div>
      ) : (
        <div style={styles.list}>
          {points.map((point) => (
            <div key={point.id} style={styles.point}>
              <div style={styles.pointTop}>
                <div>
                  <strong style={styles.pointTitle}>{point.title}</strong>
                  {point.detail ? <div style={styles.detail}>{point.detail}</div> : null}
                </div>

                <span
                  style={{
                    ...styles.status,
                    ...(point.status === "open"
                      ? styles.statusOpen
                      : point.status === "resolved"
                        ? styles.statusResolved
                        : styles.statusCleared),
                  }}
                >
                  {String(point.status || "").toUpperCase()}
                </span>
              </div>

              <div style={styles.meta}>
                Raised by {names[point.raised_by] || "Unknown"}
                {point.resolved_by
                  ? ` · Resolved by ${names[point.resolved_by] || "Unknown"}`
                  : ""}
                {point.cleared_by
                  ? ` · Cleared by ${names[point.cleared_by] || "Unknown"}`
                  : ""}
              </div>

              {point.resolution_note ? (
                <div style={styles.resolution}>
                  <strong>Resolution:</strong> {point.resolution_note}
                </div>
              ) : null}

              {!isLocked && point.status === "open" && canResolve ? (
                <div style={styles.resolveRow}>
                  <input
                    style={styles.input}
                    value={resolutionNotes[point.id] || ""}
                    onChange={(event) =>
                      setResolutionNotes((current) => ({
                        ...current,
                        [point.id]: event.target.value,
                      }))
                    }
                    placeholder="What did you change? (optional)"
                  />
                  <button
                    type="button"
                    style={styles.primaryButton}
                    disabled={savingId === point.id}
                    onClick={() => act(point.id, "resolve")}
                  >
                    Resolve
                  </button>
                </div>
              ) : null}

              {!isLocked && point.status === "resolved" && canClear ? (
                <div style={styles.formActions}>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    disabled={savingId === point.id}
                    onClick={() => act(point.id, "reopen")}
                  >
                    Return to Pilot
                  </button>

                  <button
                    type="button"
                    style={styles.primaryButton}
                    disabled={savingId === point.id}
                    onClick={() => act(point.id, "clear")}
                  >
                    Clear Point
                  </button>
                </div>
              ) : null}

              {!isLocked && point.status === "cleared" && canClear ? (
                <div style={styles.formActions}>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    disabled={savingId === point.id}
                    onClick={() => act(point.id, "reopen")}
                  >
                    Reopen Point
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    background: "#ffffff",
    borderTop: "1px solid #cbd5e1",
    borderBottom: "1px solid #cbd5e1",
    marginBottom: 8,
  },
  header: {
    padding: "7px 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderBottom: "1px solid #e2e8f0",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  kicker: {
    color: "#2563eb",
    fontSize: 8.5,
    fontWeight: 900,
    letterSpacing: "0.07em",
  },
  title: {
    color: "#0f172a",
    fontSize: 10.5,
  },
  counts: {
    color: "#64748b",
    fontSize: 9.5,
  },
  addButton: {
    border: "1px solid #1d4ed8",
    background: "#2563eb",
    color: "#fff",
    padding: "5px 8px",
    fontSize: 9.5,
    fontWeight: 900,
    cursor: "pointer",
  },
  newPoint: {
    padding: 8,
    display: "grid",
    gap: 6,
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
  },
  input: {
    border: "1px solid #94a3b8",
    background: "#ffffff",
    padding: "6px 7px",
    fontSize: 10.5,
    width: "100%",
    boxSizing: "border-box",
  },
  textarea: {
    border: "1px solid #94a3b8",
    background: "#ffffff",
    padding: "6px 7px",
    fontSize: 10.5,
    minHeight: 60,
    resize: "vertical",
  },
  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 6,
  },
  primaryButton: {
    border: "1px solid #1d4ed8",
    background: "#2563eb",
    color: "#ffffff",
    padding: "5px 8px",
    fontSize: 9.5,
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "5px 8px",
    fontSize: 9.5,
    fontWeight: 850,
    cursor: "pointer",
  },
  message: {
    padding: "6px 9px",
    background: "#fffbeb",
    borderBottom: "1px solid #fde68a",
    color: "#92400e",
    fontSize: 9.5,
  },
  empty: {
    padding: "8px 10px",
    color: "#94a3b8",
    fontSize: 10,
  },
  list: {
    display: "grid",
  },
  point: {
    padding: "8px 10px",
    borderBottom: "1px solid #e2e8f0",
    display: "grid",
    gap: 5,
  },
  pointTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  pointTitle: {
    fontSize: 10.5,
    color: "#0f172a",
  },
  detail: {
    marginTop: 3,
    color: "#475569",
    fontSize: 10,
  },
  status: {
    padding: "3px 5px",
    border: "1px solid #cbd5e1",
    fontSize: 8.5,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  statusOpen: {
    background: "#fff7ed",
    color: "#c2410c",
    borderColor: "#fdba74",
  },
  statusResolved: {
    background: "#eff6ff",
    color: "#1d4ed8",
    borderColor: "#93c5fd",
  },
  statusCleared: {
    background: "#f0fdf4",
    color: "#166534",
    borderColor: "#86efac",
  },
  meta: {
    color: "#64748b",
    fontSize: 9,
  },
  resolution: {
    color: "#334155",
    fontSize: 9.5,
    background: "#f8fafc",
    padding: "5px 6px",
  },
  resolveRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 6,
  },
};
