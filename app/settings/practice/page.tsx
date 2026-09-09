"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

type PracticeSettings = {
  organisation_id?: string;
  firm_name: string;
  trading_name: string;
  logo_url: string;
  address_lines: string;
  telephone: string;
  email: string;
  website: string;

  authorised_signatory_name: string;
  authorised_signatory_professional_designation: string;
  authorised_signatory_registration_number: string;
  authorised_signatory_position: string;
  authorised_signatory_signature_url: string;

  governing_body_name: string;
  governing_body_registration_number: string;
  governing_body_logo_url: string;

  second_governing_body_name: string;
  second_governing_body_registration_number: string;
  second_governing_body_logo_url: string;

  footer_text: string;
  footer_logo_url: string;
};

const emptySettings: PracticeSettings = {
  firm_name: "",
  trading_name: "",
  logo_url: "",
  address_lines: "",
  telephone: "",
  email: "",
  website: "",
  authorised_signatory_name: "",
  authorised_signatory_professional_designation: "",
  authorised_signatory_registration_number: "",
  authorised_signatory_position: "",
  authorised_signatory_signature_url: "",
  governing_body_name: "",
  governing_body_registration_number: "",
  governing_body_logo_url: "",
  second_governing_body_name: "",
  second_governing_body_registration_number: "",
  second_governing_body_logo_url: "",
  footer_text: "",
  footer_logo_url: "",
};

export default function PracticeDetailsSettingsPage() {
  const [settings, setSettings] = useState<PracticeSettings>(emptySettings);
  const [organisationName, setOrganisationName] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  useEffect(() => {
    async function loadSettings() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const token = session?.access_token;
        if (!token) throw new Error("No active session.");

        const response = await fetch("/api/settings/practice", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Could not load practice settings.");
        }

        setOrganisationName(result.organisation?.name || "");
        setCanManage(Boolean(result.canManage));
        setSettings({
          ...emptySettings,
          ...(result.settings || {}),
        });
      } catch (error) {
        console.error("PRACTICE SETTINGS LOAD ERROR:", error);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  function updateField(key: keyof PracticeSettings, nextValue: string) {
    setSettings((current) => ({
      ...current,
      [key]: nextValue,
    }));
  }

  async function saveSettings() {
    if (!supabase || !canManage) return;

    setSaveStatus("saving");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (!token) throw new Error("No active session.");

      const response = await fetch("/api/settings/practice", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not save practice settings.");
      }

      setSettings({
        ...emptySettings,
        ...(result.settings || {}),
      });

      setSaveStatus("saved");
      window.setTimeout(() => {
        setSaveStatus((current) => (current === "saved" ? "idle" : current));
      }, 1600);
    } catch (error) {
      console.error("PRACTICE SETTINGS SAVE ERROR:", error);
      setSaveStatus("error");
    }
  }

  const addressLines = useMemo(
    () =>
      settings.address_lines
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean),
    [settings.address_lines],
  );

  const practiceDisplayName =
    settings.trading_name ||
    settings.firm_name ||
    organisationName ||
    "Practice name";

  const professionalLine = [
    settings.authorised_signatory_professional_designation,
    settings.authorised_signatory_registration_number,
  ]
    .filter(Boolean)
    .join(" - ");

  if (loading) {
    return (
      <main style={styles.page}>
        <section style={styles.loadingPanel}>Loading practice settings...</section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div style={styles.kicker}>PRACTICEPILOT SETTINGS</div>
          <h1 style={styles.title}>Practice Details & Letterhead</h1>
          <p style={styles.subtitle}>
            Shared practice identity, letterhead, authorised signatory and professional-body details used across PracticePilot.
          </p>
        </div>

        <Link href="/settings" style={styles.backButton}>
          Back to Settings
        </Link>
      </section>

      <section style={styles.contentStack}>
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Practice identity</h2>
              <p style={styles.panelHint}>
                These details belong to the practice, not to AFS or an individual user.
              </p>
            </div>
          </div>

          <div style={styles.twoColumnGrid}>
            <Field
              label="Legal firm name"
              value={settings.firm_name}
              onChange={(v) => updateField("firm_name", v)}
              disabled={!canManage}
            />
            <Field
              label="Trading name"
              value={settings.trading_name}
              onChange={(v) => updateField("trading_name", v)}
              disabled={!canManage}
            />
          </div>

          <Field
            label="Logo URL"
            value={settings.logo_url}
            onChange={(v) => updateField("logo_url", v)}
            disabled={!canManage}
            help="Existing AFS logo has been migrated here. Upload control comes next; for now do not change this URL unless necessary."
          />

          <label style={styles.field}>
            <span style={styles.label}>Address lines</span>
            <textarea
              style={styles.textarea}
              value={settings.address_lines}
              onChange={(event) => updateField("address_lines", event.target.value)}
              disabled={!canManage}
              placeholder={"81 Kafue Street\nLynnwood Glen\nPretoria"}
            />
          </label>

          <div style={styles.threeColumnGrid}>
            <Field label="Telephone" value={settings.telephone} onChange={(v) => updateField("telephone", v)} disabled={!canManage} />
            <Field label="Email" value={settings.email} onChange={(v) => updateField("email", v)} disabled={!canManage} />
            <Field label="Website" value={settings.website} onChange={(v) => updateField("website", v)} disabled={!canManage} />
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Default authorised signatory</h2>
              <p style={styles.panelHint}>
                Used on practice-issued letters and future client self-service documents.
              </p>
            </div>
          </div>

          <div style={styles.twoColumnGrid}>
            <Field
              label="Name"
              value={settings.authorised_signatory_name}
              onChange={(v) => updateField("authorised_signatory_name", v)}
              disabled={!canManage}
              placeholder="Sarel FS van Aswegen"
            />
            <Field
              label="Position / title"
              value={settings.authorised_signatory_position}
              onChange={(v) => updateField("authorised_signatory_position", v)}
              disabled={!canManage}
              placeholder="CEO"
            />
          </div>

          <div style={styles.twoColumnGrid}>
            <Field
              label="Professional designation"
              value={settings.authorised_signatory_professional_designation}
              onChange={(v) => updateField("authorised_signatory_professional_designation", v)}
              disabled={!canManage}
              placeholder="Professional Accountant (SA)"
            />
            <Field
              label="Professional registration number"
              value={settings.authorised_signatory_registration_number}
              onChange={(v) => updateField("authorised_signatory_registration_number", v)}
              disabled={!canManage}
              placeholder="28289"
            />
          </div>

          <Field
            label="Digital signature URL"
            value={settings.authorised_signatory_signature_url}
            onChange={(v) => updateField("authorised_signatory_signature_url", v)}
            disabled={!canManage}
            help="Upload control will be added after this shared settings page is signed off."
          />
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Professional / governing bodies</h2>
              <p style={styles.panelHint}>
                Shared across reports and letters where professional credentials are shown.
              </p>
            </div>
          </div>

          <div style={styles.twoColumnGrid}>
            <Field label="Governing body" value={settings.governing_body_name} onChange={(v) => updateField("governing_body_name", v)} disabled={!canManage} />
            <Field label="Registration number" value={settings.governing_body_registration_number} onChange={(v) => updateField("governing_body_registration_number", v)} disabled={!canManage} />
          </div>

          <Field label="Governing body logo URL" value={settings.governing_body_logo_url} onChange={(v) => updateField("governing_body_logo_url", v)} disabled={!canManage} />

          <div style={styles.twoColumnGrid}>
            <Field label="Second governing body" value={settings.second_governing_body_name} onChange={(v) => updateField("second_governing_body_name", v)} disabled={!canManage} />
            <Field label="Second registration number" value={settings.second_governing_body_registration_number} onChange={(v) => updateField("second_governing_body_registration_number", v)} disabled={!canManage} />
          </div>

          <Field label="Second governing body logo URL" value={settings.second_governing_body_logo_url} onChange={(v) => updateField("second_governing_body_logo_url", v)} disabled={!canManage} />
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Footer branding</h2>
              <p style={styles.panelHint}>
                Optional shared footer text or strip for practice-issued documents.
              </p>
            </div>
          </div>

          <label style={styles.field}>
            <span style={styles.label}>Footer text</span>
            <textarea
              style={styles.textareaSmall}
              value={settings.footer_text}
              onChange={(event) => updateField("footer_text", event.target.value)}
              disabled={!canManage}
              placeholder="Optional footer text"
            />
          </label>

          <Field label="Footer logo / strip URL" value={settings.footer_logo_url} onChange={(v) => updateField("footer_logo_url", v)} disabled={!canManage} />
        </section>

        <section style={styles.previewPanel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Letterhead preview</h2>
              <p style={styles.panelHint}>
                This will become the common PracticePilot document letterhead.
              </p>
            </div>

            {canManage ? (
              <button
                type="button"
                style={styles.saveButton}
                onClick={saveSettings}
                disabled={saveStatus === "saving"}
              >
                {saveStatus === "saving"
                  ? "Saving..."
                  : saveStatus === "saved"
                    ? "Saved"
                    : "Save practice settings"}
              </button>
            ) : null}
          </div>

          <div style={styles.previewPage}>
            <div style={styles.previewHeader}>
              <div style={styles.previewLogoBox}>
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="Practice logo" style={styles.previewLogo} />
                ) : (
                  <span>LOGO</span>
                )}
              </div>

              <div style={styles.previewContact}>
                <strong>{practiceDisplayName}</strong>
                {addressLines.map((line) => <span key={line}>{line}</span>)}
                {settings.telephone ? <span>Tel: {settings.telephone}</span> : null}
                {settings.email ? <span>Email: {settings.email}</span> : null}
                {settings.website ? <span>{settings.website}</span> : null}
              </div>
            </div>

            <div style={styles.previewRule} />

            <div style={styles.previewBody}>
              <strong>Practice-issued document</strong>
              <span>
                AFS, Secretarial, CRM and future modules will use this shared practice identity once each module is migrated.
              </span>
            </div>

            <div style={styles.previewFooter}>
              <div style={styles.previewPractitioner}>
                <strong>{settings.authorised_signatory_name || "Authorised signatory"}</strong>
                {professionalLine ? <span>{professionalLine}</span> : null}
                {settings.authorised_signatory_position ? <span>{settings.authorised_signatory_position}</span> : null}
                <span>{settings.firm_name || practiceDisplayName}</span>
              </div>

              <div style={styles.previewBodies}>
                {settings.governing_body_logo_url ? (
                  <img src={settings.governing_body_logo_url} alt="Governing body" style={styles.previewBodyLogo} />
                ) : null}
                {settings.second_governing_body_logo_url ? (
                  <img src={settings.second_governing_body_logo_url} alt="Second governing body" style={styles.previewBodyLogo} />
                ) : null}
              </div>
            </div>
          </div>

          {saveStatus === "error" ? (
            <p style={styles.errorText}>Could not save the practice settings.</p>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  help,
}: {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  disabled?: boolean;
  placeholder?: string;
  help?: string;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input
        style={styles.input}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
      />
      {help ? <span style={styles.help}>{help}</span> : null}
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "#eaf0f7", color: "#0f172a", fontFamily: "Arial, Helvetica, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, background: "#ffffff", borderBottom: "1px solid #b8c7d9", padding: "16px" },
  kicker: { color: "#2563eb", fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", marginBottom: 6 },
  title: { margin: 0, fontSize: 22, lineHeight: 1.1, fontWeight: 900, letterSpacing: "-0.03em" },
  subtitle: { margin: "8px 0 0", color: "#475569", fontSize: 12, lineHeight: 1.4 },
  backButton: { border: "1px solid #94a3b8", background: "#ffffff", color: "#0f172a", textDecoration: "none", padding: "9px 13px", fontSize: 12, fontWeight: 850 },
  contentStack: { display: "grid", gap: 10, padding: "10px 0 24px" },
  panel: { background: "#ffffff", borderTop: "1px solid #b8c7d9", borderBottom: "1px solid #b8c7d9", padding: 12 },
  previewPanel: { background: "#ffffff", borderTop: "1px solid #b8c7d9", borderBottom: "1px solid #b8c7d9", padding: 12 },
  loadingPanel: { background: "#ffffff", borderBottom: "1px solid #b8c7d9", padding: 18, fontSize: 13 },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, marginBottom: 10 },
  panelTitle: { margin: 0, fontSize: 14, lineHeight: 1.2, fontWeight: 900 },
  panelHint: { margin: "5px 0 0", color: "#64748b", fontSize: 11, lineHeight: 1.35 },
  twoColumnGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 },
  threeColumnGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 },
  field: { display: "grid", gap: 4, marginBottom: 8 },
  label: { fontSize: 11, fontWeight: 900, color: "#334155" },
  input: { width: "100%", minHeight: 30, border: "1px solid #b8c7d9", background: "#ffffff", padding: "5px 7px", fontSize: 12, boxSizing: "border-box", outline: "none" },
  textarea: { width: "100%", minHeight: 58, border: "1px solid #b8c7d9", background: "#ffffff", padding: 7, fontSize: 12, lineHeight: 1.35, boxSizing: "border-box", resize: "vertical", outline: "none", fontFamily: "Arial, Helvetica, sans-serif" },
  textareaSmall: { width: "100%", minHeight: 44, border: "1px solid #b8c7d9", background: "#ffffff", padding: 7, fontSize: 12, lineHeight: 1.35, boxSizing: "border-box", resize: "vertical", outline: "none", fontFamily: "Arial, Helvetica, sans-serif" },
  help: { color: "#64748b", fontSize: 9.5, lineHeight: 1.3 },
  saveButton: { border: "1px solid #0f172a", background: "#0f172a", color: "#ffffff", padding: "9px 14px", fontSize: 12, fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" },
  previewPage: { border: "1px solid #94a3b8", background: "#ffffff", maxWidth: 760, minHeight: 400, padding: 18, boxSizing: "border-box" },
  previewHeader: { display: "grid", gridTemplateColumns: "210px minmax(0, 1fr)", gap: 22, alignItems: "center" },
  previewLogoBox: { minHeight: 72, display: "flex", alignItems: "center", justifyContent: "flex-start", color: "#94a3b8", fontSize: 12, fontWeight: 900 },
  previewLogo: { maxWidth: 210, maxHeight: 78, objectFit: "contain", display: "block" },
  previewContact: { display: "grid", justifyItems: "end", gap: 2, fontSize: 11, lineHeight: 1.25, color: "#334155", textAlign: "right" },
  previewRule: { borderTop: "1.5px solid #111827", margin: "18px 0 20px" },
  previewBody: { display: "grid", gap: 8, fontSize: 12, minHeight: 150 },
  previewFooter: { borderTop: "1px solid #111827", marginTop: 34, paddingTop: 12, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 210px", gap: 20, fontSize: 11, alignItems: "start" },
  previewPractitioner: { display: "grid", justifyItems: "start", gap: 5, lineHeight: 1.25 },
  previewBodies: { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 },
  previewBodyLogo: { maxWidth: 92, maxHeight: 24, objectFit: "contain", display: "block" },
  errorText: { margin: "8px 0 0", color: "#b91c1c", fontSize: 12, fontWeight: 800 },
};
