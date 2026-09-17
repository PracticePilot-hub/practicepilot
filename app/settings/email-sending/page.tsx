"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

type Settings = {
  sender_name: string;
  sender_email: string;
  reply_to_email: string | null;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  encryption_mode: "none" | "starttls" | "ssl";
  is_active: boolean;
  last_test_status: string | null;
  last_tested_at: string | null;
  last_test_message: string | null;
  password_configured: boolean;
};

export default function EmailSendingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [replyToEmail, setReplyToEmail] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [encryptionMode, setEncryptionMode] = useState<
    "none" | "starttls" | "ssl"
  >("starttls");
  const [isActive, setIsActive] = useState(true);

  const [testEmail, setTestEmail] = useState("");
  const [lastTestStatus, setLastTestStatus] = useState<string | null>(null);
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);
  const [lastTestMessage, setLastTestMessage] = useState<string | null>(null);

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

      const response = await fetch("/api/settings/email-sending", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not load email settings.");
      }

      const settings = result.settings as Settings | null;

      if (settings) {
        setSenderName(settings.sender_name || "");
        setSenderEmail(settings.sender_email || "");
        setReplyToEmail(settings.reply_to_email || "");
        setSmtpHost(settings.smtp_host || "");
        setSmtpPort(String(settings.smtp_port || 587));
        setSmtpUsername(settings.smtp_username || "");
        setPasswordConfigured(settings.password_configured === true);
        setEncryptionMode(settings.encryption_mode || "starttls");
        setIsActive(settings.is_active !== false);
        setLastTestStatus(settings.last_test_status || null);
        setLastTestedAt(settings.last_tested_at || null);
        setLastTestMessage(settings.last_test_message || null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load email settings."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function payload(action: "save" | "test") {
    return {
      action,
      senderName,
      senderEmail,
      replyToEmail,
      smtpHost,
      smtpPort: Number(smtpPort || 587),
      smtpUsername,
      smtpPassword,
      encryptionMode,
      isActive,
      testEmail,
    };
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const token = await getToken();

      const response = await fetch("/api/settings/email-sending", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload("save")),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not save email settings.");
      }

      setMessage("Outgoing email settings saved.");
      setPasswordConfigured(true);
      setSmtpPassword("");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save email settings."
      );
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setError("");
    setMessage("");

    try {
      const token = await getToken();

      const response = await fetch("/api/settings/email-sending", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload("test")),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Email test failed.");
      }

      setMessage(result.message || "Test email sent.");
      setLastTestStatus("success");
      setLastTestedAt(new Date().toISOString());
      setLastTestMessage(result.message || "Test email sent successfully.");
    } catch (err) {
      const text = err instanceof Error ? err.message : "Email test failed.";
      setError(text);
      setLastTestStatus("failed");
      setLastTestedAt(new Date().toISOString());
      setLastTestMessage(text);
    } finally {
      setTesting(false);
    }
  }

  return (
    <main style={page}>
      <section style={header}>
        <div>
          <h1 style={title}>Email Sending</h1>
          <p style={subtitle}>
            Configure the outgoing mailbox PracticePilot uses when emailing your clients.
          </p>
        </div>
      </section>

      {error ? <div style={errorBar}>{error}</div> : null}
      {message ? <div style={messageBar}>{message}</div> : null}

      <section style={panel}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>Sender Details</h2>
            <p style={sectionSubtitle}>
              This is the identity your clients will see in their inbox.
            </p>
          </div>
        </div>

        <div style={formGrid}>
          <label style={field}>
            <span style={label}>Sender name</span>
            <input
              value={senderName}
              onChange={(event) => setSenderName(event.target.value)}
              style={input}
              placeholder="e.g. Bizzacc Menlyn"
            />
          </label>

          <label style={field}>
            <span style={label}>Sender email</span>
            <input
              type="email"
              value={senderEmail}
              onChange={(event) => setSenderEmail(event.target.value)}
              style={input}
              placeholder="menlyn.engage@bizzacc.co.za"
            />
          </label>

          <label style={fieldWide}>
            <span style={label}>Reply-to email</span>
            <input
              type="email"
              value={replyToEmail}
              onChange={(event) => setReplyToEmail(event.target.value)}
              style={input}
              placeholder="Optional — defaults to sender email"
            />
          </label>
        </div>
      </section>

      <section style={panel}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>Outgoing Mail Server</h2>
            <p style={sectionSubtitle}>
              Use the SMTP details supplied by your email provider.
            </p>
          </div>

          <label style={activeToggle}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            <span>Use this account</span>
          </label>
        </div>

        <div style={serverGrid}>
          <label style={field}>
            <span style={label}>SMTP host</span>
            <input
              value={smtpHost}
              onChange={(event) => setSmtpHost(event.target.value)}
              style={input}
              placeholder="smtp.example.com"
            />
          </label>

          <label style={field}>
            <span style={label}>Port</span>
            <input
              type="number"
              value={smtpPort}
              onChange={(event) => setSmtpPort(event.target.value)}
              style={input}
            />
          </label>

          <label style={field}>
            <span style={label}>Encryption</span>
            <select
              value={encryptionMode}
              onChange={(event) =>
                setEncryptionMode(
                  event.target.value as "none" | "starttls" | "ssl"
                )
              }
              style={input}
            >
              <option value="starttls">STARTTLS / TLS</option>
              <option value="ssl">SSL</option>
              <option value="none">None</option>
            </select>
          </label>

          <label style={field}>
            <span style={label}>SMTP username</span>
            <input
              value={smtpUsername}
              onChange={(event) => setSmtpUsername(event.target.value)}
              style={input}
              placeholder="Usually the email address"
            />
          </label>

          <label style={fieldWide}>
            <span style={label}>SMTP password</span>
            <input
              type="password"
              value={smtpPassword}
              onChange={(event) => setSmtpPassword(event.target.value)}
              style={input}
              placeholder={
                passwordConfigured
                  ? "Password already saved — leave blank to keep it"
                  : "Enter mailbox password / app password"
              }
            />
            <span style={hint}>
              The password is encrypted before it is stored. It is never returned to the browser.
            </span>
          </label>
        </div>

        <div style={actions}>
          <button
            type="button"
            onClick={save}
            style={primaryButton}
            disabled={saving || loading}
          >
            {saving ? "Saving..." : "Save Email Account"}
          </button>
        </div>
      </section>

      <section style={panel}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>Test Connection</h2>
            <p style={sectionSubtitle}>
              Send a real test email before PracticePilot starts using this mailbox.
            </p>
          </div>

          {lastTestStatus ? (
            <span
              style={{
                ...testStatus,
                ...(lastTestStatus === "success"
                  ? testStatusSuccess
                  : testStatusFailed),
              }}
            >
              {lastTestStatus === "success" ? "Working" : "Failed"}
            </span>
          ) : null}
        </div>

        <div style={testRow}>
          <label style={field}>
            <span style={label}>Send test to</span>
            <input
              type="email"
              value={testEmail}
              onChange={(event) => setTestEmail(event.target.value)}
              style={input}
              placeholder="Your email address"
            />
          </label>

          <button
            type="button"
            onClick={testConnection}
            style={secondaryButton}
            disabled={testing || loading}
          >
            {testing ? "Testing..." : "Send Test Email"}
          </button>
        </div>

        {lastTestedAt ? (
          <div style={testHistory}>
            <strong>Last test:</strong>{" "}
            {new Date(lastTestedAt).toLocaleString("en-ZA")}
            {lastTestMessage ? ` · ${lastTestMessage}` : ""}
          </div>
        ) : null}
      </section>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100%",
  padding: "16px 20px 32px",
  background: "#eef2f5",
  color: "#10233a",
};

const header: React.CSSProperties = {
  minHeight: "78px",
  padding: "12px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: "20px",
  fontWeight: 950,
};

const subtitle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#64748b",
  fontSize: "10px",
};

const panel: React.CSSProperties = {
  marginTop: "10px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const sectionHeader: React.CSSProperties = {
  minHeight: "56px",
  padding: "9px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  borderBottom: "1px solid #d8dee7",
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "13px",
  fontWeight: 900,
};

const sectionSubtitle: React.CSSProperties = {
  margin: "3px 0 0",
  color: "#64748b",
  fontSize: "8px",
};

const formGrid: React.CSSProperties = {
  padding: "12px",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px",
};

const serverGrid: React.CSSProperties = {
  padding: "12px",
  display: "grid",
  gridTemplateColumns: "1.3fr .55fr .8fr 1.3fr",
  gap: "10px",
};

const field: React.CSSProperties = {
  display: "grid",
  gap: "4px",
};

const fieldWide: React.CSSProperties = {
  ...field,
  gridColumn: "1 / -1",
};

const label: React.CSSProperties = {
  color: "#526174",
  fontSize: "8px",
  fontWeight: 850,
};

const input: React.CSSProperties = {
  width: "100%",
  height: "32px",
  boxSizing: "border-box",
  padding: "0 8px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "9px",
};

const hint: React.CSSProperties = {
  color: "#64748b",
  fontSize: "7.5px",
};

const activeToggle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  color: "#526174",
  fontSize: "8px",
  fontWeight: 850,
};

const actions: React.CSSProperties = {
  padding: "0 12px 12px",
  display: "flex",
  justifyContent: "flex-end",
};

const primaryButton: React.CSSProperties = {
  height: "30px",
  padding: "0 11px",
  border: "1px solid #1758d5",
  background: "#1758d5",
  color: "#ffffff",
  fontSize: "8px",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  height: "32px",
  padding: "0 12px",
  border: "1px solid #10233a",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "8px",
  fontWeight: 900,
  cursor: "pointer",
};

const testRow: React.CSSProperties = {
  padding: "12px",
  display: "grid",
  gridTemplateColumns: "minmax(280px, 1fr) 150px",
  gap: "10px",
  alignItems: "end",
};

const testStatus: React.CSSProperties = {
  minHeight: "22px",
  padding: "0 8px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "11px",
  fontSize: "7.5px",
  fontWeight: 900,
};

const testStatusSuccess: React.CSSProperties = {
  background: "#ecfdf3",
  color: "#166534",
};

const testStatusFailed: React.CSSProperties = {
  background: "#fff1f2",
  color: "#b42318",
};

const testHistory: React.CSSProperties = {
  padding: "0 12px 12px",
  color: "#64748b",
  fontSize: "8px",
};

const errorBar: React.CSSProperties = {
  marginTop: "8px",
  padding: "8px 10px",
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontSize: "9px",
  fontWeight: 800,
};

const messageBar: React.CSSProperties = {
  marginTop: "8px",
  padding: "8px 10px",
  border: "1px solid #bbf7d0",
  background: "#ecfdf3",
  color: "#166534",
  fontSize: "9px",
  fontWeight: 800,
};
