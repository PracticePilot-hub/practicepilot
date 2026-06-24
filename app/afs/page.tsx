"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";



type AFSEngagement = {
  id: string;
  client_name: string;
  entity_type: string | null;
  financial_year_end: string;
  status: string;
  prepared_by: string | null;
  reviewed_by: string | null;
  notes: string | null;
  created_at: string;
};

export default function AFSPage() {
  const router = useRouter();

  const [engagements, setEngagements] = useState<AFSEngagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [clientName, setClientName] = useState("");
  const [entityType, setEntityType] = useState("Company");
  const [financialYearEnd, setFinancialYearEnd] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");
  const [notes, setNotes] = useState("");

  async function loadEngagements() {
    setLoading(true);

    try {
      const res = await fetch("/api/afs/engagements", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load AFS engagements.");
      }

      setEngagements(data.engagements || []);
    } catch (error: any) {
      alert(error.message || "Failed to load AFS engagements.");
    } finally {
      setLoading(false);
    }
  }

  async function createEngagement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!clientName.trim()) {
      alert("Client name is required.");
      return;
    }

    if (!financialYearEnd) {
      alert("Financial year end is required.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/afs/engagements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientName,
          entityType,
          financialYearEnd,
          preparedBy,
          reviewedBy,
          notes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create AFS engagement.");
      }

      setClientName("");
      setEntityType("Company");
      setFinancialYearEnd("");
      setPreparedBy("");
      setReviewedBy("");
      setNotes("");

      router.push(`/afs/${data.engagement.id}`);
    } catch (error: any) {
      alert(error.message || "Failed to create AFS engagement.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadEngagements();
  }, []);

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <p style={styles.kicker}>PracticePilot</p>
          <h1 style={styles.title}>Annual Financial Statements</h1>
          <p style={styles.subtitle}>
            Create and manage AFS engagements, trial balances, notes and review
            work.
          </p>
        </div>
      </section>

      <section style={styles.grid}>
        <form onSubmit={createEngagement} style={styles.card}>
          <h2 style={styles.cardTitle}>New AFS engagement</h2>

          <label style={styles.label}>
            Client name
            <input
              style={styles.input}
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Example: ABC Trading (Pty) Ltd"
            />
          </label>

          <label style={styles.label}>
            Entity type
            <select
              style={styles.input}
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            >
              <option value="Company">Company</option>
              <option value="Close Corporation">Close Corporation</option>
              <option value="Trust">Trust</option>
              <option value="Sole Proprietor">Sole Proprietor</option>
              <option value="Partnership">Partnership</option>
              <option value="Non-Profit Company">Non-Profit Company</option>
            </select>
          </label>

          <label style={styles.label}>
            Financial year end
            <input
              style={styles.input}
              type="date"
              value={financialYearEnd}
              onChange={(e) => setFinancialYearEnd(e.target.value)}
            />
          </label>

          <label style={styles.label}>
            Prepared by
            <input
              style={styles.input}
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              placeholder="Optional"
            />
          </label>

          <label style={styles.label}>
            Reviewed by
            <input
              style={styles.input}
              value={reviewedBy}
              onChange={(e) => setReviewedBy(e.target.value)}
              placeholder="Optional"
            />
          </label>

          <label style={styles.label}>
            Notes
            <textarea
              style={{ ...styles.input, minHeight: 90, resize: "vertical" }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional internal notes"
            />
          </label>

          <button type="submit" style={styles.primaryButton} disabled={saving}>
            {saving ? "Creating..." : "Create engagement"}
          </button>
        </form>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Existing engagements</h2>

          {loading ? (
            <p style={styles.emptyText}>Loading engagements...</p>
          ) : engagements.length === 0 ? (
            <p style={styles.emptyText}>No AFS engagements created yet.</p>
          ) : (
            <div style={styles.list}>
              {engagements.map((engagement) => (
                <button
                  key={engagement.id}
                  type="button"
                  style={styles.listItem}
                  onClick={() => router.push(`/afs/${engagement.id}`)}
                >
                  <div>
                    <strong style={styles.clientName}>
                      {engagement.client_name}
                    </strong>
                    <p style={styles.meta}>
                      {engagement.entity_type || "Entity"} · Year end{" "}
                      {engagement.financial_year_end}
                    </p>
                  </div>

                  <span style={styles.status}>{engagement.status}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "28px",
    color: "#111827",
  },
  header: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "24px",
    marginBottom: "20px",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
  },
  kicker: {
    margin: "0 0 6px",
    fontSize: "13px",
    fontWeight: 700,
    color: "#2563eb",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  title: {
    margin: 0,
    fontSize: "30px",
    lineHeight: 1.2,
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#6b7280",
    fontSize: "15px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "420px 1fr",
    gap: "20px",
    alignItems: "start",
  },
  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "20px",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
  },
  cardTitle: {
    margin: "0 0 16px",
    fontSize: "20px",
  },
  label: {
    display: "block",
    marginBottom: "12px",
    fontSize: "13px",
    fontWeight: 700,
    color: "#374151",
  },
  input: {
    width: "100%",
    marginTop: "6px",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "11px 12px",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
    background: "white",
    color: "#111827",
  },
  primaryButton: {
    width: "100%",
    border: "none",
    borderRadius: "12px",
    padding: "12px 14px",
    background: "#2563eb",
    color: "white",
    fontWeight: 800,
    fontSize: "14px",
    cursor: "pointer",
  },
  emptyText: {
    color: "#6b7280",
    fontSize: "14px",
  },
  list: {
    display: "grid",
    gap: "10px",
  },
  listItem: {
    width: "100%",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "14px",
    background: "#ffffff",
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  clientName: {
    display: "block",
    fontSize: "15px",
    color: "#111827",
  },
  meta: {
    margin: "5px 0 0",
    color: "#6b7280",
    fontSize: "13px",
  },
  status: {
    borderRadius: "999px",
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
};