"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

type PracticeTarget = {
  monthly_revenue_target: number;
  annual_revenue_target: number | null;
  desired_recurring_coverage_percent: number | null;
  notes: string | null;
};

type StaffCapacity = {
  monday_hours: number;
  tuesday_hours: number;
  wednesday_hours: number;
  thursday_hours: number;
  friday_hours: number;
  saturday_hours: number;
  sunday_hours: number;
  weekly_capacity_hours: number;
  commercial_target_amount: number | null;
  commercial_target_basis: string | null;
  custom_target_label: string | null;
  include_in_capacity_planning: boolean;
  notes: string | null;
};

type TeamRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  standard_daily_hours: number | null;
  capacity: StaffCapacity | null;
};

const emptyTarget: PracticeTarget = {
  monthly_revenue_target: 0,
  annual_revenue_target: null,
  desired_recurring_coverage_percent: null,
  notes: null,
};

export default function FlightDeckSettingsPage() {
  const [target, setTarget] = useState<PracticeTarget>(emptyTarget);
  const [users, setUsers] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTarget, setSavingTarget] = useState(false);
  const [savingUserId, setSavingUserId] = useState("");
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
      const response = await fetch("/api/settings/flightdeck", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not load FlightDeck settings.");
      }

      setTarget(result.target || emptyTarget);
      setUsers((result.users || []).map((row: TeamRow) => ({
        ...row,
        capacity: row.capacity || {
          monday_hours: row.standard_daily_hours || 0,
          tuesday_hours: row.standard_daily_hours || 0,
          wednesday_hours: row.standard_daily_hours || 0,
          thursday_hours: row.standard_daily_hours || 0,
          friday_hours: row.standard_daily_hours || 0,
          saturday_hours: 0,
          sunday_hours: 0,
          weekly_capacity_hours: Number(row.standard_daily_hours || 0) * 5,
          commercial_target_amount: null,
          commercial_target_basis: null,
          custom_target_label: null,
          include_in_capacity_planning: true,
          notes: null,
        },
      })));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load FlightDeck settings."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function patchUser(userId: string, patch: Partial<StaffCapacity>) {
    setUsers((current) =>
      current.map((row) =>
        row.user_id === userId
          ? {
              ...row,
              capacity: {
                ...(row.capacity as StaffCapacity),
                ...patch,
              },
            }
          : row
      )
    );
  }

  async function savePracticeTarget() {
    setSavingTarget(true);
    setError("");
    setMessage("");

    try {
      const token = await getToken();
      const response = await fetch("/api/settings/flightdeck", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "save-practice-target",
          monthlyRevenueTarget: target.monthly_revenue_target,
          annualRevenueTarget: target.annual_revenue_target,
          desiredRecurringCoveragePercent:
            target.desired_recurring_coverage_percent,
          notes: target.notes,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not save practice target.");
      }

      setMessage("Practice target updated.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save practice target."
      );
    } finally {
      setSavingTarget(false);
    }
  }

  async function saveStaff(row: TeamRow) {
    if (!row.capacity) return;

    setSavingUserId(row.user_id);
    setError("");
    setMessage("");

    try {
      const token = await getToken();
      const c = row.capacity;

      const response = await fetch("/api/settings/flightdeck", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "save-staff-silo",
          userId: row.user_id,
          mondayHours: c.monday_hours,
          tuesdayHours: c.tuesday_hours,
          wednesdayHours: c.wednesday_hours,
          thursdayHours: c.thursday_hours,
          fridayHours: c.friday_hours,
          saturdayHours: c.saturday_hours,
          sundayHours: c.sunday_hours,
          commercialTargetAmount: c.commercial_target_amount,
          commercialTargetBasis: c.commercial_target_basis,
          customTargetLabel: c.custom_target_label,
          includeInCapacityPlanning: c.include_in_capacity_planning,
          notes: c.notes,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not save staff silo.");
      }

      setMessage(`${row.full_name || row.email || "Team member"} updated.`);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save staff silo."
      );
    } finally {
      setSavingUserId("");
    }
  }

  const monthlyTarget = Number(target.monthly_revenue_target || 0);
  const annualEquivalent = monthlyTarget * 12;

  return (
    <main style={page}>
      <section style={header}>
        <div>
          <h1 style={title}>FlightDeck Settings</h1>
          <p style={subtitle}>
            Set the practice target and define each team member&apos;s real delivery capacity.
          </p>
        </div>

        <a href="/settings/capacity-pools" style={capacityPoolLink}>
          Client Capacity Pools
        </a>
      </section>

      {error ? <div style={errorBar}>{error}</div> : null}
      {message ? <div style={messageBar}>{message}</div> : null}

      {loading ? (
        <div style={empty}>Loading...</div>
      ) : (
        <>
          <section style={section}>
            <div style={sectionHeader}>
              <div>
                <h2 style={sectionTitle}>Practice Target</h2>
                <p style={sectionText}>
                  The revenue level the practice needs to reach each month, with recurring coverage shown separately.
                </p>
              </div>

              <button
                type="button"
                onClick={savePracticeTarget}
                style={primaryButton}
                disabled={savingTarget}
              >
                {savingTarget ? "Saving..." : "Save target"}
              </button>
            </div>

            <div style={targetGrid}>
              <label style={field}>
                <span style={label}>Monthly revenue target</span>
                <div style={moneyField}>
                  <span style={currency}>R</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={target.monthly_revenue_target ?? ""}
                    onChange={(e) =>
                      setTarget((current) => ({
                        ...current,
                        monthly_revenue_target:
                          e.target.value === "" ? 0 : Number(e.target.value),
                      }))
                    }
                    style={input}
                  />
                </div>
              </label>

              <label style={field}>
                <span style={label}>Annual target</span>
                <div style={moneyField}>
                  <span style={currency}>R</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={target.annual_revenue_target ?? ""}
                    placeholder={String(annualEquivalent || "")}
                    onChange={(e) =>
                      setTarget((current) => ({
                        ...current,
                        annual_revenue_target:
                          e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    style={input}
                  />
                </div>
              </label>

              <label style={field}>
                <span style={label}>Desired recurring coverage</span>
                <div style={percentField}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={target.desired_recurring_coverage_percent ?? ""}
                    onChange={(e) =>
                      setTarget((current) => ({
                        ...current,
                        desired_recurring_coverage_percent:
                          e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    style={input}
                    placeholder="e.g. 80"
                  />
                  <span style={suffix}>%</span>
                </div>
              </label>
            </div>
          </section>

          <section style={section}>
            <div style={sectionHeader}>
              <div>
                <h2 style={sectionTitle}>Staff Silos</h2>
                <p style={sectionText}>
                  Time capacity and optional commercial targets are independent. A team member can have no sales target and still have full contribution reporting.
                </p>
              </div>
            </div>

            <div style={tableHeader}>
              <span>Team member</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Weekly</span>
              <span>Commercial target</span>
              <span>Basis</span>
              <span />
            </div>

            {users.map((row) => {
              const c = row.capacity as StaffCapacity;
              const weekly =
                Number(c.monday_hours || 0) +
                Number(c.tuesday_hours || 0) +
                Number(c.wednesday_hours || 0) +
                Number(c.thursday_hours || 0) +
                Number(c.friday_hours || 0) +
                Number(c.saturday_hours || 0) +
                Number(c.sunday_hours || 0);

              return (
                <div key={row.user_id} style={tableRow}>
                  <div>
                    <strong style={name}>
                      {row.full_name || row.email || "Team member"}
                    </strong>
                    <div style={meta}>
                      {row.email || "No email"} · {row.role || "Staff"}
                    </div>
                  </div>

                  {[
                    "monday_hours",
                    "tuesday_hours",
                    "wednesday_hours",
                    "thursday_hours",
                    "friday_hours",
                  ].map((key) => (
                    <input
                      key={key}
                      type="number"
                      min="0"
                      max="24"
                      step="0.25"
                      value={Number((c as any)[key] || 0)}
                      onChange={(e) =>
                        patchUser(row.user_id, {
                          [key]: Number(e.target.value || 0),
                        } as Partial<StaffCapacity>)
                      }
                      style={smallInput}
                    />
                  ))}

                  <strong style={weeklyValue}>{weekly.toFixed(2)}h</strong>

                  <div style={moneyField}>
                    <span style={currency}>R</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={c.commercial_target_amount ?? ""}
                      placeholder="Optional"
                      onChange={(e) =>
                        patchUser(row.user_id, {
                          commercial_target_amount:
                            e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      style={input}
                    />
                  </div>

                  <select
                    value={c.commercial_target_basis || ""}
                    onChange={(e) =>
                      patchUser(row.user_id, {
                        commercial_target_basis: e.target.value || null,
                      })
                    }
                    style={select}
                  >
                    <option value="">No target</option>
                    <option value="recurring_revenue">Recurring revenue</option>
                    <option value="revenue_supported">Revenue supported</option>
                    <option value="gross_contribution">Gross contribution</option>
                    <option value="custom">Custom</option>
                  </select>

                  <button
                    type="button"
                    style={saveButton}
                    onClick={() => saveStaff(row)}
                    disabled={savingUserId === row.user_id}
                  >
                    {savingUserId === row.user_id ? "..." : "Save"}
                  </button>
                </div>
              );
            })}
          </section>

          <div style={note}>
            <strong>How this will be used:</strong> PP will compare each person's real available hours, assigned client work, actual tracked time, commercial book and economic contribution. No commercial target is required for contribution reporting.
          </div>
        </>
      )}
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f4f7fa",
  padding: "18px 22px 28px",
  color: "#10233a",
};

const header: React.CSSProperties = {
  marginBottom: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const capacityPoolLink: React.CSSProperties = {
  minHeight: "28px",
  padding: "0 10px",
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid #10233a",
  background: "#ffffff",
  color: "#10233a",
  textDecoration: "none",
  fontSize: "8px",
  fontWeight: 900,
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

const section: React.CSSProperties = {
  marginTop: "10px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const sectionHeader: React.CSSProperties = {
  minHeight: "52px",
  padding: "8px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  borderBottom: "1px solid #d8dee7",
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "13px",
  fontWeight: 900,
};

const sectionText: React.CSSProperties = {
  margin: "2px 0 0",
  color: "#64748b",
  fontSize: "9px",
};

const targetGrid: React.CSSProperties = {
  padding: "10px",
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "10px",
};

const field: React.CSSProperties = {
  display: "grid",
  gap: "4px",
};

const label: React.CSSProperties = {
  color: "#526174",
  fontSize: "8px",
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

const smallInput: React.CSSProperties = {
  width: "100%",
  height: "28px",
  boxSizing: "border-box",
  padding: "0 5px",
  border: "1px solid #cbd5e1",
  borderRadius: 0,
  background: "#ffffff",
  color: "#10233a",
  fontSize: "8px",
  textAlign: "right",
};

const select: React.CSSProperties = {
  width: "100%",
  height: "30px",
  boxSizing: "border-box",
  padding: "0 6px",
  border: "1px solid #cbd5e1",
  borderRadius: 0,
  background: "#ffffff",
  color: "#10233a",
  fontSize: "8px",
};

const moneyField: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "20px minmax(0, 1fr)",
  alignItems: "center",
};

const percentField: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 22px",
  alignItems: "center",
};

const currency: React.CSSProperties = {
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 850,
};

const suffix: React.CSSProperties = {
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 850,
  textAlign: "center",
};

const primaryButton: React.CSSProperties = {
  height: "28px",
  padding: "0 10px",
  border: "1px solid #10233a",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "8px",
  fontWeight: 900,
  cursor: "pointer",
};

const tableHeader: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 10px",
  display: "grid",
  gridTemplateColumns:
    "minmax(230px,1.5fr) 58px 58px 58px 58px 58px 78px 150px 145px 58px",
  gap: "7px",
  alignItems: "center",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "7.5px",
  fontWeight: 850,
};

const tableRow: React.CSSProperties = {
  minHeight: "44px",
  padding: "5px 10px",
  display: "grid",
  gridTemplateColumns:
    "minmax(230px,1.5fr) 58px 58px 58px 58px 58px 78px 150px 145px 58px",
  gap: "7px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
};

const name: React.CSSProperties = {
  fontSize: "9px",
  fontWeight: 900,
};

const meta: React.CSSProperties = {
  marginTop: "2px",
  color: "#64748b",
  fontSize: "7px",
};

const weeklyValue: React.CSSProperties = {
  fontSize: "8px",
  fontWeight: 900,
};

const saveButton: React.CSSProperties = {
  height: "28px",
  padding: "0 7px",
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
  fontSize: "8px",
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
