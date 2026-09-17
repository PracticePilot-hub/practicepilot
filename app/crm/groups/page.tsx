"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type GroupRow = {
  id: string;
  group_name: string;
  group_code: string | null;
  notes: string | null;
  is_active: boolean;
};

type GroupStat = {
  group_id: string;
  members: number;
  flying_clients: number;
  open_work: number;
  overdue: number;
};

export default function ClientGroupsPage() {
  const router = useRouter();

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [stats, setStats] = useState<GroupStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupCode, setNewGroupCode] = useState("");
  const [newGroupNotes, setNewGroupNotes] = useState("");

  async function getToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not signed in.");
    }

    return session.access_token;
  }

  async function apiFetch(init?: RequestInit) {
    const token = await getToken();

    return fetch("/api/crm/groups", {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch();
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not load client groups.");
      }

      setGroups((result.groups || []) as GroupRow[]);
      setStats((result.groupStats || []) as GroupStat[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load client groups."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const statMap = useMemo(
    () => new Map(stats.map((row) => [row.group_id, row])),
    [stats]
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return groups.filter((group) => {
      if (!term) return true;

      return [
        group.group_name,
        group.group_code,
        group.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [groups, search]);

  async function createGroup() {
    if (!newGroupName.trim()) return;

    setSaving(true);
    setError("");

    try {
      const response = await apiFetch({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_group",
          groupName: newGroupName.trim(),
          groupCode: newGroupCode.trim(),
          notes: newGroupNotes.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not create client group.");
      }

      setNewGroupName("");
      setNewGroupCode("");
      setNewGroupNotes("");
      setShowNewGroup(false);

      if (result.groupId) {
        router.push(`/crm/groups/${result.groupId}`);
        return;
      }

      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create client group."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={page}>
      <section style={headerPanel}>
        <div>
          <h1 style={title}>Client Groups</h1>
          <p style={subtitle}>
            View related people, entities and trusts together, with group-wide work visibility.
          </p>
        </div>

        <button
          type="button"
          style={primaryButton}
          onClick={() => setShowNewGroup((current) => !current)}
        >
          New Group
        </button>
      </section>

      {error ? <div style={errorBar}>{error}</div> : null}

      {showNewGroup ? (
        <section style={createPanel}>
          <div style={createGrid}>
            <label style={field}>
              <span style={label}>Group name</span>
              <input
                style={input}
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder="e.g. Gary Rom Group"
              />
            </label>

            <label style={field}>
              <span style={label}>Group code</span>
              <input
                style={input}
                value={newGroupCode}
                onChange={(event) => setNewGroupCode(event.target.value)}
                placeholder="Optional"
              />
            </label>

            <label style={field}>
              <span style={label}>Notes</span>
              <input
                style={input}
                value={newGroupNotes}
                onChange={(event) => setNewGroupNotes(event.target.value)}
                placeholder="Optional"
              />
            </label>

            <div style={createActions}>
              <button
                type="button"
                style={secondaryButton}
                onClick={() => setShowNewGroup(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                style={primaryButton}
                onClick={createGroup}
                disabled={saving || !newGroupName.trim()}
              >
                Create Group
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section style={filterPanel}>
        <label style={field}>
          <span style={label}>Search</span>
          <input
            style={input}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Group name, code or notes..."
          />
        </label>

        <button
          type="button"
          style={secondaryButton}
          onClick={() => setSearch("")}
        >
          Clear
        </button>
      </section>

      <section style={contentPanel}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>Groups</h2>
            <p style={sectionSubtitle}>
              {loading ? "Loading..." : `${rows.length} of ${groups.length} groups shown`}
            </p>
          </div>

          <button type="button" onClick={load} style={secondaryButton}>
            Refresh
          </button>
        </div>

        <div style={tableHeader}>
          <span>Group</span>
          <span>Members</span>
          <span>Flying Clients</span>
          <span>Open work</span>
          <span>Overdue</span>
          <span />
        </div>

        {!loading && rows.length === 0 ? (
          <div style={emptyState}>No client groups match the current search.</div>
        ) : null}

        {rows.map((group) => {
          const groupStats = statMap.get(group.id) || {
            group_id: group.id,
            members: 0,
            flying_clients: 0,
            open_work: 0,
            overdue: 0,
          };

          return (
            <Link
              key={group.id}
              href={`/crm/groups/${group.id}`}
              style={tableRow}
            >
              <div>
                <strong style={groupName}>{group.group_name}</strong>
                <div style={groupMeta}>
                  {group.group_code ? `Code ${group.group_code}` : "No group code"}
                  {group.notes ? ` · ${group.notes}` : ""}
                </div>
              </div>

              <div style={numberCell}>{groupStats.members}</div>
              <div style={numberCell}>{groupStats.flying_clients}</div>
              <div style={numberCell}>{groupStats.open_work}</div>

              <div
                style={
                  groupStats.overdue > 0 ? overdueNumber : numberCell
                }
              >
                {groupStats.overdue}
              </div>

              <div style={rowArrow}>→</div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100%",
  padding: "8px 10px 28px",
  background: "#eef2f5",
  color: "#10233a",
};

const headerPanel: React.CSSProperties = {
  minHeight: "76px",
  padding: "10px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: "20px",
  fontWeight: 900,
};

const subtitle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#64748b",
  fontSize: "10px",
};

const primaryButton: React.CSSProperties = {
  height: "30px",
  padding: "0 11px",
  border: "1px solid #10233a",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "9px",
  fontWeight: 850,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  height: "30px",
  padding: "0 10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "9px",
  fontWeight: 850,
  cursor: "pointer",
};

const createPanel: React.CSSProperties = {
  marginTop: "8px",
  padding: "9px 10px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const createGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr .6fr 1.4fr auto",
  gap: "8px",
  alignItems: "end",
};

const field: React.CSSProperties = {
  display: "grid",
  gap: "4px",
};

const label: React.CSSProperties = {
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 850,
};

const input: React.CSSProperties = {
  width: "100%",
  height: "30px",
  boxSizing: "border-box",
  padding: "0 8px",
  border: "1px solid #cbd5e1",
  borderRadius: 0,
  background: "#ffffff",
  color: "#10233a",
  fontSize: "10px",
};

const createActions: React.CSSProperties = {
  display: "flex",
  gap: "6px",
};

const filterPanel: React.CSSProperties = {
  marginTop: "8px",
  padding: "9px 10px",
  display: "grid",
  gridTemplateColumns: "minmax(320px, 1fr) auto",
  gap: "8px",
  alignItems: "end",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const contentPanel: React.CSSProperties = {
  marginTop: "8px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const sectionHeader: React.CSSProperties = {
  minHeight: "52px",
  padding: "7px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: "1px solid #d8dee7",
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "13px",
  fontWeight: 900,
};

const sectionSubtitle: React.CSSProperties = {
  margin: "2px 0 0",
  color: "#64748b",
  fontSize: "9px",
};

const tableHeader: React.CSSProperties = {
  minHeight: "34px",
  padding: "0 10px",
  display: "grid",
  gridTemplateColumns: "minmax(360px, 1.5fr) 110px 120px 100px 90px 60px",
  gap: "8px",
  alignItems: "center",
  background: "#f7f9fb",
  borderBottom: "1px solid #d8dee7",
  color: "#526174",
  fontSize: "8px",
  fontWeight: 850,
};

const tableRow: React.CSSProperties = {
  minHeight: "46px",
  padding: "5px 10px",
  display: "grid",
  gridTemplateColumns: "minmax(360px, 1.5fr) 110px 120px 100px 90px 60px",
  gap: "8px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
  color: "inherit",
  textDecoration: "none",
};

const groupName: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 900,
};

const groupMeta: React.CSSProperties = {
  marginTop: "2px",
  color: "#64748b",
  fontSize: "8px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const numberCell: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 900,
};

const overdueNumber: React.CSSProperties = {
  ...numberCell,
  color: "#b42318",
};

const rowArrow: React.CSSProperties = {
  color: "#1758d5",
  fontSize: "23px",
  fontWeight: 900,
  textAlign: "right",
};

const emptyState: React.CSSProperties = {
  padding: "16px 10px",
  color: "#64748b",
  fontSize: "9px",
};

const errorBar: React.CSSProperties = {
  marginTop: "8px",
  padding: "9px 10px",
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontSize: "9px",
  fontWeight: 800,
};
