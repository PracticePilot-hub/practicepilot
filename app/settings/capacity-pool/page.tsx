"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

type ClientOption = {
  id: string;
  client_name: string;
  client_code: string | null;
  relationship_status: string;
};

type GroupOption = {
  id: string;
  group_name: string;
};

type PoolRow = {
  id: string;
  scope_type: "client" | "group";
  client_id: string | null;
  client_group_id: string | null;
  pool_name: string | null;
  period_basis: "daily" | "weekly" | "monthly";
  allocated_hours: number;
  allocation_type: "service_capacity" | "internal_target";
  enforcement_mode: "measure_only" | "warn_at_limit" | "hard_limit";
  warning_percent: number;
  rollover_policy: "none" | "manual" | "carry_forward";
  include_in_capacity_planning: boolean;
  notes: string | null;
};

export default function CapacityPoolsPage() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [pools, setPools] = useState<PoolRow[]>([]);
  const [scopeType, setScopeType] = useState<"client" | "group">("client");
  const [scopeId, setScopeId] = useState("");
  const [poolName, setPoolName] = useState("");
  const [periodBasis, setPeriodBasis] = useState<"daily" | "weekly" | "monthly">(
    "weekly"
  );
  const [allocatedHours, setAllocatedHours] = useState("");
  const [enforcementMode, setEnforcementMode] = useState<
    "measure_only" | "warn_at_limit" | "hard_limit"
  >("measure_only");
  const [warningPercent, setWarningPercent] = useState("80");
  const [rolloverPolicy, setRolloverPolicy] = useState<
    "none" | "manual" | "carry_forward"
  >("none");
  const [includeInCapacityPlanning, setIncludeInCapacityPlanning] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
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
      const response = await fetch("/api/settings/capacity-pools", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not load capacity pools.");
      }

      setClients(result.clients || []);
      setGroups(result.groups || []);
      setPools(result.pools || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load capacity pools.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedExisting = useMemo(() => {
    return pools.find((row) =>
      scopeType === "client"
        ? row.scope_type === "client" && row.client_id === scopeId
        : row.scope_type === "group" && row.client_group_id === scopeId
    );
  }, [pools, scopeType, scopeId]);

  useEffect(() => {
    if (!selectedExisting) return;

    setPoolName(selectedExisting.pool_name || "");
    setPeriodBasis(selectedExisting.period_basis);
    setAllocatedHours(String(selectedExisting.allocated_hours ?? ""));
    setEnforcementMode(selectedExisting.enforcement_mode);
    setWarningPercent(String(selectedExisting.warning_percent ?? 80));
    setRolloverPolicy(selectedExisting.rollover_policy);
    setIncludeInCapacityPlanning(selectedExisting.include_in_capacity_planning);
    setNotes(selectedExisting.notes || "");
  }, [selectedExisting]);

  function resetForm(nextScopeType?: "client" | "group") {
    if (nextScopeType) setScopeType(nextScopeType);
    setScopeId("");
    setPoolName("");
    setPeriodBasis("weekly");
    setAllocatedHours("");
    setEnforcementMode("measure_only");
    setWarningPercent("80");
    setRolloverPolicy("none");
    setIncludeInCapacityPlanning(true);
    setNotes("");
    setMessage("");
    setError("");
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const token = await getToken();
      const response = await fetch("/api/settings/capacity-pools", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scopeType,
          scopeId,
          poolName,
          periodBasis,
          allocatedHours:
            allocatedHours.trim() === "" ? 0 : Number(allocatedHours),
          allocationType: "service_capacity",
          enforcementMode,
          warningPercent:
            warningPercent.trim() === "" ? 80 : Number(warningPercent),
          rolloverPolicy,
          includeInCapacityPlanning,
          notes,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not save capacity pool.");
      }

      setMessage("Capacity pool saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save capacity pool.");
    } finally {
      setSaving(false);
    }
  }

  const scopeOptions =
    scopeType === "client"
      ? clients.map((row) => ({
          id: row.id,
          label: `${row.client_name}${row.client_code ? ` · ${row.client_code}` : ""}`,
        }))
      : groups.map((row) => ({
          id: row.id,
          label: row.group_name,
        }));

  return (
    <main style={page}>
      <section style={header}>
        <div>
          <h1 style={title}>Client Capacity Pools</h1>
          <p style={subtitle}>
            Reserve relationship capacity across a single client or an entire client group.
          </p>
        </div>
      </section>

      {error ? <div style={errorBar}>{error}</div> : null}
      {message ? <div style={messageBar}>{message}</div> : null}

      <section style={section}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>Capacity Pool</h2>
            <p style={sectionText}>
              One pool can cover everything we do for the relationship. No service-by-service split is required.
            </p>
          </div>

          <button type="button" onClick={save} style={primaryButton} disabled={saving}>
            {saving ? "Saving..." : "Save pool"}
          </button>
        </div>

        <div style={scopeTabs}>
          <button
            type="button"
            onClick={() => resetForm("client")}
            style={{
              ...scopeTab,
              ...(scopeType === "client" ? scopeTabActive : {}),
            }}
          >
            Client
          </button>

          <button
            type="button"
            onClick={() => resetForm("group")}
            style={{
              ...scopeTab,
              ...(scopeType === "group" ? scopeTabActive : {}),
            }}
          >
            Client Group
          </button>
        </div>

        <div style={formGrid}>
          <label style={field}>
            <span style={label}>{scopeType === "client" ? "Client" : "Client group"}</span>
            <select
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              style={input}
            >
              <option value="">Select...</option>
              {scopeOptions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </select>
          </label>

          <label style={field}>
            <span style={label}>Pool name</span>
            <input
              value={poolName}
              onChange={(e) => setPoolName(e.target.value)}
              placeholder="e.g. Praxley relationship capacity"
              style={input}
            />
          </label>

          <label style={field}>
            <span style={label}>Basis</span>
            <select
              value={periodBasis}
              onChange={(e) => setPeriodBasis(e.target.value as any)}
              style={input}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>

          <label style={field}>
            <span style={label}>Allocated hours</span>
            <input
              type="number"
              min="0"
              step="0.25"
              value={allocatedHours}
              onChange={(e) => setAllocatedHours(e.target.value)}
              placeholder="e.g. 16"
              style={input}
            />
          </label>

          <label style={field}>
            <span style={label}>Warning threshold</span>
            <div style={suffixField}>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={warningPercent}
                onChange={(e) => setWarningPercent(e.target.value)}
                style={input}
              />
              <span style={suffix}>%</span>
            </div>
          </label>

          <label style={field}>
            <span style={label}>Behaviour</span>
            <select
              value={enforcementMode}
              onChange={(e) => setEnforcementMode(e.target.value as any)}
              style={input}
            >
              <option value="measure_only">Measure only</option>
              <option value="warn_at_limit">Warn at limit</option>
              <option value="hard_limit">Hard limit</option>
            </select>
          </label>

          <label style={field}>
            <span style={label}>Rollover</span>
            <select
              value={rolloverPolicy}
              onChange={(e) => setRolloverPolicy(e.target.value as any)}
              style={input}
            >
              <option value="none">No rollover</option>
              <option value="manual">Manual rollover</option>
              <option value="carry_forward">Carry forward</option>
            </select>
          </label>

          <label style={checkField}>
            <input
              type="checkbox"
              checked={includeInCapacityPlanning}
              onChange={(e) => setIncludeInCapacityPlanning(e.target.checked)}
            />
            <span>Include in capacity planning</span>
          </label>
        </div>

        <label style={notesField}>
          <span style={label}>Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about how this capacity arrangement works."
            style={textarea}
          />
        </label>
      </section>

      <section style={section}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>Current Pools</h2>
            <p style={sectionText}>
              Active relationship capacity currently being measured by PracticePilot.
            </p>
          </div>
        </div>

        <div style={tableHeader}>
          <span>Relationship</span>
          <span>Scope</span>
          <span>Capacity</span>
          <span>Warning</span>
          <span>Behaviour</span>
          <span>Rollover</span>
        </div>

        {loading ? (
          <div style={empty}>Loading...</div>
        ) : pools.length ? (
          pools.map((row) => {
            const client = clients.find((c) => c.id === row.client_id);
            const group = groups.find((g) => g.id === row.client_group_id);

            return (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  setScopeType(row.scope_type);
                  setScopeId(
                    row.scope_type === "client"
                      ? row.client_id || ""
                      : row.client_group_id || ""
                  );
                }}
                style={tableRow}
              >
                <span>
                  <strong style={name}>
                    {row.scope_type === "client"
                      ? client?.client_name || row.pool_name || "Client"
                      : group?.group_name || row.pool_name || "Client group"}
                  </strong>
                  <span style={meta}>{row.pool_name || "Capacity pool"}</span>
                </span>

                <span style={cell}>
                  {row.scope_type === "client" ? "Client" : "Client Group"}
                </span>

                <strong style={cellStrong}>
                  {Number(row.allocated_hours || 0).toFixed(2)}h / {row.period_basis}
                </strong>

                <span style={cell}>{Number(row.warning_percent || 0).toFixed(0)}%</span>

                <span style={cell}>
                  {row.enforcement_mode.replaceAll("_", " ")}
                </span>

                <span style={cell}>
                  {row.rollover_policy.replaceAll("_", " ")}
                </span>
              </button>
            );
          })
        ) : (
          <div style={empty}>No capacity pools have been configured yet.</div>
        )}
      </section>

      <div style={note}>
        <strong>Important:</strong> Commercial treatment is separate from capacity consumption. Work may consume this pool and still be billed separately or at a reduced fee.
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: "18px 22px 28px",
  background: "#f4f7fa",
  color: "#10233a",
};

const header: React.CSSProperties = { marginBottom: "10px" };

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
  border: "1px solid #d8dee7",
  background: "#ffffff",
};

const sectionHeader: React.CSSProperties = {
  minHeight: "52px",
  padding: "8px 10px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
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

const scopeTabs: React.CSSProperties = {
  padding: "8px 10px 0",
  display: "flex",
  gap: "5px",
};

const scopeTab: React.CSSProperties = {
  height: "28px",
  padding: "0 10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#526174",
  fontSize: "8px",
  fontWeight: 850,
  cursor: "pointer",
};

const scopeTabActive: React.CSSProperties = {
  background: "#10233a",
  borderColor: "#10233a",
  color: "#ffffff",
};

const formGrid: React.CSSProperties = {
  padding: "8px 10px",
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "8px",
};

const field: React.CSSProperties = {
  display: "grid",
  gap: "4px",
};

const checkField: React.CSSProperties = {
  minHeight: "30px",
  marginTop: "16px",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  color: "#526174",
  fontSize: "8px",
  fontWeight: 800,
};

const label: React.CSSProperties = {
  color: "#526174",
  fontSize: "8px",
  fontWeight: 850,
};

const input: React.CSSProperties = {
  width: "100%",
  height: "30px",
  padding: "0 7px",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 0,
  background: "#ffffff",
  color: "#10233a",
  fontSize: "8.5px",
};

const suffixField: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr) 22px",
  alignItems: "center",
};

const suffix: React.CSSProperties = {
  color: "#64748b",
  fontSize: "8px",
  textAlign: "center",
  fontWeight: 850,
};

const notesField: React.CSSProperties = {
  padding: "0 10px 10px",
  display: "grid",
  gap: "4px",
};

const textarea: React.CSSProperties = {
  minHeight: "58px",
  padding: "7px",
  resize: "vertical",
  border: "1px solid #cbd5e1",
  borderRadius: 0,
  color: "#10233a",
  fontSize: "8.5px",
  fontFamily: "inherit",
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
  gridTemplateColumns: "minmax(260px,1.5fr) 100px 145px 95px 130px 120px",
  gap: "7px",
  alignItems: "center",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "7.5px",
  fontWeight: 850,
};

const tableRow: React.CSSProperties = {
  width: "100%",
  minHeight: "44px",
  padding: "5px 10px",
  display: "grid",
  gridTemplateColumns: "minmax(260px,1.5fr) 100px 145px 95px 130px 120px",
  gap: "7px",
  alignItems: "center",
  border: "none",
  borderBottom: "1px solid #e5eaf0",
  background: "#ffffff",
  color: "#10233a",
  textAlign: "left",
  cursor: "pointer",
};

const name: React.CSSProperties = {
  display: "block",
  fontSize: "9px",
  fontWeight: 900,
};

const meta: React.CSSProperties = {
  display: "block",
  marginTop: "2px",
  color: "#64748b",
  fontSize: "7px",
};

const cell: React.CSSProperties = {
  fontSize: "8px",
  textTransform: "capitalize",
};

const cellStrong: React.CSSProperties = {
  fontSize: "8px",
  fontWeight: 900,
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
