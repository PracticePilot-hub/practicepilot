"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { supabase } from "@/app/lib/supabase";

type ClientOption = {
  id: string;
  client_name: string;
};

type Action = {
  id: string;
  action_text: string;
  assigned_to_type: "practice" | "client";
  due_date: string | null;
  status: "open" | "completed" | "cancelled";
};

type Meeting = {
  id: string;
  title: string;
  meeting_at: string | null;
  meeting_type: string | null;
  location: string | null;
  attendees: string | null;
  minutes_text: string | null;
  actions: Action[];
};

export default function ClientPortalMeetingsPage() {
  const [clientId, setClientId] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void initialise();
  }, []);

  useEffect(() => {
    if (clientId) void loadMeetings(clientId);
  }, [clientId]);

  async function secureSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      window.location.href = "/login";
      throw new Error("Not authenticated.");
    }

    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aal?.currentLevel !== "aal2") {
      window.location.href = "/client-portal-mfa";
      throw new Error("Two-factor authentication is required.");
    }

    return session.access_token;
  }

  async function initialise() {
    try {
      const token = await secureSession();
      const res = await fetch("/api/client-portal/me", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Could not load portal.");
      }

      const options = json.clients || [json.client];
      setClients(options);
      setClientId(json.client?.id || options?.[0]?.id || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load portal.");
    }
  }

  async function loadMeetings(id: string) {
    try {
      const token = await secureSession();
      const res = await fetch(
        `/api/client-portal/meetings?client=${encodeURIComponent(id)}`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Could not load meetings.");
      }

      setMeetings(json.meetings || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load meetings.");
    }
  }

  async function toggle(action: Action) {
    if (action.assigned_to_type !== "client") return;

    const token = await secureSession();
    const res = await fetch("/api/client-portal/meetings", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        action_id: action.id,
        completed: action.status !== "completed",
      }),
    });

    const json = await res.json();
    if (!res.ok || !json?.success) {
      setError(json?.error || "Could not update action.");
      return;
    }

    await loadMeetings(clientId);
  }

  return (
    <main style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>PracticePilot</div>

        <button
          type="button"
          style={styles.nav}
          onClick={() => window.location.assign("/client-portal")}
        >
          Dashboard
        </button>

        <button
          type="button"
          style={styles.nav}
          onClick={() =>
            window.location.assign("/client-portal?view=documents")
          }
        >
          Documents
        </button>

        <button
          type="button"
          style={styles.nav}
          onClick={() =>
            window.location.assign("/client-portal/messages")
          }
        >
          Messages
        </button>

        <button type="button" style={styles.navActive}>
          Meetings
        </button>

        <button
          type="button"
          style={styles.nav}
          onClick={() =>
            window.location.assign("/client-portal?view=requests")
          }
        >
          Requests
        </button>
      </aside>

      <section style={styles.main}>
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>CLIENT PORTAL</div>
            <h1 style={styles.title}>Meetings & Actions</h1>
            <p style={styles.subtitle}>
              Shared meeting minutes and agreed action items.
            </p>
          </div>

          {clients.length > 1 ? (
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              style={styles.select}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.client_name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}

        <div style={styles.list}>
          {meetings.length ? (
            meetings.map((meeting) => (
              <section key={meeting.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <strong style={styles.meetingTitle}>{meeting.title}</strong>
                    <div style={styles.meta}>
                      {meeting.meeting_at || "Date not captured"}
                      {meeting.meeting_type
                        ? ` · ${meeting.meeting_type}`
                        : ""}
                    </div>
                  </div>

                  <div style={styles.meta}>
                    {meeting.location || ""}
                  </div>
                </div>

                {meeting.attendees ? (
                  <div style={styles.attendees}>
                    <strong>Attendees:</strong> {meeting.attendees}
                  </div>
                ) : null}

                <div style={styles.minutes}>
                  {meeting.minutes_text || "No meeting minutes were captured."}
                </div>

                <div style={styles.actions}>
                  <strong style={styles.actionsTitle}>Action items</strong>

                  {(meeting.actions || []).length ? (
                    meeting.actions.map((action) => (
                      <label key={action.id} style={styles.actionRow}>
                        <input
                          type="checkbox"
                          checked={action.status === "completed"}
                          disabled={action.assigned_to_type !== "client"}
                          onChange={() => void toggle(action)}
                        />
                        <span
                          style={{
                            ...styles.actionText,
                            textDecoration:
                              action.status === "completed"
                                ? "line-through"
                                : "none",
                          }}
                        >
                          {action.action_text}
                        </span>
                        <span style={styles.owner}>
                          {action.assigned_to_type === "client"
                            ? "Your action"
                            : "Practice action"}
                        </span>
                        <span style={styles.due}>
                          {action.due_date || "No due date"}
                        </span>
                      </label>
                    ))
                  ) : (
                    <div style={styles.empty}>No action items.</div>
                  )}
                </div>
              </section>
            ))
          ) : (
            <div style={styles.empty}>No meeting minutes have been shared yet.</div>
          )}
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "220px minmax(0,1fr)",
    background: "#f4f7fa",
    color: "#10233a",
  },
  sidebar: {
    padding: "24px 12px",
    borderRight: "1px solid #dce4ec",
    background: "#ffffff",
  },
  brand: {
    padding: "0 10px 22px",
    fontSize: 20,
    fontWeight: 950,
  },
  nav: {
    width: "100%",
    height: 42,
    padding: "0 12px",
    border: "none",
    background: "transparent",
    textAlign: "left",
    fontSize: 10,
    fontWeight: 850,
    cursor: "pointer",
  },
  navActive: {
    width: "100%",
    height: 42,
    padding: "0 12px",
    border: "none",
    borderLeft: "3px solid #1768d2",
    background: "#eaf3ff",
    color: "#1768d2",
    textAlign: "left",
    fontSize: 10,
    fontWeight: 900,
  },
  main: {
    padding: "24px 28px 40px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 14,
  },
  eyebrow: {
    color: "#1768d2",
    fontSize: 8,
    fontWeight: 950,
  },
  title: {
    margin: "4px 0 0",
    fontSize: 28,
    fontWeight: 950,
  },
  subtitle: {
    margin: "5px 0 0",
    color: "#6d7c8c",
    fontSize: 10.5,
  },
  select: {
    height: 34,
    padding: "0 9px",
    border: "1px solid #cbd5e1",
  },
  list: {
    display: "grid",
    gap: 12,
  },
  card: {
    border: "1px solid #d6dfe8",
    background: "#ffffff",
  },
  cardHeader: {
    padding: "14px 16px",
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    borderBottom: "1px solid #e1e7ee",
  },
  meetingTitle: {
    fontSize: 14,
    fontWeight: 950,
  },
  meta: {
    marginTop: 3,
    color: "#6d7c8c",
    fontSize: 8.5,
  },
  attendees: {
    padding: "10px 16px 0",
    color: "#536579",
    fontSize: 9,
  },
  minutes: {
    padding: 16,
    whiteSpace: "pre-wrap",
    lineHeight: 1.6,
    fontSize: 10.5,
  },
  actions: {
    borderTop: "1px solid #e1e7ee",
    padding: 14,
  },
  actionsTitle: {
    fontSize: 11,
    fontWeight: 950,
  },
  actionRow: {
    minHeight: 40,
    display: "grid",
    gridTemplateColumns: "24px minmax(0,1fr) 100px 110px",
    gap: 8,
    alignItems: "center",
    borderBottom: "1px solid #e8edf2",
    fontSize: 9,
  },
  actionText: {
    color: "#10233a",
    fontWeight: 800,
  },
  owner: {
    color: "#5d6d7e",
  },
  due: {
    color: "#7d8996",
  },
  error: {
    marginBottom: 10,
    padding: 10,
    background: "#fff1f1",
    border: "1px solid #e4a0a0",
    color: "#9f1f1f",
    fontSize: 9,
  },
  empty: {
    padding: 20,
    color: "#7a8795",
    textAlign: "center",
    fontSize: 9,
  },
};
