"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";

type Authority = "Pilot" | "First Officer" | "Captain";

type CrewUser = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  afs_authority: Authority | null;
};

type Props = {
  engagementId: string;
  onStarted?: () => void;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

function name(user: CrewUser | undefined | null) {
  return user?.full_name?.trim() || user?.email || "Unknown";
}

function rank(authority: Authority | null | undefined) {
  if (authority === "Captain") return 3;
  if (authority === "First Officer") return 2;
  return 1;
}

function toggle(current: string[], id: string) {
  return current.includes(id)
    ? current.filter((value) => value !== id)
    : [...current, id];
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) {
    throw new Error(`PP returned an empty response (${response.status}).`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`PP returned an invalid response (${response.status}).`);
  }
}

export default function AfsFlightOpeningPanel({
  engagementId,
  onStarted,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<CrewUser[]>([]);
  const [organisation, setOrganisation] = useState<any>(null);
  const [workflow, setWorkflow] = useState<any>(null);

  const [levels, setLevels] = useState(2);
  const [pilotIds, setPilotIds] = useState<string[]>([]);
  const [firstOfficerIds, setFirstOfficerIds] = useState<string[]>([]);
  const [captainIds, setCaptainIds] = useState<string[]>([]);
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

      const response = await fetch(
        `/api/afs/engagement/${engagementId}/opening`,
        {
          cache: "no-store",
          headers: await authHeaders(),
        },
      );

      const data = await readJson(response);
      if (!response.ok) {
        throw new Error(data.error || "Could not load flight setup.");
      }

      setCurrentUser(data.currentUser);
      setUsers(data.users || []);
      setOrganisation(data.organisation || null);
      setWorkflow(data.workflow || null);

      const defaultLevels = Number(
        data.workflow?.workflow_levels ||
          data.organisation?.afs_default_workflow_levels ||
          2,
      );

      setLevels(defaultLevels);

      setPilotIds(
        data.workflow?.pilot_user_ids?.length
          ? data.workflow.pilot_user_ids
          : data.currentUser?.id
            ? [data.currentUser.id]
            : [],
      );

      setFirstOfficerIds(data.workflow?.first_officer_user_ids || []);
      setCaptainIds(data.workflow?.captain_user_ids || []);
    } catch (error: any) {
      setMessage(error?.message || "Could not load flight setup.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [engagementId]);

  const firstOfficerOptions = useMemo(
    () => users.filter((user) => rank(user.afs_authority) >= 2),
    [users],
  );

  const captainOptions = useMemo(
    () => users.filter((user) => rank(user.afs_authority) >= 3),
    [users],
  );

  const openerRank = rank(currentUser?.afs_authority);
  const canSolo =
    openerRank >= 3 && Boolean(organisation?.afs_allow_solo);
  const canThree = Boolean(organisation?.afs_allow_three_level);

  useEffect(() => {
    if (!currentUser) return;

    if (levels === 1) {
      setPilotIds([currentUser.id]);
      setFirstOfficerIds([]);
      setCaptainIds([currentUser.id]);
    } else if (levels === 2) {
      setFirstOfficerIds([]);
    }
  }, [levels, currentUser]);

  async function startFlight() {
    try {
      setSaving(true);
      setMessage("");

      const response = await fetch(
        `/api/afs/engagement/${engagementId}/opening`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(await authHeaders()),
          },
          body: JSON.stringify({
            workflowLevels: levels,
            pilotUserIds: pilotIds,
            firstOfficerUserIds: firstOfficerIds,
            captainUserIds: captainIds,
          }),
        },
      );

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(data.error || "Could not start flight.");
      }

      setWorkflow(data.workflow);
      onStarted?.();
    } catch (error: any) {
      setMessage(error?.message || "Could not start flight.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;
  if (workflow?.is_started) return null;

  return (
    <section style={styles.shell}>
      <div style={styles.row}>
        <div style={styles.labelBlock}>
          <span style={styles.kicker}>START FLIGHT</span>
          <strong style={styles.heading}>Workflow</strong>
        </div>

        <div style={styles.levelButtons}>
          <button
            type="button"
            disabled={!canSolo}
            onClick={() => setLevels(1)}
            style={{
              ...styles.levelButton,
              ...(levels === 1 ? styles.levelButtonActive : {}),
              ...(!canSolo ? styles.disabled : {}),
            }}
          >
            Solo
          </button>

          <button
            type="button"
            onClick={() => setLevels(2)}
            style={{
              ...styles.levelButton,
              ...(levels === 2 ? styles.levelButtonActive : {}),
            }}
          >
            2-level
          </button>

          <button
            type="button"
            disabled={!canThree}
            onClick={() => setLevels(3)}
            style={{
              ...styles.levelButton,
              ...(levels === 3 ? styles.levelButtonActive : {}),
              ...(!canThree ? styles.disabled : {}),
            }}
          >
            3-level
          </button>
        </div>

        {levels === 1 ? (
          <div style={styles.soloText}>
            <strong>{name(currentUser)}</strong>
            <span>does the full file</span>
          </div>
        ) : (
          <div style={styles.seats}>
            <CrewPicker
              label="Pilot"
              users={users}
              selected={pilotIds}
              onToggle={(id) => setPilotIds((current) => toggle(current, id))}
            />

            {levels === 3 ? (
              <CrewPicker
                label="First Officer"
                users={firstOfficerOptions}
                selected={firstOfficerIds}
                onToggle={(id) =>
                  setFirstOfficerIds((current) => toggle(current, id))
                }
              />
            ) : null}

            <CrewPicker
              label="Captain"
              users={captainOptions}
              selected={captainIds}
              onToggle={(id) =>
                setCaptainIds((current) => toggle(current, id))
              }
            />
          </div>
        )}

        <button
          type="button"
          style={styles.startButton}
          disabled={saving}
          onClick={startFlight}
        >
          {saving ? "Starting..." : "Start"}
        </button>
      </div>

      {message ? <div style={styles.message}>{message}</div> : null}
    </section>
  );
}

function CrewPicker({
  label,
  users,
  selected,
  onToggle,
}: {
  label: string;
  users: CrewUser[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const selectedNames = users
    .filter((user) => selected.includes(user.id))
    .map(name);

  return (
    <details style={styles.picker}>
      <summary style={styles.pickerSummary}>
        <span style={styles.pickerLabel}>{label}</span>
        <strong style={styles.pickerValue}>
          {selectedNames.length
            ? selectedNames.join(", ")
            : "Select"}
        </strong>
      </summary>

      <div style={styles.pickerMenu}>
        {users.length ? (
          users.map((user) => (
            <label key={user.id} style={styles.userRow}>
              <input
                type="checkbox"
                checked={selected.includes(user.id)}
                onChange={() => onToggle(user.id)}
              />
              <span>{name(user)}</span>
            </label>
          ))
        ) : (
          <span style={styles.noUsers}>No eligible users</span>
        )}
      </div>
    </details>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    background: "#ffffff",
    border: "1px solid #cfd8e6",
    borderLeft: "3px solid #2563eb",
    marginBottom: 8,
  },
  row: {
    minHeight: 42,
    padding: "6px 8px",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  labelBlock: {
    width: 86,
    display: "grid",
    gap: 1,
  },
  kicker: {
    color: "#2563eb",
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: "0.08em",
  },
  heading: {
    fontSize: 10.5,
    color: "#0f172a",
  },
  levelButtons: {
    display: "flex",
    border: "1px solid #cbd5e1",
  },
  levelButton: {
    minWidth: 66,
    height: 28,
    border: 0,
    borderRight: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#475569",
    fontSize: 9.5,
    fontWeight: 850,
    cursor: "pointer",
  },
  levelButtonActive: {
    background: "#eff6ff",
    color: "#1d4ed8",
    boxShadow: "inset 0 -2px 0 #2563eb",
  },
  disabled: {
    opacity: 0.35,
    cursor: "not-allowed",
  },
  seats: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    gap: 6,
  },
  picker: {
    position: "relative",
    minWidth: 150,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
  },
  pickerSummary: {
    listStyle: "none",
    cursor: "pointer",
    padding: "4px 7px",
    display: "grid",
    gap: 1,
    minHeight: 26,
    boxSizing: "border-box",
  },
  pickerLabel: {
    color: "#64748b",
    fontSize: 7.5,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  pickerValue: {
    color: "#0f172a",
    fontSize: 9.5,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  pickerMenu: {
    position: "absolute",
    top: "100%",
    left: -1,
    zIndex: 2500,
    minWidth: 210,
    maxHeight: 180,
    overflowY: "auto",
    background: "#ffffff",
    border: "1px solid #94a3b8",
    padding: 6,
    boxShadow: "0 6px 18px rgba(15,23,42,0.12)",
  },
  userRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 2px",
    fontSize: 9.5,
    fontWeight: 750,
  },
  noUsers: {
    color: "#94a3b8",
    fontSize: 9.5,
  },
  soloText: {
    flex: 1,
    display: "flex",
    gap: 6,
    alignItems: "center",
    fontSize: 9.5,
    color: "#64748b",
  },
  startButton: {
    marginLeft: "auto",
    height: 28,
    border: "1px solid #1d4ed8",
    background: "#2563eb",
    color: "#ffffff",
    padding: "0 12px",
    fontSize: 9.5,
    fontWeight: 900,
    cursor: "pointer",
  },
  message: {
    borderTop: "1px solid #e2e8f0",
    background: "#fff7ed",
    color: "#9a3412",
    padding: "5px 8px",
    fontSize: 9.5,
    fontWeight: 750,
  },
};
