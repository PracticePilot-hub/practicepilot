"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";

type Props = {
  engagementId: string;
  sectionKey: string;
  sectionTitle: string;
  engagementStatus?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export default function AfsSectionSignoffBar({
  engagementId,
  sectionKey,
  sectionTitle,
  engagementStatus = "Draft",
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workflow, setWorkflow] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [signoff, setSignoff] = useState<any>(null);
  const [message, setMessage] = useState("");

  async function authHeaders(): Promise<Record<string, string>> {
    if (!supabase) return {};
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function load(silent = false) {
    try {
      if (!silent) setLoading(true);
      const response = await fetch(
        `/api/afs/engagements/${engagementId}/section-signoffs`,
        {
          cache: "no-store",
          headers: await authHeaders(),
        },
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load sign-offs.");

      setWorkflow(data.workflow || null);
      setCurrentUserId(data.currentUserId || "");
      setNames(data.names || {});
      setSignoff(
        (data.signoffs || []).find(
          (item: any) => item.section_key === sectionKey,
        ) || null,
      );
    } catch (error: any) {
      setMessage(error?.message || "Could not load sign-offs.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [engagementId, sectionKey]);

  useEffect(() => {
    function handleSignoffRefresh(event: Event) {
      const detail = (event as CustomEvent<{
        engagementId?: string;
        sectionKey?: string;
      }>).detail;

      if (!detail) return;
      if (detail.engagementId && detail.engagementId !== engagementId) return;
      if (detail.sectionKey && detail.sectionKey !== sectionKey) return;

      void load(true);
    }

    window.addEventListener("afs-signoff-refresh", handleSignoffRefresh);

    return () => {
      window.removeEventListener("afs-signoff-refresh", handleSignoffRefresh);
    };
  }, [engagementId, sectionKey]);

  useEffect(() => {
    if (sectionKey !== "financial-statements") return;

    const refreshKey = `afs-signoff-refresh:${engagementId}:financial-statements`;

    function handleFinancialStatementsStorage(event: StorageEvent) {
      if (event.key !== refreshKey) return;
      void load(true);
    }

    window.addEventListener("storage", handleFinancialStatementsStorage);

    return () => {
      window.removeEventListener("storage", handleFinancialStatementsStorage);
    };
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

  const isLocked = ["final", "archived"].includes(
    String(engagementStatus || "").trim().toLowerCase(),
  );

  const prepared = Boolean(signoff?.prepared_at);
  const reviewed = Boolean(signoff?.reviewed_at);
  const captainCleared = Boolean(signoff?.captain_cleared_at);

  const complete =
    levels === 1
      ? captainCleared
      : levels === 2
        ? reviewed && captainCleared
        : reviewed && captainCleared;

  async function act(action: "prepare" | "review" | "captain-clear" | "reopen") {
    if (saving || isLocked) return;

    try {
      setSaving(true);
      setMessage("");

      const response = await fetch(
        `/api/afs/engagements/${engagementId}/section-signoffs`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(await authHeaders()),
          },
          body: JSON.stringify({
            action,
            sectionKey,
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update sign-off.");

      setSignoff(data.signoff);
    } catch (error: any) {
      setMessage(error?.message || "Could not update sign-off.");
    } finally {
      setSaving(false);
    }
  }

  const preparedName = signoff?.prepared_by ? names[signoff.prepared_by] : "";
  const reviewedName = signoff?.reviewed_by ? names[signoff.reviewed_by] : "";
  const captainName = signoff?.captain_cleared_by
    ? names[signoff.captain_cleared_by]
    : "";

  if (loading) return null;
  if (!workflow?.is_started) return null;

  return (
    <div style={{ ...styles.bar, ...(complete ? styles.barComplete : {}) }}>
      <div style={styles.left}>
        <span style={styles.sectionLabel}>Section sign-off</span>
        <strong style={styles.title}>{sectionTitle}</strong>
      </div>

      <div style={styles.steps}>
        <div style={styles.step}>
          <span style={styles.stepLabel}>Pilot</span>
          <span style={prepared ? styles.done : styles.pending}>
            {prepared ? `✓ ${preparedName || "Prepared"}` : "Pending"}
          </span>
        </div>

        {levels >= 2 ? (
          <div style={styles.step}>
            <span style={styles.stepLabel}>
              {levels === 2 ? "Captain review" : "First Officer"}
            </span>
            <span style={reviewed ? styles.done : styles.pending}>
              {reviewed ? `✓ ${reviewedName || "Reviewed"}` : "Pending"}
            </span>
          </div>
        ) : null}

        {levels === 3 ? (
          <div style={styles.step}>
            <span style={styles.stepLabel}>Captain</span>
            <span style={captainCleared ? styles.done : styles.pending}>
              {captainCleared ? `✓ ${captainName || "Cleared"}` : "Pending"}
            </span>
          </div>
        ) : null}
      </div>

      <div style={styles.actions}>
        {message ? <span style={styles.message}>{message}</span> : null}

        {!isLocked && !prepared && (isPilot || isCaptain) ? (
          <button
            type="button"
            style={styles.primaryButton}
            disabled={saving}
            onClick={() => act("prepare")}
          >
            {levels === 1 ? "Complete Section" : "Pilot Sign-off"}
          </button>
        ) : null}

        {!isLocked &&
        prepared &&
        !reviewed &&
        levels === 2 &&
        isCaptain ? (
          <button
            type="button"
            style={styles.primaryButton}
            disabled={saving}
            onClick={() => act("review")}
          >
            Captain Review
          </button>
        ) : null}

        {!isLocked &&
        prepared &&
        !reviewed &&
        levels === 3 &&
        (isFirstOfficer || isCaptain) ? (
          <button
            type="button"
            style={styles.primaryButton}
            disabled={saving}
            onClick={() => act("review")}
          >
            First Officer Sign-off
          </button>
        ) : null}

        {!isLocked &&
        reviewed &&
        !captainCleared &&
        levels === 3 &&
        isCaptain ? (
          <button
            type="button"
            style={styles.primaryButton}
            disabled={saving}
            onClick={() => act("captain-clear")}
          >
            Captain Clear
          </button>
        ) : null}

        {!isLocked &&
        prepared &&
        (reviewed || captainCleared) &&
        (isFirstOfficer || isCaptain) ? (
          <button
            type="button"
            style={styles.secondaryButton}
            disabled={saving}
            onClick={() => act("reopen")}
          >
            Reopen Section
          </button>
        ) : null}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  bar: {
    background: "#ffffff",
    borderTop: "1px solid #cbd5e1",
    borderBottom: "1px solid #cbd5e1",
    padding: "7px 10px",
    marginBottom: 8,
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  barComplete: {
    background: "#f8fafc",
  },
  left: {
    minWidth: 150,
    display: "grid",
    gap: 2,
  },
  sectionLabel: {
    color: "#2563eb",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0",
  },
  title: {
    fontSize: 10.5,
    color: "#0f172a",
  },
  steps: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    minWidth: 0,
  },
  step: {
    display: "grid",
    gap: 2,
    minWidth: 110,
  },
  stepLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0",
  },
  done: {
    color: "#166534",
    fontSize: 10,
    fontWeight: 850,
  },
  pending: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: 750,
  },
  actions: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  primaryButton: {
    background: "#2563eb",
    color: "#ffffff",
    border: "1px solid #1d4ed8",
    padding: "5px 8px",
    fontSize: 9.5,
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryButton: {
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    padding: "5px 8px",
    fontSize: 9.5,
    fontWeight: 850,
    cursor: "pointer",
  },
  message: {
    color: "#b45309",
    fontSize: 9.5,
    fontWeight: 750,
  },
};
