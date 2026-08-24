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
  const [practiceName, setPracticeName] = useState("");
  const [defaultLevels, setDefaultLevels] = useState(2);
  const [allowSolo, setAllowSolo] = useState(true);
  const [allowThreeLevel, setAllowThreeLevel] = useState(true);
  const [message, setMessage] = useState("");

  async function headers(): Promise<Record<string, string>> {
    if (!supabase) return {};
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function load() {
    try {
      setLoading(true);

      const response = await fetch("/api/afs/settings/workflow-defaults", {
        cache: "no-store",
        headers: await headers(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load workflow defaults.");
      }

      setCanManage(Boolean(data.canManage));
      setPracticeName(data.organisation?.name || "");
      setDefaultLevels(
        Number(data.organisation?.afs_default_workflow_levels || 2),
      );
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
          ...(await headers()),
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

      setMessage("Workflow structure saved.");
    } catch (error: any) {
      setMessage(error?.message || "Could not save workflow defaults.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={styles.loading}>Loading workflow structure...</div>;
  }

  return (
    <section style={styles.block}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Workflow structure</h2>
          <p style={styles.text}>
            Choose the normal review journey for new AFS files at{" "}
            {practiceName || "your practice"}. It can still be changed on an
            individual file.
          </p>
        </div>

        <div style={styles.currentFlow}>
          {defaultLevels === 1 ? (
            <>
              <span style={styles.flowStrong}>Captain</span>
              <span style={styles.flowNote}>Solo</span>
            </>
          ) : defaultLevels === 2 ? (
            <>
              <span style={styles.flowStep}>Pilot</span>
              <span style={styles.arrow}>→</span>
              <span style={styles.flowStrong}>Captain</span>
            </>
          ) : (
            <>
              <span style={styles.flowStep}>Pilot</span>
              <span style={styles.arrow}>→</span>
              <span style={styles.flowStep}>First Officer</span>
              <span style={styles.arrow}>→</span>
              <span style={styles.flowStrong}>Captain</span>
            </>
          )}
        </div>
      </div>

      <div style={styles.journeyGrid}>
        <button
          type="button"
          disabled={!canManage || !allowSolo}
          onClick={() => setDefaultLevels(1)}
          style={{
            ...styles.journey,
            ...(defaultLevels === 1 ? styles.journeyActive : {}),
            ...(!allowSolo ? styles.journeyDisabled : {}),
          }}
        >
          <span style={styles.journeyTitle}>Solo</span>
          <span style={styles.journeyDescription}>
            Captain prepares, reviews and signs off.
          </span>
          <span style={styles.journeyFlow}>Captain</span>
        </button>

        <button
          type="button"
          disabled={!canManage}
          onClick={() => setDefaultLevels(2)}
          style={{
            ...styles.journey,
            ...(defaultLevels === 2 ? styles.journeyActive : {}),
          }}
        >
          <span style={styles.journeyTitle}>2 levels</span>
          <span style={styles.journeyDescription}>
            The normal Pilot-to-Captain workflow.
          </span>
          <span style={styles.journeyFlow}>Pilot → Captain</span>
        </button>

        <button
          type="button"
          disabled={!canManage || !allowThreeLevel}
          onClick={() => setDefaultLevels(3)}
          style={{
            ...styles.journey,
            ...(defaultLevels === 3 ? styles.journeyActive : {}),
            ...(!allowThreeLevel ? styles.journeyDisabled : {}),
          }}
        >
          <span style={styles.journeyTitle}>3 levels</span>
          <span style={styles.journeyDescription}>
            Adds a formal First Officer review layer.
          </span>
          <span style={styles.journeyFlow}>
            Pilot → First Officer → Captain
          </span>
        </button>
      </div>

      <div style={styles.footer}>
        <div style={styles.permissions}>
          <label style={styles.permission}>
            <input
              type="checkbox"
              checked={allowSolo}
              disabled={!canManage}
              onChange={(event) => {
                setAllowSolo(event.target.checked);

                if (!event.target.checked && defaultLevels === 1) {
                  setDefaultLevels(2);
                }
              }}
            />
            <span>
              <strong style={styles.permissionTitle}>Allow Solo files</strong>
              <small style={styles.permissionHelp}>
                Captain can run a file without a separate Pilot.
              </small>
            </span>
          </label>

          <label style={styles.permission}>
            <input
              type="checkbox"
              checked={allowThreeLevel}
              disabled={!canManage}
              onChange={(event) => {
                setAllowThreeLevel(event.target.checked);

                if (!event.target.checked && defaultLevels === 3) {
                  setDefaultLevels(2);
                }
              }}
            />
            <span>
              <strong style={styles.permissionTitle}>
                Allow 3-level files
              </strong>
              <small style={styles.permissionHelp}>
                Pilot → First Officer → Captain.
              </small>
            </span>
          </label>
        </div>

        {canManage ? (
          <button
            type="button"
            style={styles.saveButton}
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save workflow"}
          </button>
        ) : null}
      </div>

      {message ? <div style={styles.message}>{message}</div> : null}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  loading: {
    padding: "14px 16px",
    background: "#ffffff",
    border: "1px solid #d7dee8",
    color: "#475569",
    fontSize: 12,
  },
  block: {
    background: "#ffffff",
    border: "1px solid #c9d8ee",
    borderLeft: "4px solid #2563eb",
    boxShadow: "0 10px 26px rgba(37, 99, 235, 0.06)",
    marginBottom: 20,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    padding: "18px 20px",
    borderBottom: "1px solid #cfe0f7",
    background:
      "linear-gradient(90deg, #edf5ff 0%, #f7fbff 58%, #ffffff 100%)",
  },
  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: 20,
    lineHeight: 1.15,
    fontWeight: 850,
    letterSpacing: "-0.02em",
  },
  text: {
    margin: "6px 0 0",
    maxWidth: 760,
    color: "#64748b",
    fontSize: 11.5,
    lineHeight: 1.45,
  },
  currentFlow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minHeight: 34,
    padding: "7px 11px",
    border: "1px solid #bfd3ef",
    background: "#ffffff",
    boxShadow: "0 3px 10px rgba(37, 99, 235, 0.05)",
    whiteSpace: "nowrap",
  },
  flowStep: {
    color: "#475569",
    fontSize: 10.5,
    fontWeight: 750,
  },
  flowStrong: {
    color: "#1d4ed8",
    fontSize: 10.5,
    fontWeight: 900,
  },
  flowNote: {
    color: "#94a3b8",
    fontSize: 9.5,
    fontWeight: 750,
  },
  arrow: {
    color: "#94a3b8",
    fontSize: 12,
  },
  journeyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 0,
    borderBottom: "1px solid #d7dee8",
  },
  journey: {
    minHeight: 112,
    padding: "16px 18px",
    display: "grid",
    alignContent: "start",
    gap: 7,
    textAlign: "left",
    border: 0,
    borderRight: "1px solid #e4e9ef",
    background: "#ffffff",
    cursor: "pointer",
  },
  journeyActive: {
    background:
      "linear-gradient(180deg, #e6f0ff 0%, #dbeafe 100%)",
    boxShadow: "inset 0 -4px 0 #2563eb",
  },
  journeyDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  journeyTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 900,
  },
  journeyDescription: {
    color: "#64748b",
    fontSize: 10.5,
    lineHeight: 1.4,
  },
  journeyFlow: {
    marginTop: 5,
    color: "#1d4ed8",
    fontSize: 10,
    fontWeight: 900,
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    padding: "13px 20px",
    background: "#f4f8ff",
  },
  permissions: {
    display: "flex",
    gap: 26,
    flexWrap: "wrap",
  },
  permission: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    color: "#334155",
    cursor: "pointer",
  },
  permissionTitle: {
    display: "block",
    fontSize: 10.5,
    fontWeight: 850,
  },
  permissionHelp: {
    display: "block",
    marginTop: 2,
    color: "#94a3b8",
    fontSize: 9,
    lineHeight: 1.3,
  },
  saveButton: {
    border: "1px solid #1d4ed8",
    background: "linear-gradient(180deg, #2f73f6 0%, #2563eb 100%)",
    color: "#ffffff",
    padding: "8px 14px",
    fontSize: 10.5,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 4px 10px rgba(37, 99, 235, 0.18)",
  },
  message: {
    padding: "9px 12px",
    borderTop: "1px solid #d7dee8",
    background: "#eef6ff",
    color: "#1e3a5f",
    fontSize: 10,
    fontWeight: 700,
  },
};
