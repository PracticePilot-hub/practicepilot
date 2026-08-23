"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export default function AfsWorkflowDefaultsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [defaultLevels, setDefaultLevels] = useState(2);
  const [allowSolo, setAllowSolo] = useState(true);
  const [allowThreeLevel, setAllowThreeLevel] = useState(true);
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
      setMessage("");

      const response = await fetch("/api/afs/settings/workflow-defaults", {
        cache: "no-store",
        headers: await authHeaders(),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not load workflow defaults.");
      }

      setCanManage(Boolean(data.canManage));
      setDefaultLevels(Number(data.organisation?.afs_default_workflow_levels || 2));
      setAllowSolo(Boolean(data.organisation?.afs_allow_solo));
      setAllowThreeLevel(Boolean(data.organisation?.afs_allow_three_level));
    } catch (error: any) {
      setMessage(error?.message || "Could not load workflow defaults.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    try {
      setSaving(true);
      setMessage("");

      const response = await fetch("/api/afs/settings/workflow-defaults", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          defaultWorkflowLevels: defaultLevels,
          allowSolo,
          allowThreeLevel,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not save workflow defaults.");
      }

      setMessage("Saved.");
    } catch (error: any) {
      setMessage(error?.message || "Could not save workflow defaults.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <section style={styles.shell}>Loading workflow settings...</section>;
  }

  return (
    <section style={styles.shell}>
      <div style={styles.headingRow}>
        <div>
          <h3 style={styles.title}>Workflow structure</h3>
          <p style={styles.help}>
            Choose the normal structure for new AFS files. It can still be changed per file.
          </p>
        </div>

        {canManage ? (
          <button
            type="button"
            style={styles.saveButton}
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        ) : null}
      </div>

      <div style={styles.structureRow}>
        <button
          type="button"
          disabled={!canManage || !allowSolo}
          onClick={() => setDefaultLevels(1)}
          style={{
            ...styles.structureButton,
            ...(defaultLevels === 1 ? styles.structureButtonActive : {}),
            ...(!allowSolo ? styles.structureButtonDisabled : {}),
          }}
        >
          <span style={styles.structureTitle}>Solo</span>
          <span style={styles.structureFlow}>Captain only</span>
        </button>

        <button
          type="button"
          disabled={!canManage}
          onClick={() => setDefaultLevels(2)}
          style={{
            ...styles.structureButton,
            ...(defaultLevels === 2 ? styles.structureButtonActive : {}),
          }}
        >
          <span style={styles.structureTitle}>2 levels</span>
          <span style={styles.structureFlow}>Pilot → Captain</span>
        </button>

        <button
          type="button"
          disabled={!canManage || !allowThreeLevel}
          onClick={() => setDefaultLevels(3)}
          style={{
            ...styles.structureButton,
            ...(defaultLevels === 3 ? styles.structureButtonActive : {}),
            ...(!allowThreeLevel ? styles.structureButtonDisabled : {}),
          }}
        >
          <span style={styles.structureTitle}>3 levels</span>
          <span style={styles.structureFlow}>Pilot → First Officer → Captain</span>
        </button>
      </div>

      <div style={styles.optionsRow}>
        <label style={styles.checkLabel}>
          <input
            type="checkbox"
            checked={allowSolo}
            disabled={!canManage}
            onChange={(event) => {
              const checked = event.target.checked;
              setAllowSolo(checked);
              if (!checked && defaultLevels === 1) setDefaultLevels(2);
            }}
          />
          Allow Solo files
        </label>

        <label style={styles.checkLabel}>
          <input
            type="checkbox"
            checked={allowThreeLevel}
            disabled={!canManage}
            onChange={(event) => {
              const checked = event.target.checked;
              setAllowThreeLevel(checked);
              if (!checked && defaultLevels === 3) setDefaultLevels(2);
            }}
          />
          Allow 3-level files
        </label>

        <span style={styles.ruleText}>
          Solo is only available to a Captain.
        </span>
      </div>

      {message ? <div style={styles.message}>{message}</div> : null}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    background: "#ffffff",
    border: "1px solid #cfd8e6",
    padding: "12px 14px",
    display: "grid",
    gap: 10,
  },
  headingRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  },
  title: {
    margin: 0,
    fontSize: 15,
    fontWeight: 900,
    color: "#0f172a",
  },
  help: {
    margin: "4px 0 0",
    fontSize: 10.5,
    color: "#64748b",
  },
  saveButton: {
    border: "1px solid #1d4ed8",
    background: "#2563eb",
    color: "#ffffff",
    padding: "6px 12px",
    fontSize: 10,
    fontWeight: 900,
    cursor: "pointer",
  },
  structureRow: {
    display: "grid",
    gridTemplateColumns: "180px 220px minmax(280px, 1fr)",
    gap: 8,
    alignItems: "stretch",
  },
  structureButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    padding: "9px 12px",
    textAlign: "left",
    cursor: "pointer",
    display: "grid",
    gap: 3,
    minHeight: 52,
  },
  structureButtonActive: {
    border: "1px solid #2563eb",
    background: "#eff6ff",
    boxShadow: "inset 3px 0 0 #2563eb",
    color: "#1d4ed8",
  },
  structureButtonDisabled: {
    opacity: 0.45,
  },
  structureTitle: {
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  structureFlow: {
    fontSize: 10,
    color: "#64748b",
    whiteSpace: "nowrap",
  },
  optionsRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px 18px",
    paddingTop: 2,
  },
  checkLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 10.5,
    fontWeight: 800,
    color: "#334155",
  },
  ruleText: {
    fontSize: 10,
    color: "#64748b",
  },
  message: {
    borderTop: "1px solid #e2e8f0",
    paddingTop: 7,
    color: "#475569",
    fontSize: 10,
    fontWeight: 750,
  },
};
