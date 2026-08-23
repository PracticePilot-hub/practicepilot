"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";

type Props = {
  engagementId: string;
  engagementStatus?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

function displayName(user: any) {
  return user?.full_name?.trim() || user?.email || "Unknown";
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function AfsCrewStrip({
  engagementId,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [workflow, setWorkflow] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);

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
        `/api/afs/engagement/${engagementId}/opening`,
        {
          cache: "no-store",
          headers: await authHeaders(),
        },
      );

      const data = await readJson(response);

      if (!response.ok || !data) {
        setWorkflow(null);
        return;
      }

      setWorkflow(data.workflow || null);
      setUsers(data.users || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [engagementId]);

  const byId = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  );

  function names(ids: unknown) {
    if (!Array.isArray(ids) || ids.length === 0) return "Unassigned";

    return ids
      .map((id) => displayName(byId.get(String(id))))
      .join(", ");
  }

  if (loading) return null;
  if (!workflow?.is_started) return null;

  const levels = Number(workflow.workflow_levels || 2);

  if (levels === 1) {
    return (
      <div style={styles.strip}>
        <span style={styles.label}>SOLO</span>
        <strong>{names(workflow.captain_user_ids)}</strong>
      </div>
    );
  }

  return (
    <div style={styles.strip}>
      <span style={styles.role}>Pilot</span>
      <strong style={styles.name}>{names(workflow.pilot_user_ids)}</strong>

      <span style={styles.arrow}>→</span>

      {levels === 3 ? (
        <>
          <span style={styles.role}>First Officer</span>
          <strong style={styles.name}>
            {names(workflow.first_officer_user_ids)}
          </strong>
          <span style={styles.arrow}>→</span>
        </>
      ) : null}

      <span style={styles.role}>Captain</span>
      <strong style={styles.name}>{names(workflow.captain_user_ids)}</strong>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  strip: {
    minHeight: 28,
    background: "#ffffff",
    border: "1px solid #cfd8e6",
    borderLeft: "3px solid #2563eb",
    marginBottom: 8,
    padding: "4px 8px",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 9.5,
  },
  label: {
    color: "#2563eb",
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: "0.08em",
  },
  role: {
    color: "#64748b",
    fontSize: 8.5,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  name: {
    color: "#0f172a",
    fontSize: 9.5,
  },
  arrow: {
    color: "#94a3b8",
    fontWeight: 900,
    margin: "0 2px",
  },
};
