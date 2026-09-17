"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

type TeamCostingRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  access_enabled: boolean;
  hourly_cost_rate: number | null;
  hourly_charge_rate: number | null;
};

export default function TeamCostingPage() {
  const [rows, setRows] = useState<TeamCostingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function getToken() {
    if (!supabase) throw new Error("Supabase client is not configured.");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) throw new Error("You are not signed in.");

    return session.access_token;
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      const token = await getToken();

      const response = await fetch("/api/settings/team-costing", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not load team costing.");
      }

      setRows((result.users || []) as TeamCostingRow[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load team costing."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function patchRow(id: string, patch: Partial<TeamCostingRow>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  async function save(row: TeamCostingRow) {
    setSavingId(row.id);
    setError("");
    setMessage("");

    try {
      const token = await getToken();

      const response = await fetch("/api/settings/team-costing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          profileId: row.id,
          hourlyCostRate: row.hourly_cost_rate,
          hourlyChargeRate: row.hourly_charge_rate,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not save team costing.");
      }

      setMessage(`${row.full_name || row.email || "Team member"} updated.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save team costing."
      );
    } finally {
      setSavingId("");
    }
  }

  return (
    <main style={page}>
      <section style={header}>
        <div>
          <h1 style={title}>Team Costing</h1>
          <p style={subtitle}>
            Set each team member's internal cost rate and charge-out rate.
          </p>
        </div>
      </section>

      {error ? <div style={errorBar}>{error}</div> : null}
      {message ? <div style={messageBar}>{message}</div> : null}

      <section style={panel}>
        <div style={tableHeader}>
          <span>Team member</span>
          <span>Internal cost / hour</span>
          <span>Charge-out rate / hour</span>
          <span />
        </div>

        {loading ? (
          <div style={empty}>Loading...</div>
        ) : rows.length ? (
          rows.map((row) => (
            <div key={row.id} style={tableRow}>
              <div>
                <strong style={name}>{row.full_name || row.email || "Team member"}</strong>
                <div style={meta}>
                  {row.email || "No email"} · {row.role || "Staff"}
                </div>
              </div>

              <div style={moneyField}>
                <span style={currency}>R</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.hourly_cost_rate ?? ""}
                  onChange={(event) =>
                    patchRow(row.id, {
                      hourly_cost_rate:
                        event.target.value === ""
                          ? null
                          : Number(event.target.value),
                    })
                  }
                  style={input}
                  placeholder="0.00"
                />
              </div>

              <div style={moneyField}>
                <span style={currency}>R</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.hourly_charge_rate ?? ""}
                  onChange={(event) =>
                    patchRow(row.id, {
                      hourly_charge_rate:
                        event.target.value === ""
                          ? null
                          : Number(event.target.value),
                    })
                  }
                  style={input}
                  placeholder="Optional"
                />
              </div>

              <button
                type="button"
                style={saveButton}
                disabled={savingId === row.id}
                onClick={() => void save(row)}
              >
                {savingId === row.id ? "Saving..." : "Save"}
              </button>
            </div>
          ))
        ) : (
          <div style={empty}>No active practice users found.</div>
        )}
      </section>

      <div style={note}>
        <strong>Internal cost rate</strong> drives client profitability:
        tracked time × internal cost rate = actual staff cost. The
        <strong> charge-out rate</strong> is the staff member's standard hourly
        billing rate where work is billed by time.
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: "10px 12px 28px",
  background: "#eef2f5",
  color: "#10233a",
};

const header: React.CSSProperties = {
  minHeight: "58px",
  display: "flex",
  alignItems: "center",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: "20px",
  fontWeight: 900,
};

const subtitle: React.CSSProperties = {
  margin: "3px 0 0",
  color: "#64748b",
  fontSize: "10px",
};

const panel: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const tableHeader: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 10px",
  display: "grid",
  gridTemplateColumns: "minmax(320px,1.6fr) 200px 200px 70px",
  gap: "8px",
  alignItems: "center",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "8px",
  fontWeight: 850,
};

const tableRow: React.CSSProperties = {
  minHeight: "44px",
  padding: "5px 10px",
  display: "grid",
  gridTemplateColumns: "minmax(320px,1.6fr) 200px 200px 70px",
  gap: "8px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
};

const name: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 900,
};

const meta: React.CSSProperties = {
  marginTop: "2px",
  color: "#64748b",
  fontSize: "8px",
};

const moneyField: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "24px minmax(0, 1fr)",
  alignItems: "center",
};

const currency: React.CSSProperties = {
  color: "#64748b",
  fontSize: "9px",
  fontWeight: 850,
};

const input: React.CSSProperties = {
  width: "100%",
  height: "30px",
  boxSizing: "border-box",
  padding: "0 7px",
  border: "1px solid #cbd5e1",
  borderRadius: 0,
  background: "#ffffff",
  color: "#10233a",
  fontSize: "9px",
};

const saveButton: React.CSSProperties = {
  height: "28px",
  padding: "0 9px",
  border: "1px solid #10233a",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "8px",
  fontWeight: 900,
  cursor: "pointer",
};

const note: React.CSSProperties = {
  marginTop: "8px",
  padding: "8px 10px",
  borderLeft: "3px solid #1758d5",
  background: "#f4f8fc",
  color: "#526174",
  fontSize: "9px",
  lineHeight: 1.45,
};

const errorBar: React.CSSProperties = {
  marginBottom: "8px",
  padding: "8px 10px",
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontSize: "9px",
  fontWeight: 800,
};

const messageBar: React.CSSProperties = {
  marginBottom: "8px",
  padding: "8px 10px",
  border: "1px solid #bbf7d0",
  background: "#ecfdf3",
  color: "#166534",
  fontSize: "9px",
  fontWeight: 800,
};

const empty: React.CSSProperties = {
  padding: "16px 10px",
  color: "#64748b",
  fontSize: "9px",
};
