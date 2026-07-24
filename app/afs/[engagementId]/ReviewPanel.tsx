"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams } from "next/navigation";

type ReviewPoint = {
  id: string;
  source_area: string;
  title: string;
  detail: string | null;
  priority: "low" | "normal" | "high";
  status: "open" | "answered" | "cleared";
  response: string | null;
};

type Signoff = {
  id: string;
  area_key: string;
  area_title: string;
  status: "not_started" | "prepared" | "reviewed";
  prepared_by: string | null;
  reviewed_by: string | null;
  notes: string | null;
};

export default function ReviewPanel() {
  const params = useParams();
  const engagementId = String(params?.engagementId || "");
  const [points, setPoints] = useState<ReviewPoint[]>([]);
  const [signoffs, setSignoffs] = useState<Signoff[]>([]);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!engagementId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId]);

  async function loadAll() {
    const [pointsRes, signoffsRes] = await Promise.all([
      fetch(`/api/afs/engagements/${engagementId}/review-points`, { cache: "no-store" }),
      fetch(`/api/afs/engagements/${engagementId}/review-signoffs`, { cache: "no-store" }),
    ]);
    const pointsData = await pointsRes.json();
    const signoffsData = await signoffsRes.json();
    setPoints(pointsData.reviewPoints || []);
    setSignoffs(signoffsData.signoffs || []);
  }

  async function addReviewPoint() {
    if (!title.trim()) {
      setMessage("Review point title is required.");
      return;
    }
    const res = await fetch(`/api/afs/engagements/${engagementId}/review-points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, detail, priority, sourceArea: "afs" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not add review point.");
      return;
    }
    setPoints((current) => [data.reviewPoint, ...current]);
    setTitle("");
    setDetail("");
    setPriority("normal");
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.headerRow}>
        <div>
          <p style={styles.kicker}>AFS REVIEW</p>
          <h2 style={styles.title}>Review and sign-off</h2>
          <p style={styles.subtitle}>Track review notes, unresolved issues, and final area sign-offs.</p>
        </div>
        <button type="button" style={styles.secondaryButton} onClick={loadAll}>Refresh</button>
      </div>

      {message ? <div style={styles.message}>{message}</div> : null}

      <div style={styles.gridTwo}>
        <section style={styles.panel}>
          <div style={styles.panelHeader}>Raise review point</div>
          <div style={styles.formGrid}>
            <label style={styles.label}>Title</label>
            <input style={styles.input} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Confirm shareholder loan classification" />
            <label style={styles.label}>Priority</label>
            <select style={styles.input} value={priority} onChange={(event) => setPriority(event.target.value as any)}>
              <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
            </select>
            <label style={styles.label}>Detail</label>
            <textarea style={styles.textarea} value={detail} onChange={(event) => setDetail(event.target.value)} />
          </div>
          <div style={styles.buttonRow}><button type="button" style={styles.primaryButton} onClick={addReviewPoint}>Add review point</button></div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>Review points</div>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Priority</th><th style={styles.th}>Title</th><th style={styles.th}>Status</th></tr></thead>
            <tbody>{points.length === 0 ? <tr><td colSpan={3} style={styles.emptyCell}>No review points.</td></tr> : points.map((point) => (
              <tr key={point.id}><td style={styles.tdCode}>{point.priority}</td><td style={styles.td}>{point.title}</td><td style={styles.td}>{point.status}</td></tr>
            ))}</tbody>
          </table>
        </section>
      </div>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>Area sign-offs</div>
        <table style={styles.table}>
          <thead><tr><th style={styles.th}>Area</th><th style={styles.th}>Status</th><th style={styles.th}>Prepared</th><th style={styles.th}>Reviewed</th></tr></thead>
          <tbody>{signoffs.length === 0 ? <tr><td colSpan={4} style={styles.emptyCell}>No sign-offs yet.</td></tr> : signoffs.map((item) => (
            <tr key={item.id}><td style={styles.tdCode}>{item.area_title}</td><td style={styles.td}>{item.status}</td><td style={styles.td}>{item.prepared_by || "-"}</td><td style={styles.td}>{item.reviewed_by || "-"}</td></tr>
          ))}</tbody>
        </table>
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: "grid",
    gap: "8px",
    fontSize: "12px",
    color: "#0f172a",
  },

  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    border: "1px solid #cbd5e1",
    borderRadius: "0px",
    background: "#ffffff",
    padding: "10px",
  },

  kicker: {
    margin: 0,
    color: "#2563eb",
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "0.1em",
  },

  title: {
    margin: "2px 0",
    fontSize: "16px",
    lineHeight: 1.1,
  },

  subtitle: {
    margin: 0,
    color: "#334155",
    fontSize: "11.5px",
  },

  gridTwo: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 1.2fr)",
    gap: "8px",
  },

  panel: {
    border: "1px solid #cbd5e1",
    borderRadius: "0px",
    background: "#ffffff",
    overflow: "hidden",
  },

  panelHeader: {
    padding: "8px 10px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
    fontWeight: 900,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "90px minmax(0, 1fr)",
    gap: "7px",
    padding: "10px",
  },

  label: {
    fontSize: "11px",
    color: "#334155",
    fontWeight: 800,
    alignSelf: "center",
  },

  input: {
    border: "1px solid #cbd5e1",
    borderRadius: "0px",
    padding: "6px 8px",
    fontSize: "12px",
  },

  textarea: {
    border: "1px solid #cbd5e1",
    borderRadius: "0px",
    padding: "6px 8px",
    fontSize: "12px",
    minHeight: "70px",
    resize: "vertical",
  },

  buttonRow: {
    display: "flex",
    justifyContent: "flex-end",
    padding: "0 10px 10px",
  },

  primaryButton: {
    border: "1px solid #0f172a",
    borderRadius: "0px",
    background: "#0f172a",
    color: "#ffffff",
    padding: "7px 10px",
    fontSize: "11.5px",
    fontWeight: 900,
    cursor: "pointer",
  },

  secondaryButton: {
    border: "1px solid #94a3b8",
    borderRadius: "0px",
    background: "#ffffff",
    color: "#0f172a",
    padding: "7px 10px",
    fontSize: "11.5px",
    fontWeight: 850,
    cursor: "pointer",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
    fontSize: "11.5px",
  },

  th: {
    textAlign: "left",
    padding: "7px 9px",
    borderBottom: "1px solid #e2e8f0",
    color: "#334155",
  },

  td: {
    padding: "7px 9px",
    borderBottom: "1px solid #edf2f7",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  tdCode: {
    padding: "7px 9px",
    borderBottom: "1px solid #edf2f7",
    fontWeight: 900,
  },

  emptyCell: {
    padding: "10px",
    color: "#64748b",
  },

  message: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: "0px",
    padding: "8px 10px",
    fontWeight: 800,
  },
};
