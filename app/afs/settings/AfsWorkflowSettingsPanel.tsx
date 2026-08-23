"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";

type Authority = "Pilot" | "First Officer" | "Captain";

type WorkflowUser = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  access_enabled: boolean;
  can_access_afs?: boolean;
  afs_authority: Authority;
  can_restrict_afs_files?: boolean;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export default function AfsWorkflowSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [users, setUsers] = useState<WorkflowUser[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [message, setMessage] = useState("");

  async function authHeaders(): Promise<Record<string, string>> {
    if (!supabase) return {};
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function loadWorkflow() {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch("/api/afs/settings/workflow", {
        cache: "no-store",
        headers: await authHeaders(),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not load AFS users.");
      }

      setUsers(data.users || []);
      setCanManage(Boolean(data.canManage));
    } catch (error: any) {
      setMessage(error?.message || "Could not load AFS users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkflow();
  }, []);

  const afsUsers = useMemo(
    () => users.filter((user) => user.access_enabled && user.can_access_afs !== false),
    [users],
  );

  async function changeAuthority(userId: string, authority: Authority) {
    if (!canManage) return;

    try {
      setSavingId(userId);
      setMessage("");

      const response = await fetch("/api/afs/settings/workflow", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          action: "user-authority",
          userId,
          authority,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not update AFS authority.");
      }

      setUsers((current) =>
        current.map((user) =>
          user.id === userId
            ? {
                ...user,
                afs_authority: data.authority,
                can_restrict_afs_files: data.canRestrictAfsFiles,
              }
            : user,
        ),
      );
    } catch (error: any) {
      setMessage(error?.message || "Could not update AFS authority.");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <section style={styles.shell}>Loading AFS team...</section>;
  }

  return (
    <section style={styles.shell}>
      <div style={styles.heading}>
        <div>
          <h3 style={styles.title}>AFS team</h3>
          <p style={styles.help}>
            Set each person&apos;s highest AFS authority. Their actual seat is chosen per file.
          </p>
        </div>

        <div style={styles.legend}>
          <span><b>Pilot</b> prepare</span>
          <span><b>First Officer</b> review</span>
          <span><b>Captain</b> final authority</span>
        </div>
      </div>

      {message ? <div style={styles.message}>{message}</div> : null}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Person</th>
              <th style={styles.th}>Platform role</th>
              <th style={styles.th}>Highest AFS authority</th>
              <th style={styles.th}>File access</th>
            </tr>
          </thead>
          <tbody>
            {afsUsers.map((user) => {
              return (
                <tr key={user.id}>
                  <td style={styles.td}>
                    <strong style={styles.person}>{user.full_name || user.email}</strong>
                    <span style={styles.email}>{user.email}</span>
                  </td>

                  <td style={styles.td}>
                    <span style={styles.platformRole}>{user.role || "User"}</span>
                  </td>

                  <td style={styles.td}>
                    <select
                      value={user.afs_authority}
                      disabled={!canManage || savingId === user.id}
                      onChange={(event) =>
                        changeAuthority(user.id, event.target.value as Authority)
                      }
                      style={styles.select}
                    >
                      <option value="Pilot">Pilot</option>
                      <option value="First Officer">First Officer</option>
                      <option value="Captain">Captain</option>
                    </select>

                  </td>

                  <td style={styles.td}>
                    {user.afs_authority === "Pilot" ? (
                      <span style={styles.normalBadge}>Normal</span>
                    ) : (
                      <span style={styles.seniorBadge}>Senior / restricted</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {afsUsers.length === 0 ? (
        <div style={styles.empty}>No AFS-enabled users found.</div>
      ) : null}
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
  heading: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 18,
  },
  title: {
    margin: 0,
    fontSize: 15,
    fontWeight: 900,
    color: "#0f172a",
  },
  help: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 10.5,
  },
  legend: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    color: "#64748b",
    fontSize: 9.5,
    whiteSpace: "nowrap",
  },
  tableWrap: {
    overflowX: "auto",
    borderTop: "1px solid #e2e8f0",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "7px 8px",
    borderBottom: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: 9,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "8px",
    borderBottom: "1px solid #e2e8f0",
    verticalAlign: "middle",
    fontSize: 10.5,
  },
  person: {
    display: "block",
    color: "#0f172a",
    fontSize: 10.5,
  },
  email: {
    display: "block",
    marginTop: 2,
    color: "#64748b",
    fontSize: 9.5,
  },
  platformRole: {
    color: "#334155",
    fontWeight: 750,
    whiteSpace: "nowrap",
  },
  select: {
    minWidth: 150,
    height: 29,
    border: "1px solid #94a3b8",
    background: "#ffffff",
    color: "#0f172a",
    padding: "4px 7px",
    fontSize: 10,
    fontWeight: 850,
  },
  ownerNote: {
    display: "block",
    marginTop: 3,
    color: "#64748b",
    fontSize: 9,
  },
  normalBadge: {
    display: "inline-block",
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#64748b",
    padding: "3px 6px",
    fontSize: 9,
    fontWeight: 850,
  },
  seniorBadge: {
    display: "inline-block",
    border: "1px solid #93c5fd",
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "3px 6px",
    fontSize: 9,
    fontWeight: 850,
  },
  message: {
    padding: "6px 8px",
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    color: "#475569",
    fontSize: 9.5,
  },
  empty: {
    color: "#94a3b8",
    fontSize: 10,
  },
};
