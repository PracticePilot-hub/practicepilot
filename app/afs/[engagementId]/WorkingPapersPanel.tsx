"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams } from "next/navigation";

type WorkingPaper = {
  id: string;
  lead_schedule_key: string | null;
  lead_schedule_number: string | null;
  title: string;
  wp_reference: string | null;
  status: "open" | "prepared" | "reviewed" | "archived";
  prepared_by: string | null;
  prepared_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  file_url: string | null;
  file_name: string | null;
  note: string | null;
};

type Props = {
  activeLeadSchedule?: string | null;
  activeLeadScheduleNumber?: string | null;
};

export default function WorkingPapersPanel({ activeLeadSchedule = null, activeLeadScheduleNumber = null }: Props) {
  const params = useParams();
  const engagementId = String(params?.engagementId || "");
  const [papers, setPapers] = useState<WorkingPaper[]>([]);
  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!engagementId) return;
    loadPapers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId, activeLeadSchedule]);

  async function loadPapers() {
    setLoading(true);
    setMessage("");
    try {
      const query = activeLeadSchedule ? `?leadScheduleKey=${encodeURIComponent(activeLeadSchedule)}` : "";
      const res = await fetch(`/api/afs/engagements/${engagementId}/working-papers${query}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load working papers.");
      setPapers(data.workingPapers || []);
    } catch (error: any) {
      setMessage(error?.message || "Failed to load working papers.");
    } finally {
      setLoading(false);
    }
  }

  async function createPaper() {
    if (!title.trim()) {
      setMessage("Working paper title is required.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/afs/engagements/${engagementId}/working-papers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadScheduleKey: activeLeadSchedule,
          leadScheduleNumber: activeLeadScheduleNumber,
          title,
          wpReference: reference,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create working paper.");
      setTitle("");
      setReference("");
      setNote("");
      setPapers((current) => [data.workingPaper, ...current]);
      setMessage("Working paper added.");
    } catch (error: any) {
      setMessage(error?.message || "Failed to create working paper.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.headerRow}>
        <div>
          <p style={styles.kicker}>WORKING PAPERS</p>
          <h2 style={styles.title}>{activeLeadScheduleNumber ? `${activeLeadScheduleNumber} linked papers` : "Working paper index"}</h2>
          <p style={styles.subtitle}>Attach supporting papers to the AFS or a lead schedule.</p>
        </div>
        <button type="button" style={styles.secondaryButton} onClick={loadPapers}>Refresh</button>
      </div>

      {message ? <div style={styles.message}>{message}</div> : null}

      <div style={styles.gridTwo}>
        <section style={styles.panel}>
          <div style={styles.panelHeader}>Add working paper</div>
          <div style={styles.formGrid}>
            <label style={styles.label}>Reference</label>
            <input style={styles.input} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="WP1, B1, TAX1..." />
            <label style={styles.label}>Title</label>
            <input style={styles.input} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Bank statement, inventory listing..." />
            <label style={styles.label}>Note</label>
            <textarea style={styles.textarea} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" />
          </div>
          <div style={styles.buttonRow}>
            <button type="button" style={styles.primaryButton} onClick={createPaper} disabled={loading}>Add paper</button>
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>Working papers</div>
          <table style={styles.table}>
            <thead>
              <tr><th style={styles.th}>Ref</th><th style={styles.th}>Title</th><th style={styles.th}>Lead</th><th style={styles.th}>Status</th></tr>
            </thead>
            <tbody>
              {papers.length === 0 ? <tr><td colSpan={4} style={styles.emptyCell}>{loading ? "Loading..." : "No working papers yet."}</td></tr> : papers.map((paper) => (
                <tr key={paper.id}>
                  <td style={styles.tdCode}>{paper.wp_reference || "-"}</td>
                  <td style={styles.td}>{paper.title}</td>
                  <td style={styles.td}>{paper.lead_schedule_number || "AFS"}</td>
                  <td style={styles.td}>{paper.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: { display: "grid", gap: "8px", fontSize: "12px", color: "#0f172a" },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #dbe3ef", borderRadius: "8px", background: "#ffffff", padding: "10px" },
  kicker: { margin: 0, color: "#2563eb", fontSize: "10px", fontWeight: 900, letterSpacing: "0.1em" },
  title: { margin: "2px 0", fontSize: "16px", lineHeight: 1.1 },
  subtitle: { margin: 0, color: "#334155", fontSize: "11.5px" },
  gridTwo: { display: "grid", gridTemplateColumns: "minmax(0, 0.75fr) minmax(0, 1.25fr)", gap: "8px" },
  panel: { border: "1px solid #dbe3ef", borderRadius: "8px", background: "#ffffff", overflow: "hidden" },
  panelHeader: { padding: "8px 10px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", fontWeight: 900 },
  formGrid: { display: "grid", gridTemplateColumns: "90px minmax(0, 1fr)", gap: "7px", padding: "10px" },
  label: { fontSize: "11px", color: "#334155", fontWeight: 800, alignSelf: "center" },
  input: { border: "1px solid #cbd5e1", borderRadius: "6px", padding: "6px 8px", fontSize: "12px" },
  textarea: { border: "1px solid #cbd5e1", borderRadius: "6px", padding: "6px 8px", fontSize: "12px", minHeight: "70px", resize: "vertical" },
  buttonRow: { display: "flex", justifyContent: "flex-end", padding: "0 10px 10px" },
  primaryButton: { border: "0", borderRadius: "7px", background: "#2563eb", color: "#fff", padding: "7px 10px", fontSize: "11.5px", fontWeight: 900, cursor: "pointer" },
  secondaryButton: { border: "1px solid #cbd5e1", borderRadius: "7px", background: "#fff", color: "#0f172a", padding: "7px 10px", fontSize: "11.5px", fontWeight: 850, cursor: "pointer" },
  table: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: "11.5px" },
  th: { textAlign: "left", padding: "7px 9px", borderBottom: "1px solid #e2e8f0", color: "#334155" },
  td: { padding: "7px 9px", borderBottom: "1px solid #edf2f7", overflow: "hidden", textOverflow: "ellipsis" },
  tdCode: { padding: "7px 9px", borderBottom: "1px solid #edf2f7", fontWeight: 900 },
  emptyCell: { padding: "10px", color: "#64748b" },
  message: { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: "8px", padding: "8px 10px", fontWeight: 800 },
};
