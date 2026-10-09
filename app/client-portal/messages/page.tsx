"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { supabase } from "@/app/lib/supabase";

type ClientOption = {

  id: string;

  client_name: string;

};

type Message = {

  id: string;

  sender_type: "practice" | "client";

  sender_name: string | null;

  message_body: string;

  created_at: string;

};

export default function ClientPortalMessagesPage() {

  const [clientId, setClientId] = useState("");

  const [clients, setClients] = useState<ClientOption[]>([]);

  const [messages, setMessages] = useState<Message[]>([]);

  const [draft, setDraft] = useState("");

  const [error, setError] = useState("");

  useEffect(() => {

    void initialise();

  }, []);

  useEffect(() => {
    if (!clientId) return;

    void loadMessages(clientId);

    const refresh = () => {
      void refreshMessagesSilently(clientId);
    };

    const interval = window.setInterval(refresh, 2000);

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function refreshMessagesSilently(id: string) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      const res = await fetch(
        `/api/client-portal/messages?client=${encodeURIComponent(id)}`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!res.ok) return;

      const json = await res.json();

      if (json?.success) {
        setMessages(json.messages || []);
      }
    } catch (caught) {
      console.error("Could not auto-refresh portal messages:", caught);
    }
  }

  async function loadMessages(id: string) {

    try {

      const token = await secureSession();

      const res = await fetch(

        `/api/client-portal/messages?client=${encodeURIComponent(id)}`,

        {

          cache: "no-store",

          headers: { Authorization: `Bearer ${token}` },

        }

      );

      const json = await res.json();

      if (!res.ok || !json?.success) {

        throw new Error(json?.error || "Could not load messages.");

      }

      setMessages(json.messages || []);

    } catch (caught) {

      setError(caught instanceof Error ? caught.message : "Could not load messages.");

    }

  }

  async function send() {

    if (!draft.trim() || !clientId) return;

    const token = await secureSession();

    const res = await fetch("/api/client-portal/messages", {

      method: "POST",

      headers: {

        Authorization: `Bearer ${token}`,

        "Content-Type": "application/json",

      },

      body: JSON.stringify({

        client_id: clientId,

        message_body: draft.trim(),

      }),

    });

    const json = await res.json();

    if (!res.ok || !json?.success) {

      setError(json?.error || "Could not send message.");

      return;

    }

    setDraft("");

    await loadMessages(clientId);

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

        <button type="button" style={styles.navActive}>

          Messages

        </button>

        <button

          type="button"

          style={styles.nav}

          onClick={() =>

            window.location.assign("/client-portal/meetings")

          }

        >

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

            <h1 style={styles.title}>Messages</h1>

            <p style={styles.subtitle}>

              Secure messages between you and your accounting team.

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

        <div style={styles.panel}>

          <div style={styles.list}>

            {messages.length ? (

              messages.map((message) => (

                <div

                  key={message.id}

                  style={{

                    ...styles.row,

                    justifyContent:

                      message.sender_type === "client"

                        ? "flex-end"

                        : "flex-start",

                  }}

                >

                  <div

                    style={{

                      ...styles.bubble,

                      ...(message.sender_type === "client"

                        ? styles.clientBubble

                        : styles.practiceBubble),

                    }}

                  >

                    <strong style={styles.meta}>

                      {message.sender_type === "client"

                        ? "You"

                        : message.sender_name || "Your practice"}

                    </strong>

                    <div style={styles.body}>{message.message_body}</div>

                  </div>

                </div>

              ))

            ) : (

              <div style={styles.empty}>No messages yet.</div>

            )}

          </div>

          <div style={styles.composer}>

            <textarea

              value={draft}

              onChange={(e) => setDraft(e.target.value)}

              placeholder="Type your message..."

              style={styles.textarea}

            />

            <button type="button" style={styles.send} onClick={() => void send()}>

              Send Message

            </button>

          </div>

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

  panel: {

    border: "1px solid #d6dfe8",

    background: "#ffffff",

  },

  list: {

    minHeight: 420,

    maxHeight: 580,

    padding: 16,

    display: "grid",

    alignContent: "start",

    gap: 10,

    overflowY: "auto",

    background: "#f8fafc",

  },

  row: {

    display: "flex",

  },

  bubble: {

    maxWidth: "70%",

    padding: "10px 12px",

    borderRadius: 7,

    display: "grid",

    gap: 5,

  },

  clientBubble: {

    background: "#eaf3ff",

    border: "1px solid #a7c7ec",

  },

  practiceBubble: {

    background: "#ffffff",

    border: "1px solid #d1dae4",

  },

  meta: {

    color: "#627386",

    fontSize: 8.5,

  },

  body: {

    whiteSpace: "pre-wrap",

    fontSize: 10.5,

    lineHeight: 1.5,

  },

  composer: {

    padding: 12,

    display: "grid",

    gridTemplateColumns: "minmax(0,1fr) auto",

    gap: 10,

    borderTop: "1px solid #dce4ec",

  },

  textarea: {

    minHeight: 78,

    padding: 10,

    border: "1px solid #cbd5e1",

    resize: "vertical",

  },

  send: {

    alignSelf: "end",

    height: 38,

    padding: "0 14px",

    border: "1px solid #1768d2",

    background: "#1768d2",

    color: "#ffffff",

    fontSize: 9.5,

    fontWeight: 900,

    cursor: "pointer",

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
