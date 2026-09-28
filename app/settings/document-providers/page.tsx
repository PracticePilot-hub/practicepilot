"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { supabase } from "@/app/lib/supabase";

type ProviderSettings = {
  id: string | null;
  provider: "egnyte";
  display_name: string;
  provider_domain: string;
  provider_base_url: string;
  root_folder_path: string;
  client_id: string;
  is_active: boolean;
  is_default: boolean;
  has_client_secret: boolean;
  has_access_token: boolean;
  connection_status: string;
  last_test_status: string | null;
  last_test_message: string | null;
  last_tested_at: string | null;
};

type ConnectionResult = {
  connected_user?: {
    username?: string | null;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    user_type?: string | null;
  } | null;
  root?: {
    path?: string | null;
    folder_count?: number;
    file_count?: number;
  } | null;
};

const emptySettings: ProviderSettings = {
  id: null,
  provider: "egnyte",
  display_name: "Egnyte",
  provider_domain: "",
  provider_base_url: "",
  root_folder_path: "/Shared",
  client_id: "",
  is_active: true,
  is_default: true,
  has_client_secret: false,
  has_access_token: false,
  connection_status: "Not connected",
  last_test_status: null,
  last_test_message: null,
  last_tested_at: null,
};

export default function DocumentProvidersPage() {
  const [settings, setSettings] =
    useState<ProviderSettings>(emptySettings);

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const [egnyteUsername, setEgnyteUsername] = useState("");
  const [egnytePassword, setEgnytePassword] = useState("");

  const [connectionResult, setConnectionResult] =
    useState<ConnectionResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function authFetch(url: string, options?: RequestInit) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error(
        "Your PracticePilot login session could not be confirmed."
      );
    }

    const response = await fetch(url, {
      ...options,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        ...(options?.headers || {}),
      },
    });

    const result = await response.json();

    if (!response.ok || !result?.success) {
      throw new Error(result?.error || "Request failed.");
    }

    return result;
  }

  async function loadSettings() {
    const result = await authFetch(
      "/api/settings/document-providers"
    );

    setSettings({
      ...emptySettings,
      ...(result.provider || {}),
    });

    setClientId(
      String(result.provider?.client_id || "")
    );
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        await loadSettings();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load document provider settings."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  async function saveSettings() {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const result = await authFetch(
        "/api/settings/document-providers",
        {
          method: "POST",
          body: JSON.stringify({
            provider: "egnyte",
            display_name: settings.display_name || "Egnyte",
            provider_domain:
              settings.provider_domain.trim(),
            root_folder_path:
              settings.root_folder_path.trim() || "/Shared",
            client_id: clientId.trim(),
            client_secret: clientSecret,
            is_active: settings.is_active,
            is_default: true,
          }),
        }
      );

      setSettings({
        ...emptySettings,
        ...(result.provider || {}),
      });

      setClientId(
        String(result.provider?.client_id || "")
      );

      setClientSecret("");
      setNotice("Egnyte settings saved.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save the Egnyte settings."
      );
    } finally {
      setSaving(false);
    }
  }

  async function connectEgnyte() {
    if (!egnyteUsername.trim()) {
      setError("Enter Egnyte username / email.");
      return;
    }

    if (!egnytePassword) {
      setError("Enter Egnyte password.");
      return;
    }

    setConnecting(true);
    setError("");
    setNotice("");
    setConnectionResult(null);

    try {
      const result = await authFetch(
        "/api/settings/document-providers/connect",
        {
          method: "POST",
          body: JSON.stringify({
            action: "connect",
            username: egnyteUsername.trim(),
            password: egnytePassword,
          }),
        }
      );

      setConnectionResult({
        connected_user: result.connected_user || null,
        root: result.root || null,
      });

      setEgnytePassword("");
      setNotice(
        "Egnyte connected successfully. The password was used only to obtain the token and was not stored."
      );

      await loadSettings();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not connect to Egnyte."
      );
    } finally {
      setConnecting(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setError("");
    setNotice("");
    setConnectionResult(null);

    try {
      const result = await authFetch(
        "/api/settings/document-providers/connect",
        {
          method: "POST",
          body: JSON.stringify({
            action: "test",
          }),
        }
      );

      setConnectionResult({
        connected_user: result.connected_user || null,
        root: result.root || null,
      });

      setNotice("Egnyte connection test passed.");

      await loadSettings();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Egnyte connection test failed."
      );
    } finally {
      setTesting(false);
    }
  }

  const connected =
    settings.has_access_token &&
    settings.last_test_status !== "failed";

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <Link href="/settings" style={styles.backLink}>
            ← Settings
          </Link>

          <h1 style={styles.title}>
            Document Providers
          </h1>

          <p style={styles.subtitle}>
            Connect the practice document store used by CRM,
            staff workflows and the client portal.
          </p>
        </div>

        <div style={styles.statusBlock}>
          <span style={styles.statusLabel}>Egnyte</span>

          <strong
            style={{
              ...styles.statusValue,
              ...(connected
                ? styles.statusConnected
                : styles.statusNotConnected),
            }}
          >
            {connected ? "Connected" : "Not connected"}
          </strong>
        </div>
      </section>

      {loading ? (
        <section style={styles.panel}>
          Loading document provider settings...
        </section>
      ) : (
        <>
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Egnyte</h2>

                <p style={styles.panelText}>
                  PracticePilot uses the permissions of the Egnyte account authorised below when browsing and uploading documents.
                </p>
              </div>

              <label style={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={settings.is_active}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      is_active: event.target.checked,
                    }))
                  }
                />
                Active
              </label>
            </div>

            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>
                  Egnyte domain
                </span>

                <input
                  value={settings.provider_domain}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      provider_domain: event.target.value,
                    }))
                  }
                  placeholder="bizzaccmenlyn"
                  style={styles.input}
                />

                <span style={styles.help}>
                  Domain only, without .egnyte.com.
                </span>
              </label>

              <label style={styles.field}>
                <span style={styles.fieldLabel}>
                  Default root folder
                </span>

                <input
                  value={settings.root_folder_path}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      root_folder_path: event.target.value,
                    }))
                  }
                  placeholder="/Shared"
                  style={styles.input}
                />

                <span style={styles.help}>
                  Keep /Shared so PP can use both Entities and
                  Individuals.
                </span>
              </label>

              <label style={styles.field}>
                <span style={styles.fieldLabel}>
                  Egnyte API Client ID
                </span>

                <input
                  value={clientId}
                  onChange={(event) =>
                    setClientId(event.target.value)
                  }
                  placeholder="API Client ID"
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.fieldLabel}>
                  Egnyte Client Secret
                </span>

                <input
                  type="password"
                  value={clientSecret}
                  onChange={(event) =>
                    setClientSecret(event.target.value)
                  }
                  placeholder={
                    settings.has_client_secret
                      ? "Saved securely — leave blank to keep current secret"
                      : "Enter Client Secret"
                  }
                  style={styles.input}
                />

                <span style={styles.help}>
                  Stored encrypted and never returned to the
                  browser.
                </span>
              </label>
            </div>

            <div style={styles.actions}>
              <button
                type="button"
                onClick={() => void saveSettings()}
                disabled={saving}
                style={{
                  ...styles.primaryButton,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving
                  ? "Saving..."
                  : "Save Egnyte Settings"}
              </button>
            </div>
          </section>

          <section style={styles.connectionPanel}>
            <div style={styles.connectionHeader}>
              <div>
                <h2 style={styles.panelTitle}>
                  Connect Egnyte
                </h2>

                <p style={styles.panelText}>
                  The selected Egnyte account password is used once to exchange for an access token. PP stores the token encrypted and does not store the password.
                </p>
              </div>

              {settings.has_access_token ? (
                <span style={styles.connectedPill}>
                  Token saved
                </span>
              ) : null}
            </div>

            <div style={styles.connectionGrid}>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>
                  Egnyte username / email
                </span>

                <input
                  value={egnyteUsername}
                  onChange={(event) =>
                    setEgnyteUsername(event.target.value)
                  }
                  autoComplete="username"
                  placeholder="account@practice.co.za"
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.fieldLabel}>
                  Egnyte password
                </span>

                <input
                  type="password"
                  value={egnytePassword}
                  onChange={(event) =>
                    setEgnytePassword(event.target.value)
                  }
                  autoComplete="current-password"
                  placeholder="Used once — not stored"
                  style={styles.input}
                />
              </label>
            </div>

            <div style={styles.connectionActions}>
              <button
                type="button"
                onClick={() => void connectEgnyte()}
                disabled={
                  connecting ||
                  !settings.has_client_secret ||
                  !clientId
                }
                style={{
                  ...styles.primaryButton,
                  opacity:
                    connecting ||
                    !settings.has_client_secret ||
                    !clientId
                      ? 0.55
                      : 1,
                }}
              >
                {connecting
                  ? "Connecting..."
                  : settings.has_access_token
                    ? "Reconnect Egnyte"
                    : "Connect Egnyte"}
              </button>

              <button
                type="button"
                onClick={() => void testConnection()}
                disabled={
                  testing || !settings.has_access_token
                }
                style={{
                  ...styles.secondaryActionButton,
                  opacity:
                    testing || !settings.has_access_token
                      ? 0.55
                      : 1,
                }}
              >
                {testing
                  ? "Testing..."
                  : "Test Connection"}
              </button>
            </div>

            {connectionResult ? (
              <div style={styles.resultGrid}>
                <div style={styles.resultCell}>
                  <span style={styles.resultLabel}>
                    Connected user
                  </span>

                  <strong style={styles.resultValue}>
                    {connectionResult.connected_user?.email ||
                      connectionResult.connected_user?.username ||
                      "Connected"}
                  </strong>

                  <span style={styles.resultMeta}>
                    {connectionResult.connected_user?.user_type ||
                      "Egnyte user"}
                  </span>
                </div>

                <div style={styles.resultCell}>
                  <span style={styles.resultLabel}>
                    Root folder
                  </span>

                  <strong style={styles.resultValue}>
                    {connectionResult.root?.path ||
                      settings.root_folder_path ||
                      "/Shared"}
                  </strong>

                  <span style={styles.resultMeta}>
                    {connectionResult.root?.folder_count ?? 0}{" "}
                    folders ·{" "}
                    {connectionResult.root?.file_count ?? 0}{" "}
                    files
                  </span>
                </div>
              </div>
            ) : null}

            {settings.last_tested_at ? (
              <div style={styles.lastTest}>
                Last test:{" "}
                {new Date(
                  settings.last_tested_at
                ).toLocaleString("en-ZA")}{" "}
                ·{" "}
                {settings.last_test_status || "unknown"}
                {settings.last_test_message
                  ? ` · ${settings.last_test_message}`
                  : ""}
              </div>
            ) : null}

            {error ? (
              <div style={styles.errorBar}>{error}</div>
            ) : null}

            {notice ? (
              <div style={styles.noticeBar}>{notice}</div>
            ) : null}
          </section>

          <section style={styles.nextPanel}>
            <div>
              <strong>Client folder mapping</strong>
              <span>
                Link each PracticePilot client to its real Egnyte folder once.
                PracticePilot will then use that mapping for browsing, uploads,
                review and the client portal.
              </span>
            </div>

            <Link
              href="/settings/document-providers/client-folders"
              style={styles.mapFoldersButton}
            >
              Map Client Folders
            </Link>
          </section>
        </>
      )}
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fa",
    padding: "18px 20px 32px",
    color: "#10233a",
  },

  header: {
    minHeight: 82,
    padding: "12px 4px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    borderTop: "3px solid #10233a",
    borderBottom: "1px solid #d8dee7",
  },

  backLink: {
    color: "#1758d5",
    textDecoration: "none",
    fontSize: 9,
    fontWeight: 900,
  },

  title: {
    margin: "5px 0 0",
    fontSize: 20,
    fontWeight: 950,
    lineHeight: 1,
  },

  subtitle: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 9,
  },

  statusBlock: {
    minWidth: 150,
    display: "grid",
    gap: 4,
    justifyItems: "end",
  },

  statusLabel: {
    color: "#64748b",
    fontSize: 8,
    fontWeight: 850,
  },

  statusValue: {
    padding: "5px 8px",
    fontSize: 8.5,
    fontWeight: 900,
  },

  statusConnected: {
    background: "#ecfdf3",
    color: "#166534",
    border: "1px solid #bbf7d0",
  },

  statusNotConnected: {
    background: "#fff7ed",
    color: "#9a6700",
    border: "1px solid #fed7aa",
  },

  panel: {
    marginTop: 10,
    background: "#ffffff",
    border: "1px solid #d8dee7",
  },

  panelHeader: {
    minHeight: 62,
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderBottom: "1px solid #e2e8f0",
  },

  panelTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 950,
  },

  panelText: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 9,
  },

  toggleLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "#334155",
    fontSize: 9,
    fontWeight: 850,
  },

  formGrid: {
    padding: 12,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },

  field: {
    display: "grid",
    gap: 4,
  },

  fieldLabel: {
    color: "#334155",
    fontSize: 8.5,
    fontWeight: 900,
  },

  input: {
    width: "100%",
    height: 32,
    boxSizing: "border-box",
    padding: "0 8px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 9.5,
  },

  help: {
    color: "#64748b",
    fontSize: 7.8,
    lineHeight: 1.35,
  },

  actions: {
    padding: "0 12px 12px",
    display: "flex",
    gap: 8,
  },

  primaryButton: {
    height: 32,
    padding: "0 12px",
    border: "1px solid #1758d5",
    background: "#1758d5",
    color: "#ffffff",
    fontSize: 9,
    fontWeight: 900,
    cursor: "pointer",
  },

  connectionPanel: {
    marginTop: 8,
    background: "#ffffff",
    border: "1px solid #d8dee7",
  },

  connectionHeader: {
    minHeight: 58,
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #e2e8f0",
  },

  connectedPill: {
    padding: "5px 8px",
    border: "1px solid #bbf7d0",
    background: "#ecfdf3",
    color: "#166534",
    fontSize: 8,
    fontWeight: 900,
  },

  connectionGrid: {
    padding: 12,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },

  connectionActions: {
    padding: "0 12px 12px",
    display: "flex",
    gap: 8,
  },

  secondaryActionButton: {
    height: 32,
    padding: "0 12px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 9,
    fontWeight: 900,
    cursor: "pointer",
  },

  resultGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    borderTop: "1px solid #e2e8f0",
  },

  resultCell: {
    minHeight: 64,
    padding: "9px 12px",
    display: "grid",
    alignContent: "center",
    gap: 3,
    borderRight: "1px solid #e2e8f0",
  },

  resultLabel: {
    color: "#64748b",
    fontSize: 8,
    fontWeight: 850,
  },

  resultValue: {
    color: "#10233a",
    fontSize: 10,
    fontWeight: 900,
  },

  resultMeta: {
    color: "#64748b",
    fontSize: 8,
  },

  lastTest: {
    padding: "8px 12px",
    borderTop: "1px solid #e2e8f0",
    color: "#64748b",
    fontSize: 8,
  },

  errorBar: {
    margin: "10px 12px 0",
    padding: "8px 10px",
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b42318",
    fontSize: 8.5,
    fontWeight: 850,
  },

  noticeBar: {
    margin: "10px 12px 12px",
    padding: "8px 10px",
    border: "1px solid #bbf7d0",
    background: "#ecfdf3",
    color: "#166534",
    fontSize: 8.5,
    fontWeight: 850,
  },

  nextPanel: {
    marginTop: 8,
    padding: "9px 11px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: "#eef5ff",
    border: "1px solid #cfe0f5",
    color: "#173158",
    fontSize: 8.5,
  },

  mapFoldersButton: {
    height: 32,
    padding: "0 12px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    background: "#1758d5",
    border: "1px solid #1758d5",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 9,
    fontWeight: 900,
  },
};
